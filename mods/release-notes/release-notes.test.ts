import { describe, expect, mock, test as it } from 'claude-code/testing'
import { compareVersions, parseVersions, pickLocale, withSection } from './hooks/register'

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const ok = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
const pbxproj = (version: string, build = '41') =>
  `MARKETING_VERSION = ${version};\nCURRENT_PROJECT_VERSION = ${build};\nMARKETING_VERSION = 1.0;\nMARKETING_VERSION = "$(APP_VERSION)";`

type Repo = {
  version: string
  tags?: string[]
  /** Short sha → the version that commit's project.pbxproj holds, newest first. */
  bumps?: Record<string, string>
  locales?: string[]
  changelog?: string
  store?: Record<string, unknown>
  /** False outside a git repository. */
  isRepo?: boolean
  /** Path → where it resolves, for symbolic links. */
  links?: Record<string, string>
}

/** Stands in for git, the file system, the store and the model over one Xcode repository at /work. */
function fake(on: Parameters<Parameters<typeof it>[1]>[1], repo: Repo) {
  const written: Record<string, string> = {}
  const toasts: string[] = []
  const asked: string[] = []
  const ran: string[] = []
  const clock = mock.clock(on, { now: 0 })
  const store = { ...repo.store }
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }))
  on('command.register', () => ({ value: { command: 'draft-release-notes' } }))
  on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'beneath' }))
  on('store.get', ($, e) => ({ value: store[e.key] }))
  on('store.set', ($, e) => ((store[e.key] = e.value), { value: undefined }))
  on('model.complete', ($, e) => (asked.push(e.prompt), { value: { isAnswered: true, text: '- Dark mode\n- Fixed a crash on launch\n', usage } }))
  on('fs.list', ($, e) =>
    e.path === '/work/fastlane/metadata' && repo.locales
      ? { value: [...repo.locales, 'review_information'].map(name => ({ name, kind: 'dir', size: 0, mtimeMs: 0, isLink: false })) }
      : { deny: 'ENOENT' },
  )
  on('fs.read', ($, e) => {
    if (e.path === '/work/App.xcodeproj/project.pbxproj') return { value: pbxproj(repo.version) }
    if (e.path === '/work/CHANGELOG.md' && repo.changelog !== undefined) return { value: written[e.path] ?? repo.changelog }
    return { deny: 'ENOENT' }
  })
  on('fs.stat', ($, e) => {
    const realPath = repo.links?.[e.path] ?? e.path
    const exists = e.path === '/work' || e.path.endsWith('/en-US') || (e.path === '/work/CHANGELOG.md' && repo.changelog !== undefined) || e.path in (repo.links ?? {})
    return exists ? { value: { kind: 'file', size: 0, mtimeMs: 0, isLink: e.path in (repo.links ?? {}), realPath } } : { deny: 'ENOENT' }
  })
  on('fs.write', ($, e) => ((written[e.path] = e.text), { value: undefined }))
  on('process.run', ($, e) => {
    const args = e.argv.slice(3).join(' ')
    ran.push(args)
    if (repo.isRepo === false) return ok('', 128)
    if (args === 'rev-parse --show-toplevel') return ok('/work\n')
    if (args.startsWith('ls-files')) return ok('Pods/Pods.xcodeproj/project.pbxproj\nApp.xcodeproj/project.pbxproj\n')
    if (args.startsWith('describe')) {
      const tags = repo.tags ?? []
      const tag = args.endsWith('^') ? tags[tags.indexOf(args.split(' ').at(-1)!.slice(0, -1)) + 1] : tags[0]
      return tag ? ok(`${tag}\n`) : ok('', 128)
    }
    if (args.startsWith('log -n 50')) return ok(Object.keys(repo.bumps ?? {}).join('\n'))
    if (args.startsWith('show ')) return ok(pbxproj(repo.bumps![args.slice(5).split(':')[0]!]!))
    if (args.startsWith('log --no-merges')) return ok('Add dark mode\nFix crash on launch\nchore: bump deps\n')
    if (args.startsWith('rev-list')) return ok('3\n')
    return ok('', 1)
  })

  return { written, toasts, asked, ran, store, clock }
}

