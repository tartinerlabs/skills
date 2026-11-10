import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Checks, Pr, Stack, Tree } from '../types'

// Catches edits made outside Claude Code, between tool calls.
const POLL_MS = 15_000
// --no-optional-locks keeps the poll from taking index.lock while the person runs git themselves.
const GIT = ['git', '--no-optional-locks']
// Marker files git leaves in its directory while an operation is stopped, first match wins.
const OPERATIONS = [
  ['rebase-merge', 'rebasing'],
  ['rebase-apply', 'rebasing'],
  ['MERGE_HEAD', 'merging'],
  ['CHERRY_PICK_HEAD', 'cherry-picking'],
  ['REVERT_HEAD', 'reverting'],
  ['BISECT_LOG', 'bisecting'],
] as const

// The module's own state: a reload drops it, and session.start starts it again.
let timer: Timer | undefined
let running: Promise<void> | undefined
let isQueued = false
let lastConflicts = 0

// Held by the host, so a hot reload keeps the band drawn.
const tree = atom({ plugin: 'git-status', key: 'tree' } as const, null as Tree | null)

async function git($: EngineInterface, args: string[]) {
  const ran = await $.process.run([...GIT, ...args]).catch(() => null)

  return ran?.exitCode === 0 ? ran.stdout : null
}

async function operation($: EngineInterface) {
  const paths = await git($, ['rev-parse', '--path-format=absolute', ...OPERATIONS.flatMap(([marker]) => ['--git-path', marker])])
  if (paths === null) return undefined
  const lines = paths.trim().split('\n')
  for (const [i, [, label]] of OPERATIONS.entries()) {
    if (await $.fs.exists(lines[i]!).catch(() => false)) return label
  }

  return undefined
}

async function stashes($: EngineInterface) {
  // Fails when there is no stash at all.
  const count = await git($, ['rev-list', '--walk-reflogs', '--count', 'refs/stash'])

  return count === null ? 0 : Number(count.trim()) || 0
}

async function show($: EngineInterface) {
  const status = await git($, ['status', '--porcelain=v2', '--branch'])
  if (status === null) {
    await update($, tree, () => null)
    return
  }
  const [stash, op] = await Promise.all([stashes($), operation($)])
  const now: Tree = { ...parse(status), stash, operation: op }
  await update($, tree, () => now)

  if (now.conflicts > 0 && lastConflicts === 0) {
    $.ui.toast(`${op ? `${op[0]!.toUpperCase()}${op.slice(1)} stopped on` : 'Git has'} ${plural(now.conflicts, 'conflict')}`)
  }
  lastConflicts = now.conflicts
}

/** Runs one refresh at a time, and one more after it when asked meanwhile. */
function refreshTree($: EngineInterface) {
  if (running) {
    isQueued = true
    return running
  }
  running = show($)
    .catch(() => update($, tree, () => null))
    .finally(() => {
      running = undefined
      if (isQueued) {
        isQueued = false
        void refreshTree($)
      }
    })

  return running
}

const FIELDS = 'number,url,headRefOid,state,isDraft,mergeable,mergeStateStatus,statusCheckRollup'
const FAILED = ['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']

// Held by the host, so a hot reload keeps the band and does not toast the same result twice.
const current = atom({ plugin: 'git-status', key: 'pr' } as const, null as Pr | null)

/** Drops control characters, so a check name or gh output cannot carry terminal escapes. */
export const clean = (text: string) => text.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')

type Rollup = { __typename?: string; name?: string; context?: string; status?: string; conclusion?: string; state?: string; workflowName?: string; detailsUrl?: string }

const RUN_ID = /\/actions\/runs\/(\d+)\//

/** Drops check runs from a workflow's older runs, such as one cancelled when a push started a newer run. */
export function latestRuns(rollup: readonly Rollup[]): Rollup[] {
  const runOf = (check: Rollup) => Number(RUN_ID.exec(check.detailsUrl ?? '')?.[1] ?? 0)
  const newest = new Map<string, number>()
  for (const check of rollup) {
    if (check.workflowName) newest.set(check.workflowName, Math.max(newest.get(check.workflowName) ?? 0, runOf(check)))
  }

  return rollup.filter(check => !check.workflowName || runOf(check) === newest.get(check.workflowName))
}

