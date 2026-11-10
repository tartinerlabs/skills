import { describe, expect, mock, test as it } from 'claude-code/testing'

const STEP = { turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 }
const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

describe('cache-clock', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    it(`should count the band down and go cold on ${surface}`, async ($, on) => {
      // Hooks registered here sit beneath the mod and stand in for Claude Code.
      const clock = mock.clock(on, { now: 1_000_000 })
      on('session.start', ($, e) => ({ cwd: e.cwd }))
      on('turn.step', async function* ($, e) {
        return {
          turnId: e.turnId,
          index: e.index,
          answer: 'ok',
          toolUses: [],
          stopReason: 'end_turn',
          usage: {
            model: e.model,
            input_tokens: 400,
            cache_read_input_tokens: 92_000,
            cache_creation_input_tokens: 7_600,
            output_tokens: 1_000,
          },
        }
      })
      // The band beneath: another plugin's row, kept under the clock.
      on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'beneath' }))

      await $.session.start({ surface, isInteractive: true, cwd: '/work' })
      const ui = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props: BAND })
      expect(await ui.find({ type: 'Text', text: /cache/ })).toBeUndefined()

      const step = $.turn.step(STEP)
      for await (const _ of step) {
        // drain
      }
      await step.result
      await clock.advance(1_000)
      expect(await ui.find({ type: 'Text', text: '🔥 cache 4:59 left · 92% hit' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()

      await clock.advance(60_000)
      expect(await ui.find({ type: 'Text', text: '🔥 cache 3:59 left · 92% hit' })).toBeDefined()

      await clock.advance(240_000)
      expect(await ui.find({ type: 'Text', text: '🧊 cache cold · next turn re-writes 101k' })).toBeDefined()

      // A subagent's request leaves the main cache's clock alone.
      const sub = $.turn.step({ ...STEP, agentId: 'sub' })
      for await (const _ of sub) {
        // drain
      }
      await sub.result
      await clock.advance(1_000)
      expect(await ui.find({ type: 'Text', text: /cold/ })).toBeDefined()

      await ui.unmount()
    })
  }

  it('should honour a one-hour TTL', { options: { ttl: '1h' } }, async ($, on) => {
    mock.clock(on)
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('turn.step', async function* ($, e) {
      return {
        turnId: e.turnId,
        index: e.index,
        answer: '',
        toolUses: [],
        stopReason: 'end_turn',
        usage: { model: e.model, input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 50_000, output_tokens: 10 },
      }
    })
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const ui = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    const step = $.turn.step(STEP)
    for await (const _ of step) {
      // drain
    }
    await step.result
    expect(await ui.find({ type: 'Text', text: '🔥 cache 60:00 left · 0% hit' })).toBeDefined()

    await ui.unmount()
  })

  it('should keep to the countdown on a narrow band', async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('turn.step', async function* ($, e) {
      return {
        turnId: e.turnId,
        index: e.index,
        answer: '',
        toolUses: [],
        stopReason: 'end_turn',
        usage: { model: e.model, input_tokens: 400, cache_read_input_tokens: 92_000, cache_creation_input_tokens: 7_600, output_tokens: 1_000 },
      }
    })
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const ui = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 20 } })
    const step = $.turn.step(STEP)
    for await (const _ of step) {
      // drain
    }
    await step.result
    expect(await ui.find({ type: 'Text', text: '🔥 cache 5:00 left' })).toBeDefined()

    await ui.unmount()
  })
})
