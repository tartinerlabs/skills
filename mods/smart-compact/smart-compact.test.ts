import { describe, expect, mock, test as it } from 'claude-code/testing'

import { areAllDone, bashCheckpoint, cacheTtl, decide } from './hooks/register'

const LIMITS = { threshold: 70, floor: 40 }
const TTL = 5 * 60_000

describe('smart-compact', () => {
  it('should compact a warm session only past the threshold', () => {
    expect(decide({ percent: 65, idleMs: 30_000, ttlMs: TTL }, LIMITS).compact).toBe(false)
    expect(decide({ percent: 72, idleMs: 30_000, ttlMs: TTL }, LIMITS)).toEqual({
      compact: true,
      threshold: 70,
      reasons: ['context high'],
    })
  })

  it('should lower the threshold as the cache cools and the 5h limit runs low', () => {
    expect(decide({ percent: 52, idleMs: TTL - 30_000, ttlMs: TTL }, LIMITS)).toEqual({
      compact: true,
      threshold: 50,
      reasons: ['cache cooling'],
    })
    expect(decide({ percent: 52, idleMs: TTL + 1, ttlMs: TTL }, LIMITS)).toEqual({
      compact: false,
      threshold: 70,
      reasons: [],
    })
    expect(decide({ percent: 45, idleMs: TTL - 30_000, ttlMs: TTL, fiveHourPercent: 90 }, LIMITS)).toEqual({
      compact: true,
      threshold: 40,
      reasons: ['cache cooling', '5h limit at 90%'],
    })
  })

  it('should never go under the floor', () => {
    expect(decide({ percent: 35, idleMs: TTL - 30_000, ttlMs: TTL, fiveHourPercent: 99 }, LIMITS).compact).toBe(false)
  })

  it('should compact once the session has idled to the cooling edge, and only once', async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    let percent: number | undefined = 55
    const toasts: string[] = []
    let compactions = 0
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, percent }, rateLimits: [] } }))
    on('session.compact', () => {
      compactions += 1
      percent = undefined

      return { messages: [{ role: 'user' as const, text: 'summary', toolUses: [] }] }
    })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: 'ok' }))
    on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.turn.start({ text: 'hi', turnId: 't1' })
    await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1', reason: 'end_turn' })

    // Warm and under 70%: nothing yet.
    await clock.advance(3 * 60_000)
    expect(compactions).toBe(0)

    // Within a minute of going cold: 55% clears the lowered 50%.
    await clock.advance(75_000)
    expect(compactions).toBe(1)
    expect(toasts).toEqual(['Compacted at 55%: cache cooling'])

    await clock.advance(10 * 60_000)
    expect(compactions).toBe(1)
  })

  it('should take the cache TTL from the option, else from whether plan windows are reported', () => {
    expect(cacheTtl('5m', [{ kind: 'five_hour' }])).toBe('5m')
    expect(cacheTtl('1h', [])).toBe('1h')
    expect(cacheTtl('auto', [{ kind: 'five_hour' }])).toBe('1h')
    expect(cacheTtl('auto', [{ kind: 'spend_limit' }])).toBe('5m')
    expect(cacheTtl(undefined, [])).toBe('5m')
  })

  it('should wait out the hour-long cache on a subscription before cooling', async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    let compactions = 0
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.usage', () => ({
      value: { startedAt: 0, context: { window: 200_000, percent: 55 }, rateLimits: [{ kind: 'five_hour', percentUsed: 20 }] },
    }))
    on('session.compact', () => {
      compactions += 1

      return { messages: [{ role: 'user' as const, text: 'summary', toolUses: [] }] }
    })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: 'ok' }))
    on('ui.toast', () => ({ value: undefined }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.turn.start({ text: 'hi', turnId: 't1' })
    await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1', reason: 'end_turn' })

    // Past where a five-minute cache would cool: still warm for most of an hour.
    await clock.advance(10 * 60_000)
    expect(compactions).toBe(0)

    await clock.advance(50 * 60_000)
    expect(compactions).toBe(1)
  })

  it('should read commits, PRs and branch switches off a Bash command', () => {
    expect(bashCheckpoint('git add -A && git commit -m "feat: x"')).toBe('commit')
    expect(bashCheckpoint('git -C repo commit --amend')).toBe('commit')
    expect(bashCheckpoint('gh pr create --fill')).toBe('pr')
    expect(bashCheckpoint('gh stack submit')).toBe('pr')
    expect(bashCheckpoint('gh pr merge 42 --squash')).toBe('merge')
    expect(bashCheckpoint('git switch -c feat/next')).toBe('switch')
    expect(bashCheckpoint('git checkout main')).toBe('switch')
    expect(bashCheckpoint('git checkout -- src/a.ts')).toBeNull()
    expect(bashCheckpoint('git checkout .')).toBeNull()
    expect(bashCheckpoint('git log --oneline')).toBeNull()
  })

  it('should call a todo list done only when it has items and all are completed', () => {
    expect(areAllDone([])).toBe(false)
    expect(areAllDone([{ status: 'completed' }, { status: 'in_progress' }])).toBe(false)
    expect(areAllDone([{ status: 'completed' }, { status: 'completed' }])).toBe(true)
  })

  it('should take 20 points off for a checkpoint and keep the floor', () => {
    expect(decide({ percent: 52, idleMs: 30_000, ttlMs: TTL, checkpoint: 'commit' }, LIMITS)).toEqual({
      compact: true,
      threshold: 50,
      reasons: ['committed'],
    })
    expect(decide({ percent: 38, idleMs: TTL - 30_000, ttlMs: TTL, checkpoint: 'plan' }, LIMITS).compact).toBe(false)
  })

  it('should compact after a committing turn with instructions for it, and forget the checkpoint on the next turn', async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    let percent: number | undefined = 52
    const toasts: string[] = []
    const instructions: (string | undefined)[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, percent }, rateLimits: [] } }))
    on('session.compact', ($, e) => {
      instructions.push(e.instructions)
      percent = undefined

      return { messages: [{ role: 'user' as const, text: 'summary', toolUses: [] }] }
    })
    on('tool.call', { tool: 'Bash' }, () => ({
      result: { stdout: '[main abc123] feat: x', stderr: '', interrupted: false },
      text: '[main abc123] feat: x',
    }))
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: 'ok' }))
    on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
    const end = (turnId: string) =>
      $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId, reason: 'end_turn' })

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })

    // A commit, then a new turn before the session idles: the checkpoint lapses.
    await $.turn.start({ text: 'commit it', turnId: 't1' })
    await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: x"', description: 'Commit' })
    await $.turn.start({ text: 'and more', turnId: 't2' })
    await end('t2')
    await clock.advance(30_000)
    expect(instructions).toEqual([])

    await $.turn.start({ text: 'commit again', turnId: 't3' })
    await $.tool.call({ tool: 'Bash', command: 'git commit -m "feat: y"', description: 'Commit' })
    await end('t3')
    await clock.advance(30_000)
    expect(instructions).toHaveLength(1)
    expect(instructions[0]).toMatch(/just committed/)
    expect(toasts).toEqual(['Compacted at 52%: committed'])
  })

  it('should continue after compacting only while todos are open and the turn ended on its own', { options: { continue: 'tasks' } }, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    let percent: number | undefined = 75
    const sent: string[] = []
    const toasts: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, percent }, rateLimits: [] } }))
    on('session.compact', () => {
      percent = undefined

      return { messages: [{ role: 'user' as const, text: 'summary', toolUses: [] }] }
    })
    on('tool.call', { tool: 'TodoWrite' }, () => ({ result: {}, text: 'ok' }))
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: 'ok' }))
    on('prompt.submit', ($, e) => (sent.push(e.text), e))
    on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
    const run = async (turnId: string, answer: string, isAborted = false) => {
      percent = 75
      await $.turn.start({ text: 'go', turnId })
      await $.tool.call({
        tool: 'TodoWrite',
        todos: [
          { content: 'a', status: 'completed', activeForm: 'Doing a' },
          { content: 'b', status: 'pending', activeForm: 'Doing b' },
        ],
      })
      await $.turn.complete({ answer, durationMs: 1, isAborted, turnId, reason: 'end_turn' })
      await clock.advance(30_000)
    }

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })

    await run('t1', 'Which database should I use?')
    await run('t2', 'Stopped.', true)
    expect(sent).toEqual([])

    await run('t3', 'Done with a, moving on.')
    expect(sent).toEqual(['Continue with the remaining tasks.'])
    expect(toasts.at(-1)).toBe('Compacted at 75%: context high; continuing')
  })
})
