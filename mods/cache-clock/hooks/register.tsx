import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { CacheClockReading } from '../types'

const TTL_MS = { '5m': 5 * 60_000, '1h': 60 * 60_000 } as const

// Held by the host, so the countdown survives a hot reload of this file.
const last = atom({ plugin: 'cache-clock', key: 'last' } as const, null)

export const register: Register = (on, options) => {
  const ttlMs = options.ttl === '1h' ? TTL_MS['1h'] : TTL_MS['5m']

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    // Redraw the band each second so the countdown ticks.
    $.clock.every(1000, () => $.ui.invalidate('ui.render'))

    return result
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)

    // Main-loop requests only: a subagent's cache is its own.
    if (!e.agentId && result.usage) {
      const { cache_read_input_tokens, cache_creation_input_tokens, input_tokens, output_tokens } = result.usage
      const reading: CacheClockReading = {
        at: await $.clock.now(),
        read: cache_read_input_tokens,
        write: cache_creation_input_tokens,
        input: input_tokens,
        output: output_tokens,
      }
      await update($, last, () => reading)
    }

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const reading = await read($, last)

    if (e.props.hasSurvey || reading === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const left = reading.at + ttlMs - (await $.clock.now())
    const full = describe(reading, left)
    // On a narrow band keep only the state, so the row does not wrap.
    const text = full.length <= e.props.bodyColumns - 2 ? full : full.split(' · ')[0]
    // Stack above whatever the plugins beneath draw, so other bands stay.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" paddingX={1}>
          <Text color={left <= 0 ? 'red' : left < 60_000 ? 'yellow' : 'green'} wrap="truncate-end">
            {text}
          </Text>
        </Box>
        {below}
      </Box>
    )
  })
}

export function describe(reading: CacheClockReading, left: number) {
  if (left <= 0) {
    // The next request writes the whole prefix again.
    const prefix = reading.read + reading.write + reading.input + reading.output

    return `🧊 cache cold · next turn re-writes ${short(prefix)}`
  }

  const prompt = reading.read + reading.write + reading.input
  const hit = prompt === 0 ? 0 : Math.round((reading.read / prompt) * 100)

  return `🔥 cache ${clock(left)} left · ${hit}% hit`
}

function clock(ms: number) {
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)

  return `${m}:${String(s % 60).padStart(2, '0')}`
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
