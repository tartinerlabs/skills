import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Release } from '../types'

const PROMPT = `Write the App Store "What's New" text for version {version} of an Apple app from the commit subjects below, newest first.

Write for the people who use the app, not its developers: one short line per change they would notice, each starting with "- ", grouped new features first, then improvements, then fixes. Leave out refactors, tests, CI, dependency bumps, version bumps and other internal work. If nothing is user-facing, reply "- Bug fixes and performance improvements." Reply with the lines only.

{commits}`

// App Store Connect's limit for "What's New".
const MAX_NOTES = 4000
const MAX_COMMITS = 200
const FALLBACK = '- Bug fixes and performance improvements.'

// Held by the host, so a hot reload keeps the band.
const current = atom({ plugin: 'release-notes', key: 'release' } as const, null as Release | null)

/** What the mod remembers per repository across sessions. */
type Seen = { version: string; draftedFor?: string }

type Scan = { root: string; subjects: string[]; release: Release }

/** Compares dotted versions numerically, so 2.10 sorts after 2.9. */
export function compareVersions(a: string, b: string) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] || 0) - (right[i] || 0)
    if (diff) return diff
  }

  return 0
}

const highest = (values: string[]) => values.sort(compareVersions).at(-1) ?? null

/**
 * The app's version and build from a `project.pbxproj` (`KEY = 1.0;`) or the JSON `project.xcproj`
 * (`"KEY": "1.0"`). Targets can disagree (a test target left at 1.0), so the highest wins; anything but
 * digits and dots, such as a value set from another build setting (`$(...)`), is skipped.
 */
export function parseVersions(project: string) {
  const values = (key: string) =>
    [...project.matchAll(new RegExp(`\\b${key}"?\\s*[=:]\\s*"?([^";,\\n]+)"?`, 'g'))].map(m => m[1]!.trim()).filter(v => /^\d+(\.\d+)*$/.test(v))

  return { version: highest(values('MARKETING_VERSION')), build: highest(values('CURRENT_PROJECT_VERSION')) }
}

/** The fastlane locale the notes go to: `default` (deliver's fallback for every language), then en-US, then the first. */
export function pickLocale(names: string[]) {
  // Locale folders only, not review_information or trade_representative_contact_information.
  const locales = names.filter(n => /^(default|[a-z]{2,3}(-[A-Za-z0-9]+)*)$/.test(n)).sort()

  return locales.find(n => n === 'default') ?? locales.find(n => n === 'en-US') ?? locales[0] ?? null
}

const heading = (version: string) => new RegExp(`^## \\[?${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]?(?=[\\s(]|$)`, 'm')

/** True when a changelog already holds a section for `version`. */
export const hasSection = (changelog: string, version: string) => heading(version).test(changelog)

