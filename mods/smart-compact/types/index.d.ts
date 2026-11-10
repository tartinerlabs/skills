export type SmartCompactTurn = { isBusy: boolean; endedAt: number | null; canContinue?: boolean }

export type Checkpoint = 'commit' | 'pr' | 'merge' | 'plan' | 'todos' | 'switch'

declare module 'claude-code' {
  interface PluginState {
    'smart-compact': {
      turn: SmartCompactTurn
      checkpoint: Checkpoint | null
      openTasks: readonly string[]
      openTodos: number
    }
  }
}
