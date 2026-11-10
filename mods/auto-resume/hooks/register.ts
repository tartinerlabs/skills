import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, Timer } from 'claude-code'

import type { ResumeAt } from '../types'

const PROMPT = 'continue'
// Give the limit a moment past its reset before trying again.
const BUFFER_MS = 60_000
// When no exhausted window says when it resets, try again after this long.
const FALLBACK_MS = 5 * 60_000

// Held by the host, so a pending resume survives a hot reload of this file.
const resumeAt = atom({ plugin: 'auto-resume', key: 'resumeAt' } as const, null as ResumeAt)

// The module's own timer: a reload drops it, and session.start arms it again.
let timer: Timer | undefined

async function cancel($: EngineInterface) {
  timer?.cancel()
  timer = undefined
  $.ui.status(undefined)
  await update($, resumeAt, () => null)
}

async function arm($: EngineInterface, at: number) {
  timer?.cancel()
  await update($, resumeAt, () => at)
  const now = await $.clock.now()
  $.ui.status(`⏸ auto-resume in ${span(at - now)}`)
  timer = $.clock.after(Math.max(0, at - now), () => void resume($))
}

async function resume($: EngineInterface) {
  await cancel($)
  $.ui.toast('Usage limit reset, resuming')
  await $.prompt.submit({ text: PROMPT })
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'auto-resume',
      description: 'Show when the session resumes after a usage limit; "cancel" to stop it',
      argumentHint: '[cancel]',
    })
    // Re-arm a resume planned before a reload.
    const at = await read($, resumeAt)
    if (at !== null) await arm($, at)

    return result
  })

  on('classic.StopFailure', async ($, e, next) => {
    const result = await next(e)
    if (e.error !== 'rate_limit') return result

    const { rateLimits } = await $.session.usage()
    const now = await $.clock.now()
    const reset = resetOf(rateLimits)
    await arm($, reset === null ? now + FALLBACK_MS : Math.max(reset, now) + BUFFER_MS)

    return result
  }).catch(($, e, next) => next(e))

  // The person picked the session back up themselves.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'composer' || e.origin.kind === 'bridge') {
      if ((await read($, resumeAt)) !== null) await cancel($)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'auto-resume' }, async ($, e) => {
    const at = await read($, resumeAt)
    if (e.args?.trim() === 'cancel') {
      if (at === null) return { text: 'No resume pending.' }
      await cancel($)

      return { text: 'Auto-resume cancelled.' }
    }
    if (at === null) return { text: 'No resume pending.' }

    return { text: `Resuming in ${span(at - (await $.clock.now()))}.` }
  })
}

/** When the last exhausted window resets, in ms since the epoch; null when none says. */
export function resetOf(limits: readonly SessionRateLimit[]) {
  const resets = limits
    .filter(limit => limit.percentUsed >= 100 && limit.resetsAt)
    .map(limit => Date.parse(limit.resetsAt!))
    .filter(ms => !Number.isNaN(ms))

  return resets.length ? Math.max(...resets) : null
}

export function span(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60_000))
  if (m < 60) return `${m}m`

  return `${Math.floor(m / 60)}h ${m % 60}m`
}
