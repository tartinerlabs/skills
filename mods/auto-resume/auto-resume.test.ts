import { describe, expect, mock, test as it } from 'claude-code/testing'

const NOW = Date.parse('2026-10-07T10:00:00Z')
const RESET = '2026-10-07T12:00:00Z'
const TWO_HOURS = 2 * 60 * 60_000
const EXHAUSTED = [
  { kind: 'five_hour', percentUsed: 100, resetsAt: RESET },
  { kind: 'seven_day', percentUsed: 40, resetsAt: '2026-10-10T00:00:00Z' },
]

describe('auto-resume', () => {
  it('should send continue a minute after the exhausted window resets', async ($, on) => {
    // Hooks registered here sit beneath the mod and stand in for Claude Code.
    const clock = mock.clock(on, { now: NOW })
    const sent: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: undefined }))
    on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: EXHAUSTED } }))
    on('classic.StopFailure', () => ({}))
    on('prompt.submit', ($, e) => (sent.push(e.text), e))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.classic.StopFailure({ error: 'rate_limit' })
    expect((await $.command.run({ command: 'auto-resume' })).text).toBe('Resuming in 2h 1m.')

    await clock.advance(TWO_HOURS)
    expect(sent).toEqual([])
    await clock.advance(60_000)
    expect(sent).toEqual(['continue'])
    expect((await $.command.run({ command: 'auto-resume' })).text).toBe('No resume pending.')
  })

  it('should ignore other API errors', async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    const sent: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: undefined }))
    on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: EXHAUSTED } }))
    on('classic.StopFailure', () => ({}))
    on('prompt.submit', ($, e) => (sent.push(e.text), e))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.classic.StopFailure({ error: 'overloaded' })
    await clock.advance(TWO_HOURS * 10)
    expect(sent).toEqual([])
  })

  it('should retry after five minutes when no window says when it resets', async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    const sent: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: undefined }))
    on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: [] } }))
    on('classic.StopFailure', () => ({}))
    on('prompt.submit', ($, e) => (sent.push(e.text), e))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.classic.StopFailure({ error: 'rate_limit' })
    await clock.advance(5 * 60_000)
    expect(sent).toEqual(['continue'])
  })

  it('should stop a pending resume on /auto-resume cancel', async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    const sent: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: undefined }))
    on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: EXHAUSTED } }))
    on('classic.StopFailure', () => ({}))
    on('prompt.submit', ($, e) => (sent.push(e.text), e))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await $.classic.StopFailure({ error: 'rate_limit' })
    expect((await $.command.run({ command: 'auto-resume', args: 'cancel' })).text).toBe('Auto-resume cancelled.')
    await clock.advance(TWO_HOURS * 2)
    expect(sent).toEqual([])
  })
})