/** Tallies `statusCheckRollup`, which mixes check runs (`status`, `conclusion`) and commit statuses (`state`). */
export function tally(all: readonly Rollup[]): Checks {
  const rollup = latestRuns(all)
  const checks: Checks = { total: rollup.length, passed: 0, pending: 0, failed: [] }
  for (const check of rollup) {
    const result = check.__typename === 'StatusContext' ? check.state : check.status === 'COMPLETED' ? check.conclusion : 'PENDING'
    if (FAILED.includes(result ?? '')) checks.failed.push(clean(check.name ?? check.context ?? '?'))
    else if (result === 'PENDING' || result === 'EXPECTED' || !result) checks.pending += 1
    else checks.passed += 1
  }

  return checks
}

/** True once the pull request can merge as is: open, checks green, nothing blocking it. */
export function isReady(pr: Pr) {
  return !pr.isDraft && pr.mergeable === 'MERGEABLE' && pr.checks.failed.length === 0 && pr.checks.pending === 0 && ['CLEAN', 'HAS_HOOKS'].includes(pr.mergeStateStatus)
}

/** The band's checks entry and its colour. */
export function checksEntry({ total, passed, pending, failed }: Checks): [string, string] {
  if (total === 0) return ['no checks', 'gray']
  if (failed.length) return [`❌ ${failed.length} failing: ${failed.join(', ')}`, 'red']
  if (pending) return [`⏳ ${passed}/${total} checks`, 'yellow']

  return [`✅ ${total}/${total} checks`, 'green']
}

/** The band's merge entry and its colour. */
export function mergeEntry(pr: Pr): [string, string] {
  if (pr.isDraft) return ['draft', 'gray']
  if (pr.mergeable === 'CONFLICTING') return ['conflicts', 'red']
  if (pr.mergeStateStatus === 'BEHIND') return ['behind base', 'yellow']
  if (pr.mergeStateStatus === 'BLOCKED') return ['blocked', 'yellow']
  if (isReady(pr)) return ['ready · /merge', 'green']

  return ['waiting', 'gray']
}

type StackView = { trunk: string; currentBranch: string; branches: { name: string; isMerged: boolean; pr?: { number: number } }[] }

/** The current branch's place among the unmerged layers of `gh stack view --json`, or null when it is not one. */
export function parseStack(view: StackView): Stack | null {
  const layers = view.branches.filter(b => !b.isMerged).map(b => ({ branch: b.name, pr: b.pr?.number }))
  const index = layers.findIndex(l => l.branch === view.currentBranch)

  return index < 0 ? null : { position: index + 1, total: layers.length, trunk: view.trunk, layers }
}

async function fetchStack($: EngineInterface): Promise<Stack | null> {
  // Exits non-zero off a stack, and where the gh-stack extension is not installed.
  const ran = await $.process.run(['gh', 'stack', 'view', '--json'], { timeoutMs: 15_000 }).catch(() => null)
  if (!ran || ran.exitCode !== 0) return null

  try {
    return parseStack(JSON.parse(ran.stdout))
  } catch {
    return null
  }
}

async function fetchPr($: EngineInterface, number?: number): Promise<Pr | null> {
  const argv = ['gh', 'pr', 'view', ...(number ? [String(number)] : []), '--json', FIELDS]
  const ran = await $.process.run(argv, { timeoutMs: 15_000 }).catch(() => null)
  if (!ran || ran.exitCode !== 0) return null
  const view = JSON.parse(ran.stdout)
  if (view.state !== 'OPEN') return null

  return {
    number: view.number,
    url: view.url,
    head: view.headRefOid,
    isDraft: view.isDraft,
    mergeable: view.mergeable,
    mergeStateStatus: view.mergeStateStatus,
    checks: tally(view.statusCheckRollup ?? []),
  }
}

// Bumped by every refresh and by a merge, so a slower, older refresh cannot overwrite a newer result.
let latest = 0

async function refreshPr($: EngineInterface) {
  const id = ++latest
  const pr = await fetchPr($)
  const stack = pr && (await fetchStack($))
  if (id !== latest) return
  if (pr && stack) pr.stack = stack
  const was = await read($, current)
  await update($, current, () => pr)

  // Toast when the same pull request's checks finish, not on first sight.
  if (!pr || was?.number !== pr.number || !was.checks.pending || pr.checks.pending) return
  $.ui.toast(
    pr.checks.failed.length
      ? `PR #${pr.number} checks failed: ${pr.checks.failed.join(', ')}`
      : `PR #${pr.number} checks passed${isReady(pr) ? ', ready to /merge' : ''}`,
    { timeoutMs: 8000 },
  )
}

