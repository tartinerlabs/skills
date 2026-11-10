import { describe, expect, mock, test as it } from 'claude-code/testing'

const NOW = Date.parse('2026-10-07T15:45:00Z')
const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

describe('limit-watch', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    it(`should colour each window by how much is used and tick the countdowns on ${surface}`, async ($, on) => {
      // Hooks registered here sit beneath the mod and stand in for Claude Code.
      const clock = mock.clock(on, { now: NOW })
      let limits = [
        { kind: 'five_hour', percentUsed: 25, resetsAt: '2026-10-07T19:30:00Z' },
        { kind: 'seven_day', percentUsed: 65, resetsAt: '2026-10-14T08:00:00Z' },
      ]
      on('session.start', ($, e) => ({ cwd: e.cwd }))
      on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: limits } }))
      on('session.measure', ($, e) => ({ changed: e.changed }))
      on('ui.toast', () => ({ value: undefined }))
      // The band beneath: another plugin's row, kept under the limits.
      on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'beneath' }))

      await $.session.start({ surface, isInteractive: true, cwd: '/work' })
      const ui = await $.ui.mount({ plugin: 'limit-watch', surface, component: 'AbovePrompt', props: BAND })
      expect(await ui.find({ type: 'Text', text: '25% · 3h45m', props: { color: 'green' } })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '65% · 6d16h', props: { color: 'yellow' } })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()

      await clock.advance(60_000)
      expect(await ui.find({ type: 'Text', text: '25% · 3h44m' })).toBeDefined()

      limits = [{ ...limits[0]!, percentUsed: 82 }, limits[1]!]
      await $.session.measure({ context: { window: 200_000 }, rateLimits: limits, changed: ['rateLimits'] })
      expect(await ui.find({ type: 'Text', text: '82% · 3h44m', props: { color: 'red' } })).toBeDefined()

      await ui.unmount()
    })
  }

  it('should toast each threshold once per reset period', async ($, on) => {
    mock.clock(on, { now: NOW })
    const toasts: string[] = []
    let limits = [{ kind: 'five_hour', percentUsed: 82, resetsAt: '2026-10-07T19:30:00Z' }]
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: limits } }))
    on('session.measure', ($, e) => ({ changed: e.changed }))
    on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
    const measure = () => $.session.measure({ context: { window: 200_000 }, rateLimits: limits, changed: ['rateLimits'] })

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await measure()
    expect(toasts).toEqual(['5h limit at 82%, resets in 3h45m'])

    limits = [{ ...limits[0]!, percentUsed: 96 }]
    await measure()
    expect(toasts.at(-1)).toBe('5h limit at 96%, resets in 3h45m')

    limits = [{ kind: 'five_hour', percentUsed: 81, resetsAt: '2026-10-08T00:30:00Z' }]
    await measure()
    expect(toasts).toHaveLength(3)
  })

  it('should name a window it does not know by its kind and draw nothing off a subscription', async ($, on) => {
    mock.clock(on, { now: NOW })
    let limits: { kind: string; percentUsed: number; resetsAt?: string }[] = [{ kind: 'seven_day_fable', percentUsed: 40 }]
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: limits } }))
    on('session.measure', ($, e) => ({ changed: e.changed }))
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const ui = await $.ui.mount({ plugin: 'limit-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: 'seven_day_fable ' })).toBeDefined()

    limits = []
    await $.session.measure({ context: { window: 200_000 }, rateLimits: limits, changed: ['rateLimits'] })
    expect(await ui.find({ type: 'Text', text: /%/ })).toBeUndefined()

    await ui.unmount()
  })

  it('should show the session cost and follow it, with or without limits', async ($, on) => {
    mock.clock(on, { now: NOW })
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: [], cost: { usd: 2.356 } } }))
    on('session.measure', ($, e) => ({ changed: e.changed }))
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const ui = await $.ui.mount({ plugin: 'limit-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: '💰 $2.36', props: { color: 'yellow' } })).toBeDefined()

    await $.session.measure({ context: { window: 200_000 }, rateLimits: [], cost: { usd: 3.1 }, changed: ['cost'] })
    expect(await ui.find({ type: 'Text', text: '💰 $3.10' })).toBeDefined()

    await ui.unmount()
  })

  it('should drop the reset countdowns on a narrow band', async ($, on) => {
    mock.clock(on, { now: NOW })
    const limits = [
      { kind: 'five_hour', percentUsed: 25, resetsAt: '2026-10-07T19:30:00Z' },
      { kind: 'seven_day', percentUsed: 65, resetsAt: '2026-10-14T08:00:00Z' },
    ]
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: limits } }))
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const ui = await $.ui.mount({ plugin: 'limit-watch', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 30 } })
    expect(await ui.find({ type: 'Text', text: '25%' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /3h45m/ })).toBeUndefined()

    await ui.unmount()
  })
})
