export type CacheClockReading = { at: number; read: number; write: number; input: number; output: number }

declare module 'claude-code' {
  interface PluginState {
    'cache-clock': { last: CacheClockReading | null }
  }
}