/** True when `branch` is at `head` locally, so merging and deleting it loses no unpushed commits. */
async function isPushed($: EngineInterface, branch: string, head: string) {
  const local = await $.process.run(['git', 'rev-parse', '--verify', `refs/heads/${branch}^{commit}`]).catch(() => null)

  return local?.exitCode === 0 && local.stdout.trim() === head
}

/**
 * Merges the whole stack with `gh stack merge`, after checking every unmerged layer, since it is all
 * or nothing and has no head pin. It runs without an argument, as a number would be read as a stack
 * number before a pull request number.
 */
async function mergeStack($: EngineInterface, pr: Pr, stack: Stack, method: string) {
  const numbers: number[] = []
  for (const layer of stack.layers) {
    if (!layer.pr) return `${layer.branch} has no pull request yet: run gh stack submit first.`
    const one = layer.pr === pr.number ? pr : await fetchPr($, layer.pr)
    if (!one) return `PR #${layer.pr} (${layer.branch}) is not open.`
    if (!isReady(one)) return `PR #${one.number} (${layer.branch}) is not ready to merge: ${checksEntry(one.checks)[0]}, ${mergeEntry(one)[0]}.`
    if (!(await isPushed($, layer.branch, one.head))) return `${layer.branch} is not at PR #${one.number}'s head: push or pull first.`
    numbers.push(one.number)
  }

  const ran = await $.process.run(['gh', 'stack', 'merge', '--yes', `--${method}`], { timeoutMs: 300_000 })
  if (ran.exitCode !== 0) return `gh stack merge failed: ${clean((ran.stderr || ran.stdout).trim())}`

  return `Merged stack: PR #${numbers.join(', #')}.${await deleteLayers($, stack)}`
}

/**
 * Deletes every layer's branch, local and remote, and switches to the trunk, as `gh pr merge -d` does
 * for one pull request, which `gh stack merge` has no flag for. It waits until every pull request has
 * merged, since deleting a head branch while the stack sits in a merge queue would close it.
 */
async function deleteLayers($: EngineInterface, stack: Stack) {
  for (const layer of stack.layers) {
    const state = await $.process.run(['gh', 'pr', 'view', String(layer.pr), '--json', 'state', '--jq', '.state'], { timeoutMs: 15_000 }).catch(() => null)
    if (state?.stdout.trim() !== 'MERGED') return ' Branches kept until every pull request has merged.'
  }
  const checkout = await $.process.run(['git', 'checkout', stack.trunk]).catch(() => null)
  if (checkout?.exitCode !== 0) return ` Could not switch to ${stack.trunk}, so the branches were kept.`
  await $.process.run(['git', 'pull', '--ff-only'], { timeoutMs: 60_000 }).catch(() => null)

  const kept: string[] = []
  for (const { branch } of stack.layers) {
    // Fails harmlessly when the repository already deleted the head branch on merge.
    await $.process.run(['gh', 'api', '-X', 'DELETE', `repos/{owner}/{repo}/git/refs/heads/${branch}`], { timeoutMs: 15_000 }).catch(() => null)
    const deleted = await $.process.run(['git', 'branch', '-D', branch]).catch(() => null)
    if (deleted?.exitCode !== 0) kept.push(branch)
  }

  return kept.length ? ` Switched to ${stack.trunk}, but could not delete ${kept.join(', ')} locally.` : ` Deleted ${stack.layers.map(l => l.branch).join(', ')} and switched to ${stack.trunk}.`
}

