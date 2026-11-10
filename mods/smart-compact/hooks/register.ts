import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Checkpoint, SmartCompactTurn } from '../types'

const TTL_MS = { '5m': 5 * 60_000, '1h': 60 * 60_000 } as const
const TICK_MS = 15_000
// Compact this close to the cache going cold, so the summary still reads it warm.
const COOLING_MS = 60_000
// Leave the person a moment to type a follow-up before compacting under them.
const SETTLE_MS = 10_000
const CONTINUE_PROMPT = 'Continue with the remaining tasks.'

const CHECKPOINTS: Record<Checkpoint, { reason: string; instructions: string }> = {
  commit: {
    reason: 'committed',
    instructions:
      'The work so far was just committed. Say in a line or two what the commit holds, and keep open follow-ups, decisions and anything not yet committed.',
  },
  pr: {
    reason: 'PR opened',
    instructions:
      'A pull request was just opened. Keep its number, branch and what reviewers should know; summarise the rest briefly.',
  },
  merge: {
    reason: 'PR merged',
    instructions: 'A pull request was just merged. Keep its number and any follow-ups; summarise the rest briefly.',
  },
  plan: {
    reason: 'plan approved',
    instructions: 'A plan was just approved. Keep the approved plan verbatim and summarise how it was reached in a few lines.',
  },
  todos: {
    reason: 'todos done',
    instructions: 'Every task on the todo list is done. Summarise what was done briefly and keep anything left open.',
  },
  switch: {
    reason: 'switched task',
    instructions:
      'The session moved to another branch or worktree. Summarise the earlier work briefly and keep what the new task needs.',
  },
}

// Held by the host, so a hot reload mid-turn still knows a turn is running.
const turn = atom({ plugin: 'smart-compact', key: 'turn' } as const, { isBusy: false, endedAt: null } as SmartCompactTurn)
// The last checkpoint the current or just-ended turn reached.
const checkpoint = atom({ plugin: 'smart-compact', key: 'checkpoint' } as const, null as Checkpoint | null)
// Task ids made with TaskCreate and not yet completed or deleted.
const openTasks = atom({ plugin: 'smart-compact', key: 'openTasks' } as const, [] as readonly string[])
// Items not yet completed on the latest TodoWrite list.
const openTodos = atom({ plugin: 'smart-compact', key: 'openTodos' } as const, 0)

export type Factors = {
  percent: number
  idleMs: number
  ttlMs: number
  fiveHourPercent?: number
  checkpoint?: Checkpoint | null
}

export type Limits = { threshold: number; floor: number }

export type Decision = { compact: boolean; threshold: number; reasons: string[] }

