/** How the pull request's checks stand: `failed` names the failing ones. */
export type Checks = { total: number; passed: number; pending: number; failed: string[] }

/** The unmerged layers of a gh-stack stack, bottom first, where the current branch sits among them, and the trunk they merge into. */
export type Stack = { position: number; total: number; trunk: string; layers: { branch: string; pr?: number }[] }

/** The open pull request for the current branch, as `gh pr view` last reported it. */
export type Pr = {
  number: number
  url: string
  /** The head commit the checks ran on. */
  head: string
  isDraft: boolean
  mergeable: string
  mergeStateStatus: string
  checks: Checks
  /** Set when the branch is a layer of a gh-stack stack. */
  stack?: Stack
}

/** The working tree, as `git status --porcelain=v2 --branch` last reported it. */
export type Tree = {
  branch: string
  ahead: number
  behind: number
  staged: number
  modified: number
  untracked: number
  conflicts: number
  stash: number
  /** A rebase, merge, cherry-pick, revert or bisect stopped partway, as `REBASING` and so on. */
  operation?: string
}

declare module 'claude-code' {
  interface PluginState {
    'git-status': { pr: Pr | null; tree: Tree | null }
  }
}
