import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { TokenWeatherReading } from '../types'

const HISTORY = 12
const BARS = '▁▂▃▄▅▆▇█'
const FORECAST = [
  { upTo: 25, icon: '🌞', word: 'Clear', color: 'yellow' },
  { upTo: 50, icon: '⛅', word: 'Cloudy', color: 'cyan' },
  { upTo: 75, icon: '☔', word: 'Showers', color: 'blue' },
  { upTo: 90, icon: '⚡', word: 'Storm', color: 'magenta' },
  { upTo: Infinity, icon: '🚨', word: 'Compact soon', color: 'red' },
] as const

// Held by the host, so the history survives a hot reload of this file.
const readings = atom({ plugin: 'token-weather', key: 'readings' } as const, [])
// The fill after the latest model request of the turn in flight; null between turns.
const live = atom({ plugin: 'token-weather', key: 'live' } as const, null)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await takeReading($)

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    // Main-loop turns only, not subagents.
    if (!e.agentId) {
      await takeReading($)
    }

    return result
  })

  // Each model request of a turn reports a new fill, so the band moves mid-turn.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)

    if (!e.agentId) {
      const reading = await measure($)

      if (reading) {
        await update($, live, () => reading)
      }
    }

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const history = await read($, readings)
    const current = await read($, live)
    const now = current ?? history.at(-1)

    if (e.props.hasSurvey || now === undefined) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    // Mid-turn, compare with where the turn began.
    const prev = current ? history.at(-1) : history.at(-2)
    const f = FORECAST.find(b => now.percent < b.upTo) ?? FORECAST[4]
    const head = `${f.icon} ${f.word}`
    // An emoji is two columns wide, whatever its `.length`.
    const headWidth = 3 + f.word.length
    const percent = `  ${now.percent}% of context`
    const size = `  ${short(now.tokens)} / ${short(now.window)}`
    const spark = sparkline(history)
    const change = prev ? trend(now.tokens - prev.tokens, current ? 'this turn' : 'last turn') : ''
    // Add the history only when the whole row fits the band, so it does not wrap.
    const room = e.props.bodyColumns - 2
    const isWide = headWidth + (percent + size + '   last turns ' + spark + change).length <= room
    const hasSize = headWidth + (percent + size).length <= room
    // Stack above whatever the plugins beneath draw, so other bands stay.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" paddingX={1}>
          <Text color={f.color} bold>
            {head}
          </Text>
          <Text wrap="truncate-end">{percent}</Text>
          {hasSize && <Text dimColor>{size}</Text>}
          {isWide && <Text dimColor>{'   last turns '}</Text>}
          {isWide && <Text color={f.color}>{spark}</Text>}
          {isWide && prev && <Text dimColor>{change}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}

async function measure($: EngineInterface): Promise<TokenWeatherReading | undefined> {
  const { context } = await $.session.usage()

  if (!context?.window || context.tokens === undefined) {
    return undefined
  }

  return {
    tokens: context.tokens,
    window: context.window,
    percent: context.percent ?? Math.round((context.tokens / context.window) * 100),
  }
}

async function takeReading($: EngineInterface) {
  const reading = await measure($)

  if (reading) {
    await update($, readings, history => [...(history ?? []), reading].slice(-HISTORY))
  }

  await update($, live, () => null)
}

function sparkline(history: readonly TokenWeatherReading[]) {
  const top = Math.max(...history.map(r => r.tokens), 1)

  return history.map(r => BARS[Math.floor((r.tokens / top) * (BARS.length - 1))]).join('')
}

function trend(delta: number, span: string) {
  if (delta === 0) {
    return '  steady'
  }

  return delta > 0 ? `  ▲ +${short(delta)} ${span}` : `  ▼ ${short(-delta)} ${span}`
}

function short(n: number) {
  if (n >= 1_000_000) {
    return `${+(n / 1_000_000).toFixed(1)}M`
  }

  if (n >= 1_000) {
    return `${+(n / 1_000).toFixed(1)}k`
  }

  return String(n)
}