export const register: Register = (on, options) => {
  const limits: Limits = {
    threshold: Number(options.threshold ?? 70),
    floor: Number(options.floor ?? 40),
  }
  const isWatchingCheckpoints = options.checkpoints !== 'off'
  const isContinuing = options.continue === 'tasks'
  let isCompacting = false

  on('session.start', async ($, e, next) => {
    const result = await next(e)

    $.clock.every(TICK_MS, async () => {
      const state = await read($, turn)

      if (isCompacting || state.isBusy || state.endedAt === null) {
        return
      }

      const idleMs = (await $.clock.now()) - state.endedAt

      if (idleMs < SETTLE_MS) {
        return
      }

      const { context, rateLimits } = await $.session.usage()

      // No reading until the first response after a start or a compaction.
      if (context.percent === undefined) {
        return
      }

      const reached = await read($, checkpoint)
      const fiveHour = rateLimits.find(limit => limit.kind === 'five_hour')
      const ttlMs = TTL_MS[cacheTtl(options.ttl, rateLimits)]
      const decision = decide(
        { percent: context.percent, idleMs, ttlMs, fiveHourPercent: fiveHour?.percentUsed, checkpoint: reached },
        limits,
      )

      if (!decision.compact) {
        return
      }

      isCompacting = true

      try {
        const instructions = reached ? CHECKPOINTS[reached].instructions : undefined
        const compacted = await $.session.compact(instructions ? { instructions } : undefined)

        if (!('skip' in compacted && compacted.skip !== undefined)) {
          const isUnfinished = (await read($, openTasks)).length > 0 || (await read($, openTodos)) > 0

          if (isContinuing && state.canContinue && isUnfinished) {
            $.ui.toast(`Compacted at ${context.percent}%: ${decision.reasons.join(', ')}; continuing`)
            await $.prompt.submit({ text: CONTINUE_PROMPT })
          } else {
            $.ui.toast(`Compacted at ${context.percent}%: ${decision.reasons.join(', ')}`)
          }
        }
      } catch {
        // A turn started between the check and the call; try again once it ends.
      } finally {
        isCompacting = false
        // One try per idle stretch: a skip waits for the next turn to end.
        await update($, turn, state => ({ ...state, endedAt: null }))
        await update($, checkpoint, () => null)
      }
    })

    return result
  })

  on('turn.start', async ($, e, next) => {
    await update($, turn, state => ({ ...state, isBusy: true }))
    // A checkpoint counts for the idle stretch after its own turn alone.
    await update($, checkpoint, () => null)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    // Main loop only: a subagent's turn ending leaves the session busy.
    if (!e.agentId) {
      const endedAt = await $.clock.now()
      // Stopped by the person, or waiting on their answer: not ours to carry on.
      const canContinue = !e.isAborted && !e.answer.trimEnd().endsWith('?')
      await update($, turn, () => ({ isBusy: false, endedAt, canContinue }))
    }

    return result
  })

  if (!isWatchingCheckpoints && !isContinuing) {
    return
  }

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)

    // A subagent's commits and plans are its own; a failed call reaches nothing.
    if (e.agentId || ran.deny !== undefined || ran.isError === true) {
      return ran
    }

    let reached: Checkpoint | null = null

    if (e.tool === 'Bash') {
      reached = bashCheckpoint(e.command)
    } else if (e.tool === 'ExitPlanMode') {
      reached = 'plan'
    } else if (e.tool === 'EnterWorktree' || e.tool === 'ExitWorktree') {
      reached = 'switch'
    } else if (e.tool === 'TodoWrite') {
      await update($, openTodos, () => e.todos.filter(todo => todo.status !== 'completed').length)
      reached = areAllDone(e.todos) ? 'todos' : null
    } else if (e.tool === 'TaskCreate') {
      const created = ran.result as { task?: { id?: string } }
      const id = created.task?.id

      if (id) {
        await update($, openTasks, ids => [...ids, id])
      }
    } else if (e.tool === 'TaskUpdate' && (e.status === 'completed' || e.status === 'deleted')) {
      const before = await read($, openTasks)
      const after = before.filter(id => id !== e.taskId)
      await update($, openTasks, () => after)
      reached = e.status === 'completed' && before.length > 0 && after.length === 0 ? 'todos' : null
    }

    if (reached && isWatchingCheckpoints) {
      await update($, checkpoint, () => reached)
    }

    return ran
  }).catch(($, e, next) => next(e)) // Only watches: a fault here must never cost the call.
}

export function bashCheckpoint(command: string): Checkpoint | null {
  if (/\bgh\s+(?:pr|stack)\s+merge\b/.test(command)) {
    return 'merge'
  }

  if (/\bgh\s+(?:pr\s+create|stack\s+submit)\b/.test(command)) {
    return 'pr'
  }

  if (/\bgit\s+(?:-C\s+\S+\s+)?commit\b/.test(command)) {
    return 'commit'
  }

  // `git checkout -- file` and `git checkout .` restore files; they do not move branch.
  if (/\bgit\s+(?:-C\s+\S+\s+)?(?:switch|checkout)\s+(?!--(?:\s|$)|\.(?:\s|$))\S/.test(command)) {
    return 'switch'
  }

  return null
}

export function areAllDone(todos: readonly { status: string }[]) {
  return todos.length > 0 && todos.every(todo => todo.status === 'completed')
}

// A subscription reports its plan windows and caches the main conversation for an hour;
// an API key or cloud provider reports none and caches for five minutes.
export function cacheTtl(option: unknown, rateLimits: readonly { kind: string }[]): keyof typeof TTL_MS {
  if (option === '5m' || option === '1h') {
    return option
  }

  return rateLimits.some(limit => limit.kind === 'five_hour' || limit.kind === 'seven_day') ? '1h' : '5m'
}

export function decide(factors: Factors, limits: Limits): Decision {
  const { percent, idleMs, ttlMs, fiveHourPercent, checkpoint: reached } = factors
  const reasons: string[] = []
  let threshold = limits.threshold

  if (reached) {
    // A finished piece of work: the summary loses the least that matters now.
    threshold -= 20
    reasons.push(CHECKPOINTS[reached].reason)
  }

  // Once cold, the summary would re-read everything uncached, so only cooling counts.
  if (idleMs < ttlMs && ttlMs - idleMs <= COOLING_MS) {
    // About to go cold: the summary reads the prefix from cache while it still can.
    threshold -= 20
    reasons.push('cache cooling')
  }

  if (fiveHourPercent !== undefined && fiveHourPercent >= 80) {
    threshold -= 10
    reasons.push(`5h limit at ${fiveHourPercent}%`)
  }

  threshold = Math.max(threshold, limits.floor)

  if (percent >= limits.threshold) {
    reasons.unshift('context high')
  }

  return { compact: percent >= threshold, threshold, reasons }
}