describe('helpers', () => {
  it('should read the highest version and build across targets', () => {
    expect(parseVersions(pbxproj('2.10.0'))).toEqual({ version: '2.10.0', build: '41' })
    expect(parseVersions('"MARKETING_VERSION": "1.2.0",\n"CURRENT_PROJECT_VERSION": "7",\n"MARKETING_VERSION": "1.0"')).toEqual({ version: '1.2.0', build: '7' })
    expect(parseVersions('MARKETING_VERSION = 1.0(;').version).toBeNull()
    expect(parseVersions('nothing here')).toEqual({ version: null, build: null })
    expect(compareVersions('2.10', '2.9')).toBeGreaterThan(0)
  })

  it('should prefer the default locale, then en-US', () => {
    expect(pickLocale(['ja', 'en-US', 'default', 'review_information'])).toBe('default')
    expect(pickLocale(['ja', 'en-US'])).toBe('en-US')
    expect(pickLocale(['zh-Hans', 'ja'])).toBe('ja')
    expect(pickLocale(['review_information'])).toBeNull()
  })

  it('should add a section above the newest, or replace its own', () => {
    const log = '# Changelog\n\n## 2.3.0\n\n- Old\n'
    expect(withSection(log, '2.4.0', '- New')).toBe('# Changelog\n\n## 2.4.0\n\n- New\n\n## 2.3.0\n\n- Old\n')
    expect(withSection('# Changelog\n\n## [2.4.0] - 2026-10-01\n\n- Draft\n\n## 2.3.0\n\n- Old\n', '2.4.0', '- New')).toBe('# Changelog\n\n## 2.4.0\n\n- New\n\n## 2.3.0\n\n- Old\n')
    expect(withSection('', '1.0.0', '- First')).toBe('# Changelog\n\n## 1.0.0\n\n- First\n')
  })
})

describe('release-notes', () => {
  it('should take the first sight of a repository as its baseline', async ($, on) => {
    const { written, asked, store, clock } = fake(on, { version: '2.3.0', tags: ['v2.2.0'], locales: ['en-US'] })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await clock.advance(0)
    await $.turn.complete({ reason: 'answer', answer: 'done' })
    await clock.advance(0)
    expect(asked).toEqual([])
    expect(written).toEqual({})
    expect(store['repo:/work']).toEqual({ version: '2.3.0' })
  })

  it('should draft into fastlane metadata once the version is bumped', async ($, on) => {
    const repo: Repo = { version: '2.3.0', tags: ['v2.3.0', 'v2.2.0'], locales: ['ja', 'en-US'], store: { 'repo:/work': { version: '2.3.0' } } }
    const { written, toasts, asked, clock } = fake(on, repo)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    await clock.advance(0)
    repo.version = '2.4.0'
    await $.turn.complete({ reason: 'answer', answer: 'bumped' })
    await clock.advance(0)
    await $.turn.complete({ reason: 'answer', answer: 'again' })
    await clock.advance(0)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain('version 2.4.0')
    expect(asked[0]).toContain('- Add dark mode')
    expect(written).toEqual({ '/work/fastlane/metadata/en-US/release_notes.txt': '- Dark mode\n- Fixed a crash on launch\n' })
    expect(toasts).toEqual(['Release notes for 2.4.0 drafted in fastlane/metadata/en-US/release_notes.txt'])
  })

  it('should write CHANGELOG.md without fastlane, counting from the previous version bump', async ($, on) => {
    const { ran } = fake(on, { version: '2.4.0', bumps: { b2: '2.4.0', b1: '2.3.0' }, changelog: '# Changelog\n\n## 2.3.0\n\n- Old\n' })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const result = await $.command.run({ command: 'draft-release-notes', args: '' })
    expect(result.text).toBe('Release notes for 2.4.0 written to CHANGELOG.md:\n\n- Dark mode\n- Fixed a crash on launch')
    expect(ran).toContain('log --no-merges -n 200 --format=%s --end-of-options b1..HEAD')
  })

  it('should not write through a link that leads outside the repository', async ($, on) => {
    const { written } = fake(on, { version: '2.4.0', tags: ['v2.3.0'], changelog: '', links: { '/work/CHANGELOG.md': '/Users/me/.zshrc' } })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const result = await $.command.run({ command: 'draft-release-notes', args: '' })
    expect(result.text).toBe('Could not draft the release notes: CHANGELOG.md leads outside the repository, so it was left alone.')
    expect(written).toEqual({})
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    it(`should draw the version and whether notes are drafted on ${surface}`, async ($, on) => {
      fake(on, { version: '2.4.0', tags: ['v2.3.0'], changelog: '# Changelog\n\n## 2.4.0\n\n- New\n' })
      await $.session.start({ surface, isInteractive: true, cwd: '/work' })
      await $.command.run({ command: 'draft-release-notes', args: '' })
      const ui = await $.ui.mount({ plugin: 'release-notes', surface, component: 'AbovePrompt', props: BAND })
      expect(await ui.find({ type: 'Text', text: '📝 v2.4.0 (41)' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '3 commits since v2.3.0' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'notes drafted', props: { color: 'green' } })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
      await ui.unmount()
    })
  }

  it('should draw nothing outside an Xcode project', async ($, on) => {
    fake(on, { version: '2.4.0', isRepo: false })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
    const result = await $.command.run({ command: 'draft-release-notes', args: '' })
    expect(result.text).toBe('No Xcode project with a MARKETING_VERSION in this repository.')
    const ui = await $.ui.mount({ plugin: 'release-notes', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '📝 v2.4.0 (41)' })).toBeUndefined()
  })
})
