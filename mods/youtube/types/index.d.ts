/** What yt-dlp prints for one video. */
export type Video = {
  id: string
  title?: string
  channel?: string
  uploader?: string
  /** Seconds. */
  duration?: number
  description?: string
  chapters?: { title: string; start_time: number }[] | null
}

declare module 'claude-code' {
  interface PluginState {
    youtube: {
      /** True once the user said no to installing yt-dlp, so the session stops asking. */
      isInstallDeclined: boolean
    }
  }
}