export const register: Register = (on, options) => {
  const method = typeof options.method === 'string' ? options.method : 'merge'

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    timer?.cancel()
    timer = $.clock.every(POLL_MS, () => void refreshTree($))
    await refreshTree($)
    await $.command.register({ name: 'merge', description: "Merge this branch's pull request, or its whole stack, once checks pass" })
    await refreshPr($)
    $.clock.every(60_000, () => refreshPr($))

    return result
  })

  // Any tool may have changed the tree: Bash, Edit, Write, or an MCP tool.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    await refreshTree($)

    return result
  }).catch(($, e, next) => next(e))

  // A turn may have pushed or opened a pull request.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) void refreshPr($)

    return result
  })

  on('command.run', { command: 'merge' }, async $ => {
    await refreshPr($)
    const pr = await read($, current)
    if (!pr) return { text: 'No open pull request for this branch.' }
    if (pr.stack) {
      const text = await mergeStack($, pr, pr.stack, method)
      await refreshPr($)

      return { text }
    }
    if (!isReady(pr)) return { text: `PR #${pr.number} is not ready to merge: ${checksEntry(pr.checks)[0]}, ${mergeEntry(pr)[0]}.` }

    // --delete-branch drops the local branch, so refuse while it holds commits the PR does not.
    const local = await $.process.run(['git', 'rev-parse', 'HEAD']).catch(() => null)
    if (local?.stdout.trim() !== pr.head) return { text: `This branch is not at PR #${pr.number}'s head: push or pull first.` }

    // Pinned to the head that was checked, so a push since then is not merged unchecked.
    const ran = await $.process.run(['gh', 'pr', 'merge', String(pr.number), `--${method}`, '--delete-branch', '--match-head-commit', pr.head], { timeoutMs: 120_000 })
    if (ran.exitCode === 0) {
      // GitHub may still report the pull request as open right after the merge, so clear the band instead of asking.
      latest += 1
      await update($, current, () => null)
    } else {
      await refreshPr($)
    }

    return { text: ran.exitCode === 0 ? `Merged PR #${pr.number}.` : `gh pr merge failed: ${clean((ran.stderr || ran.stdout).trim())}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const [git, pr] = await Promise.all([read($, tree), read($, current)])

    if (e.props.hasSurvey || (!git && !pr)) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    // Stack above whatever the plugins beneath draw, so other bands stay.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" paddingX={1} gap={2}>
          {git && (
            <Box flexDirection="row">
              <Text color="cyan">🌿 {git.branch}</Text>
              {treeGroups(git).flatMap(group => [
                <Text dimColor>{'  ·  '}</Text>,
                ...group.flatMap(([text, colour], i) => [i > 0 && <Text>{', '}</Text>, <Text color={colour}>{text}</Text>]),
              ])}
            </Box>
          )}
          {pr && <Text dimColor>🔀 PR #{pr.number}</Text>}
          {pr?.stack && <Text dimColor>📚 stack {pr.stack.position}/{pr.stack.total}</Text>}
          {pr && <Text color={checksEntry(pr.checks)[1]} wrap="truncate-end">{checksEntry(pr.checks)[0]}</Text>}
          {pr && <Text color={mergeEntry(pr)[1]}>{mergeEntry(pr)[0]}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}

/** Reads `git status --porcelain=v2 --branch`. */
export function parse(status: string): Omit<Tree, 'stash' | 'operation'> {
  const tree = { branch: '', ahead: 0, behind: 0, staged: 0, modified: 0, untracked: 0, conflicts: 0 }
  let oid = ''
  for (const line of status.split('\n')) {
    if (line.startsWith('# branch.oid ')) oid = line.slice(13)
    else if (line.startsWith('# branch.head ')) tree.branch = line.slice(14)
    else if (line.startsWith('# branch.ab ')) {
      const [ahead, behind] = line.slice(12).split(' ')
      tree.ahead = Number(ahead) || 0
      tree.behind = Math.abs(Number(behind) || 0)
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      if (line[2] !== '.') tree.staged++
      if (line[3] !== '.') tree.modified++
    } else if (line.startsWith('u ')) tree.conflicts++
    else if (line.startsWith('? ')) tree.untracked++
  }
  // A detached HEAD reads as its short commit.
  if (tree.branch === '(detached)') tree.branch = oid === '(initial)' ? oid : oid.slice(0, 7)

  return tree
}

/**
 * The band's tree as groups of coloured parts, joined by `·` between groups and `,` within one:
 * `↑ 1 ahead, ↓ 8 behind · ● 1 staged, ✎ 1 changed, + 2 new · ⚠ merging, ✖ 1 conflict · ⚑ 2 stashed`, or `✓ clean`.
 */
export function treeGroups(tree: Tree): [string, string][][] {
  const groups: [string, string][][] = [
    [tree.ahead && [`↑ ${tree.ahead} ahead`, 'green'], tree.behind && [`↓ ${tree.behind} behind`, 'yellow']],
    [tree.staged && [`● ${tree.staged} staged`, 'green'], tree.modified && [`✎ ${tree.modified} changed`, 'yellow'], tree.untracked && [`+ ${tree.untracked} new`, 'gray']],
    [tree.operation && [`⚠ ${tree.operation}`, 'red'], tree.conflicts && [`✖ ${plural(tree.conflicts, 'conflict')}`, 'red']],
    [tree.stash && [`⚑ ${tree.stash} stashed`, 'magenta']],
  ].map(group => group.filter((part): part is [string, string] => Array.isArray(part)))

  const shown = groups.filter(group => group.length)

  return shown.length ? shown : [[['✓ clean', 'green']]]
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