/** Puts `notes` under a `## version` section: replacing that section's body, or above the newest section. */
export function withSection(changelog: string, version: string, notes: string) {
  const section = `## ${version}\n\n${notes}\n`
  const found = heading(version).exec(changelog)
  if (found) {
    const rest = changelog.slice(found.index + found[0].length)
    const next = rest.search(/^## /m)

    return changelog.slice(0, found.index) + section + (next < 0 ? '' : `\n${rest.slice(next)}`)
  }
  const newest = changelog.search(/^## /m)
  if (newest >= 0) return `${changelog.slice(0, newest)}${section}\n${changelog.slice(newest)}`

  return `${changelog.trimEnd() || '# Changelog'}\n\n${section}`
}

/** Drops control characters but newlines, so a reply cannot carry terminal escapes, and holds it to the App Store limit. */
export function cleanNotes(text: string) {
  return text.replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, '').trim().slice(0, MAX_NOTES).trim()
}

async function git($: EngineInterface, root: string, ...args: string[]) {
  const ran = await $.process.run(['git', '-C', root, ...args], { timeoutMs: 15_000 }).catch(() => null)

  return ran?.exitCode === 0 ? ran.stdout.trim() : null
}

/** The tag or commit the notes count from: the newest tag that is not this version's, else the commit that set the previous version. */
/**
 * True when `path`, or its folder while it does not exist yet, resolves inside the repository, so a
 * symbolic link in a cloned repository cannot send a write elsewhere.
 */
async function isInside($: EngineInterface, root: string, path: string) {
  const resolve = (p: string) => $.fs.stat(p, { resolve: true }).catch(() => undefined)
  const realRoot = (await resolve(root))?.realPath
  const own = await resolve(path)
  // A dangling link has a stat but no realPath, and is refused.
  const real = own ? own.realPath : (await resolve(path.slice(0, path.lastIndexOf('/'))))?.realPath

  return realRoot !== undefined && real !== undefined && (real.startsWith(`${realRoot}/`) || (!own && real === realRoot))
}

async function findSince($: EngineInterface, root: string, project: string, version: string) {
  let tag = await git($, root, 'describe', '--tags', '--abbrev=0')
  // Tagged already, so count from the release before it.
  if (tag && tag.replace(/^v/, '') === version) tag = await git($, root, 'describe', '--tags', '--abbrev=0', '--end-of-options', `${tag}^`)
  if (tag) return tag

  const bumps = (await git($, root, 'log', '-n', '50', '--format=%h', '-G', 'MARKETING_VERSION', '--', project))?.split('\n').filter(Boolean) ?? []
  for (const sha of bumps) {
    const then = await git($, root, 'show', `${sha}:${project}`)
    if (then && parseVersions(then).version !== version) return sha
  }

  return null
}

async function findTarget($: EngineInterface, root: string, project: string) {
  // fastlane sits beside the .xcodeproj, or at the repository root.
  const beside = project.split('/').slice(0, -2).join('/')
  for (const dir of [...new Set([beside, ''])]) {
    const metadata = `${dir ? `${dir}/` : ''}fastlane/metadata`
    const entries = await $.fs.list(`${root}/${metadata}`).catch(() => [])
    const locale = pickLocale(entries.filter(e => e.kind === 'dir').map(e => e.name))
    if (locale) return { target: `${metadata}/${locale}/release_notes.txt`, isFastlane: true }
  }

  return { target: 'CHANGELOG.md', isFastlane: false }
}

async function scan($: EngineInterface): Promise<Scan | null> {
  const root = await git($, '.', 'rev-parse', '--show-toplevel')
  if (!root) return null
  const project = (await git($, root, 'ls-files', '*.xcodeproj/project.pbxproj', '*.xcodeproj/project.xcproj'))
    ?.split('\n')
    .filter(p => p && !/(^|\/)(Pods|Carthage)\//.test(p))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length)[0]
  if (!project) return null
  const { version, build } = parseVersions(await $.fs.read(`${root}/${project}`).catch(() => ''))
  if (!version) return null

  const since = await findSince($, root, project, version)
  const range = since ? `${since}..HEAD` : 'HEAD'
  const subjects = (await git($, root, 'log', '--no-merges', '-n', String(MAX_COMMITS), '--format=%s', '--end-of-options', range))?.split('\n').filter(Boolean) ?? []
  const commits = Number(await git($, root, 'rev-list', '--count', '--no-merges', '--end-of-options', range)) || subjects.length
  const { target, isFastlane } = await findTarget($, root, project)
  const seen = (await $.store.get(`repo:${root}`)) as Seen | undefined
  const isDrafted = isFastlane
    ? seen?.draftedFor === version
    : hasSection(await $.fs.read(`${root}/${target}`).catch(() => ''), version)

  return { root, subjects, release: { version, build, since, commits, target, isDrafted } }
}

/** Drafts the notes with Haiku and writes them to the target; resolves the notes, or why it wrote nothing. */
async function draft($: EngineInterface, { root, subjects, release }: Scan): Promise<{ notes: string } | { error: string }> {
  const path = `${root}/${release.target}`
  if (!(await isInside($, root, path))) return { error: `${release.target} leads outside the repository, so it was left alone.` }

  let notes = FALLBACK
  if (subjects.length) {
    const reply = await $.model.complete({
      model: 'haiku',
      prompt: PROMPT.replace('{version}', release.version).replace('{commits}', subjects.map(s => `- ${s}`).join('\n')),
      maxTokens: 1200,
      timeoutMs: 30_000,
    })
    notes = reply.isAnswered ? cleanNotes(reply.text) : ''
    if (!notes) return { error: 'the model gave no answer.' }
  }

  if (release.target.endsWith('release_notes.txt')) await $.fs.write(path, `${notes}\n`)
  else await $.fs.write(path, withSection(await $.fs.read(path).catch(() => ''), release.version, notes))
  const seen = ((await $.store.get(`repo:${root}`)) ?? {}) as Seen
  await $.store.set(`repo:${root}`, { ...seen, version: release.version, draftedFor: release.version })
  await update($, current, () => ({ ...release, isDrafted: true }))

  return { notes }
}

// Skips a check while one runs, so a turn ending mid-draft does not draft twice.
let isChecking = false

/** Rescans, and drafts on its own once the version has changed since this repository was last seen. */
async function check($: EngineInterface) {
  if (isChecking) return
  isChecking = true
  try {
    const found = await scan($)
    await update($, current, () => found?.release ?? null)
    if (!found) return

    const key = `repo:${found.root}`
    const seen = (await $.store.get(key)) as Seen | undefined
    // The first sight of a repository is its baseline, not a bump.
    if (seen?.version === found.release.version) return
    await $.store.set(key, { ...seen, version: found.release.version })
    if (!seen || found.release.isDrafted) return

    const drafted = await draft($, found)
    $.ui.toast(
      'notes' in drafted
        ? `Release notes for ${found.release.version} drafted in ${found.release.target}`
        : `Release notes for ${found.release.version} not drafted: ${drafted.error}`,
      { timeoutMs: 8000 },
    )
  } finally {
    isChecking = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'draft-release-notes', description: 'Draft App Store release notes for the current version from the commits since the last release' })
    // On a timer, so neither the session's start nor a turn's end waits on the model.
    $.clock.after(0, () => check($))

    return result
  })

  // A turn may have bumped the version, by hand or through fastlane.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) $.clock.after(0, () => check($))

    return result
  })

  on('command.run', { command: 'draft-release-notes' }, async $ => {
    const found = await scan($)
    await update($, current, () => found?.release ?? null)
    if (!found) return { text: 'No Xcode project with a MARKETING_VERSION in this repository.' }
    const drafted = await draft($, found)
    if (!('notes' in drafted)) return { text: `Could not draft the release notes: ${drafted.error}` }

    return { text: `Release notes for ${found.release.version} written to ${found.release.target}:\n\n${drafted.notes}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const release = await read($, current)
    if (e.props.hasSurvey || !release) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    // Stack above whatever the plugins beneath draw, so other bands stay.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" paddingX={1} gap={2}>
          <Text dimColor>📝 v{release.version}{release.build ? ` (${release.build})` : ''}</Text>
          <Text dimColor>{release.commits} commits since {release.since ?? 'the start'}</Text>
          {release.isDrafted ? <Text color="green">notes drafted</Text> : <Text color="gray">notes not drafted · /draft-release-notes</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}
