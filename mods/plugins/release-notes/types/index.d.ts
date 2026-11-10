/** Where the Xcode project in the working directory stands, as the last scan found it. */
export type Release = {
  /** `MARKETING_VERSION`, as in 2.4.0. */
  version: string
  /** `CURRENT_PROJECT_VERSION`; null when the project sets none. */
  build: string | null
  /** The tag, or short commit, the notes count from; null when the whole history counts. */
  since: string | null
  /** Commits since then, merges left out. */
  commits: number
  /** The file the notes go to, relative to the repository root. */
  target: string
  /** True once that file holds notes for this version. */
  isDrafted: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'release-notes': { release: Release | null }
  }
}
