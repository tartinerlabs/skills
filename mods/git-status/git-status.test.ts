import { describe, expect, mock, test as it } from 'claude-code/testing'
import { parse, treeGroups } from './hooks/register'

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

const tree = (status: string, stash = 0, operation?: string) => ({ ...parse(status), stash, operation })

const run = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })

const DIRTY = [
  '# branch.oid 1234567890abcdef',
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +2 -1',
  '1 M. N... 100644 100644 100644 aaa bbb staged.ts',
  '1 .M N... 100644 100644 100644 aaa bbb modified.ts',
  '1 MM N... 100644 100644 100644 aaa bbb both.ts',
  '2 R. N... 100644 100644 100644 aaa bbb R100 new.ts\told.ts',
  '? notes.md',
  '? scratch.ts',
  '',
].join('\n')

const CONFLICTED = [
  '# branch.oid 1234567890abcdef',
  '# branch.head (detached)',
  'u UU N... 100644 100644 100644 100644 aaa bbb ccc clash.ts',
  '',
].join('\n')

describe('parse', () => {
  it('should count ahead, behind, staged, modified and untracked', () => {
    expect(parse(DIRTY)).toEqual({ branch: 'main', ahead: 2, behind: 1, staged: 3, modified: 2, untracked: 2, conflicts: 0 })
  })

  it('should show a detached HEAD as its short commit and count conflicts', () => {
    expect(parse(CONFLICTED)).toMatchObject({ branch: '1234567', conflicts: 1 })
  })
})

describe('treeGroups', () => {
  it('should say clean when there is nothing to show', () => {
    expect(treeGroups(tree('# branch.head main\n'))).toEqual([[['✓ clean', 'green']]])
  })

  it('should group the counts that are not zero, each in its colour', () => {
    expect(treeGroups(tree(DIRTY, 2, 'merging'))).toEqual([
      [['↑ 2 ahead', 'green'], ['↓ 1 behind', 'yellow']],
      [['● 3 staged', 'green'], ['✎ 2 changed', 'yellow'], ['+ 2 new', 'gray']],
      [['⚠ merging', 'red']],
      [['⚑ 2 stashed', 'magenta']],
    ])
  })
})

describe('git-status', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    it(`should draw the tree above the prompt and toast when a rebase stops on conflicts on ${surface}`, async ($, on) => {
      mock.clock(on, { now: 0 })
      const toasts: string[] = []
      let status = DIRTY
      on('session.start', ($, e) => ({ cwd: e.cwd }))
      on('command.register', () => ({ value: undefined }))
      on('process.run', ($, e) => {
        // No gh here, so the pull request entries stay out.
        if (e.argv[0] !== 'git') return run('', 1)
        const args = e.argv.slice(2)
        if (args[0] === 'status') return run(status)
        if (args[0] === 'rev-list') return run('', 128)

        return run(args.filter((_, i) => i % 2 === 1 && i > 1).map(marker => `/work/.git/${marker}`).join('\n'))
      })
      on('fs.exists', ($, e) => ({ value: status === CONFLICTED && e.path === '/work/.git/rebase-merge' }))
      on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
      on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'beneath' }))
      on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '' }))

      await $.session.start({ surface, isInteractive: true, cwd: '/work' })
      const ui = await $.ui.mount({ plugin: 'git-status', surface, component: 'AbovePrompt', props: BAND })
      expect(await ui.find({ type: 'Text', text: '🌿 main', props: { color: 'cyan' } })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '↑ 2 ahead', props: { color: 'green' } })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '✎ 2 changed', props: { color: 'yellow' } })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()

      status = CONFLICTED
      await $.tool.call({ tool: 'Bash', command: 'git rebase main', description: 'Rebase' })
      expect(await ui.find({ type: 'Text', text: '🌿 1234567' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '✖ 1 conflict', props: { color: 'red' } })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '⚠ rebasing', props: { color: 'red' } })).toBeDefined()
      expect(toasts).toEqual(['Rebasing stopped on 1 conflict'])
    })
  }

  it('should draw nothing outside a repository', async ($, on) => {
    mock.clock(on, { now: 0 })
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: undefined }))
    on('process.run', () => run('', 128))
    on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'beneath' }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/tmp' })
    const ui = await $.ui.mount({ plugin: 'git-status', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: /🌿/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
  })
})
