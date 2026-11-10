import { describe, expect, mock, test as it } from 'claude-code/testing'
import { checksEntry, parseStack, tally } from './hooks/register'

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

const run = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })

const view = (rollup: object[], extra: object = {}) =>
  JSON.stringify({
    number: 42,
    url: 'https://github.com/o/r/pull/42',
    headRefOid: 'abc123',
    state: 'OPEN',
    isDraft: false,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    statusCheckRollup: rollup,
    ...extra,
  })

const GREEN = [
  { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { __typename: 'StatusContext', context: 'Vercel', state: 'SUCCESS' },
]
const PENDING = [{ __typename: 'CheckRun', name: 'test', status: 'IN_PROGRESS' }, GREEN[1]!]

describe('tally', () => {
  it('should count check runs and commit statuses alike', () => {
    expect(
      tally([
        ...GREEN,
        { __typename: 'CheckRun', name: 'lint', status: 'QUEUED' },
        { __typename: 'CheckRun', name: 'SonarCloud', status: 'COMPLETED', conclusion: 'FAILURE' },
        { __typename: 'CheckRun', name: 'docs', status: 'COMPLETED', conclusion: 'SKIPPED' },
      ]),
    ).toEqual({ total: 5, passed: 3, pending: 1, failed: ['SonarCloud'] })
  })

  it('should ignore a workflow run cancelled by a newer one', () => {
    const job = (run: number, name: string, conclusion: string, workflowName = 'CI') => ({
      __typename: 'CheckRun',
      name,
      status: 'COMPLETED',
      conclusion,
      workflowName,
      detailsUrl: `https://github.com/o/r/actions/runs/${run}/job/${run}1`,
    })
    expect(
      tally([
        job(100, 'discover', 'CANCELLED'),
        job(100, '${{ matrix.mod }} (${{ matrix.claude-code }})', 'CANCELLED'),
        job(101, 'discover', 'SUCCESS'),
        job(101, 'git-status (stable)', 'SUCCESS'),
        job(102, 'Analyze', 'CANCELLED', 'CodeQL'),
        GREEN[1]!,
      ]),
    ).toEqual({ total: 4, passed: 3, pending: 0, failed: ['Analyze'] })
  })

  it('should strip terminal escapes from check names', () => {
    const rollup = [{ __typename: 'CheckRun', name: 'e2e\u001b]52;c;aGk=\u0007\u001b[2J', status: 'COMPLETED', conclusion: 'FAILURE' }]
    expect(tally(rollup).failed).toEqual(['e2e]52;c;aGk=[2J'])
  })

  it('should name failing checks first', () => {
    expect(checksEntry({ total: 3, passed: 1, pending: 1, failed: ['e2e'] })).toEqual(['❌ 1 failing: e2e', 'red'])
    expect(checksEntry({ total: 3, passed: 2, pending: 1, failed: [] })).toEqual(['⏳ 2/3 checks', 'yellow'])
  })
})

const STACK = JSON.stringify({
  trunk: 'main',
  currentBranch: 'api',
  branches: [
    { name: 'auth', isMerged: true, pr: { number: 40, state: 'MERGED' } },
    { name: 'db', isMerged: false, pr: { number: 41, state: 'OPEN' } },
    { name: 'api', isMerged: false, pr: { number: 42, state: 'OPEN' } },
    { name: 'ui', isMerged: false, pr: { number: 43, state: 'OPEN' } },
  ],
})

/** Stands in for gh and git on a stack of db #41, api #42 (checked out) and ui #43 above `auth`, already merged. */
const stacked = (state: { rollup41?: object[]; localDb?: string; merged?: string; ran?: string[] } = {}) => ($: unknown, e: { argv: readonly string[] }) => {
  const argv = e.argv
  state.ran?.push(argv.join(' '))
  if (argv[1] === 'stack') return run(argv[2] === 'view' ? STACK : '')
  if (argv[1] === 'api') return run('')
  if (argv.includes('state')) return run(`${state.merged ?? 'MERGED'}\n`)
  if (argv[0] === 'git' && argv[1] !== 'rev-parse') return run('')
  if (argv[0] === 'git') return run(`${argv[3] === 'refs/heads/db^{commit}' ? (state.localDb ?? 'h41') : `h${{ api: 42, ui: 43 }[argv[3]!.slice(11, -9) as 'api' | 'ui']}`}\n`)
  const number = argv[3] === '--json' ? 42 : Number(argv[3])

  return run(view(number === 41 ? (state.rollup41 ?? GREEN) : GREEN, { number, headRefOid: `h${number}` }))
}

describe('parseStack', () => {
  it('should place the current branch among the unmerged layers', () => {
    const stack = parseStack(JSON.parse(STACK))
    expect(stack).toEqual({
      position: 2,
      total: 3,
      trunk: 'main',
      layers: [
        { branch: 'db', pr: 41 },
        { branch: 'api', pr: 42 },
        { branch: 'ui', pr: 43 },
      ],
    })
  })

  it('should not place a branch outside the stack', () => {
    expect(parseStack({ trunk: 'main', currentBranch: 'main', branches: [{ name: 'db', isMerged: false }] })).toBeNull()
  })
})

describe('git-status pull request', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    it(`should show the layer's place in its stack on ${surface}`, async ($, on) => {
      on('session.start', ($, e) => ({ cwd: e.cwd }))
      on('command.register', () => ({ value: { command: 'merge' } }))
      on('process.run', stacked())
      on('ui.render', ($, e) => $.ui.resolve(e).Box({}))

      await $.session.start({ surface, isInteractive: true, cwd: '/work' })
      const ui = await $.ui.mount({ plugin: 'git-status', surface, component: 'AbovePrompt', props: BAND })
      expect(await ui.find({ type: 'Text', text: '📚 stack 2/3' })).toBeDefined()
      await ui.unmount()
    })
  }

  it('should merge the whole stack once every layer is ready and pushed', async ($, on) => {
    const ran: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'merge' } }))
    on('process.run', stacked({ ran }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const merged = await $.command.run({ command: 'merge', args: '' })
    expect(merged.text).toBe('Merged stack: PR #41, #42, #43. Deleted db, api, ui and switched to main.')
    expect(ran).toContain('gh stack merge --yes --merge')
    expect(ran.some(c => c.startsWith('gh pr merge'))).toBe(false)
    expect(ran).toContain('git checkout main')
    for (const branch of ['db', 'api', 'ui']) {
      expect(ran).toContain(`gh api -X DELETE repos/{owner}/{repo}/git/refs/heads/${branch}`)
      expect(ran).toContain(`git branch -D ${branch}`)
    }
  })

  it('should keep the branches while the stack waits in a merge queue', async ($, on) => {
    const ran: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'merge' } }))
    on('process.run', stacked({ ran, merged: 'OPEN' }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const queued = await $.command.run({ command: 'merge', args: '' })
    expect(queued.text).toBe('Merged stack: PR #41, #42, #43. Branches kept until every pull request has merged.')
    expect(ran.some(c => c.startsWith('git branch -D') || c.startsWith('gh api'))).toBe(false)
  })

  it('should not merge a stack while a lower layer is not ready', async ($, on) => {
    const ran: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'merge' } }))
    on('process.run', stacked({ ran, rollup41: PENDING }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const refused = await $.command.run({ command: 'merge', args: '' })
    expect(refused.text).toBe('PR #41 (db) is not ready to merge: ⏳ 1/2 checks, waiting.')
    expect(ran.some(c => c.startsWith('gh stack merge'))).toBe(false)
  })

  it('should not merge a stack while a layer has unpushed commits', async ($, on) => {
    const ran: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'merge' } }))
    on('process.run', stacked({ ran, localDb: 'h99' }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const refused = await $.command.run({ command: 'merge', args: '' })
    expect(refused.text).toBe("db is not at PR #41's head: push or pull first.")
    expect(ran.some(c => c.startsWith('gh stack merge'))).toBe(false)
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    it(`should draw the pull request and toast once its checks pass on ${surface}`, async ($, on) => {
      const clock = mock.clock(on, { now: 0 })
      const toasts: string[] = []
      let rollup = PENDING
      on('session.start', ($, e) => ({ cwd: e.cwd }))
      on('command.register', () => ({ value: { command: 'merge' } }))
      on('process.run', ($, e) => (e.argv[1] === 'stack' ? run('', 2) : run(view(rollup))))
      on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
      on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'beneath' }))

      await $.session.start({ surface, isInteractive: true, cwd: '/work' })
      const ui = await $.ui.mount({ plugin: 'git-status', surface, component: 'AbovePrompt', props: BAND })
      expect(await ui.find({ type: 'Text', text: '⏳ 1/2 checks', props: { color: 'yellow' } })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()

      rollup = GREEN
      await clock.advance(60_000)
      expect(await ui.find({ type: 'Text', text: '✅ 2/2 checks', props: { color: 'green' } })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'ready · /merge' })).toBeDefined()
      expect(toasts).toEqual(['PR #42 checks passed, ready to /merge'])

      await clock.advance(60_000)
      expect(toasts).toHaveLength(1)
      await ui.unmount()
    })
  }

  it('should draw nothing without an open pull request', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'merge' } }))
    on('process.run', () => run('', 1))
    on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'beneath' }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const ui = await $.ui.mount({ plugin: 'git-status', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '🔀 PR #42' })).toBeUndefined()
  })

  it('should merge with the configured method only once ready', { options: { method: 'squash' } }, async ($, on) => {
    const ran: string[] = []
    let rollup = PENDING
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'merge' } }))
    on('process.run', ($, e) => (ran.push(e.argv.join(' ')), e.argv[1] === 'stack' ? run('', 2) : run(e.argv[0] === 'git' ? 'abc123\n' : e.argv[2] === 'merge' ? '' : view(rollup))))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const early = await $.command.run({ command: 'merge', args: '' })
    expect(early.text).toBe('PR #42 is not ready to merge: ⏳ 1/2 checks, waiting.')
    expect(ran.some(c => c.startsWith('gh pr merge'))).toBe(false)

    rollup = GREEN
    const merged = await $.command.run({ command: 'merge', args: '' })
    expect(merged.text).toBe('Merged PR #42.')
    expect(ran).toContain('gh pr merge 42 --squash --delete-branch --match-head-commit abc123')
  })

  it('should clear the band after a merge even if gh still reports the pull request open', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'merge' } }))
    on('process.run', ($, e) => (e.argv[1] === 'stack' ? run('', 2) : run(e.argv[0] === 'git' ? 'abc123\n' : e.argv[2] === 'merge' ? '' : view(GREEN))))
    on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'beneath' }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const ui = await $.ui.mount({ plugin: 'git-status', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: 'ready · /merge' })).toBeDefined()

    await $.command.run({ command: 'merge', args: '' })
    expect(await ui.find({ type: 'Text', text: '🔀 PR #42' })).toBeUndefined()
    await ui.unmount()
  })

  it('should not merge while the local branch is ahead of the pull request', async ($, on) => {
    const ran: string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'merge' } }))
    on('process.run', ($, e) => (ran.push(e.argv.join(' ')), e.argv[1] === 'stack' ? run('', 2) : run(e.argv[0] === 'git' ? 'def456\n' : view(GREEN))))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const refused = await $.command.run({ command: 'merge', args: '' })
    expect(refused.text).toBe("This branch is not at PR #42's head: push or pull first.")
    expect(ran.some(c => c.startsWith('gh pr merge'))).toBe(false)
  })
})
