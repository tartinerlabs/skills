/** One rate-limit window as the API last reported it. */
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

/** The highest threshold already toasted for each window, keyed by `kind`, with the reset it belongs to. */
export type Warned = Record<string, { resetsAt: string; level: number }>

declare module 'claude-code' {
  interface PluginState {
    'limit-watch': { limits: Limit[]; warned: Warned; cost: number | null }
  }
}
