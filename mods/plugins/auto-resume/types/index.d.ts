/** When the pending resume fires, in ms since the epoch; null when none is pending. */
export type ResumeAt = number | null

declare module 'claude-code' {
  interface PluginState {
    'auto-resume': { resumeAt: ResumeAt }
  }
}
