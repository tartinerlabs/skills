import { describe, expect, mock, test as it } from 'claude-code/testing'
import { DETECTORS, parseBooted, rows, selfNote, simulatorsIn, waitNote } from './hooks/register'

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

const PRO = { udid: 'BA196662-63D7-4B7C-B5FE-B0EC7A336C04', name: 'iPhone 18 Pro', runtime: 'iOS 27.2' }
const MAX = { udid: 'C0FFEE00-0000-4000-8000-000000000001', name: 'iPhone 18 Pro Max', runtime: 'iOS 27.2' }

const SIMCTL = JSON.stringify({
  devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-27-2': [{ udid: PRO.udid, name: PRO.name, state: 'Booted' }],
    'com.apple.CoreSimulator.SimRuntime.watchOS-12-0': [{ udid: 'W', name: 'Watch', state: 'Shutdown' }],
  },
})

const run = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
const detect = (kind: string, tool: string, input: Record<string, unknown>) =>
  DETECTORS.find(d => d.kind === kind)!.detect({ tool, input, booted: [PRO] })

describe('parseBooted', () => {
  it('should keep booted devices and read the runtime key', () => {
    expect(parseBooted(JSON.parse(SIMCTL))).toEqual([PRO])
  })
})

describe('simulatorsIn', () => {
  it('should match a simulator by UDID or by its longest name', () => {
    expect(simulatorsIn('Bash', { command: `xcrun simctl install ${PRO.udid} App.app` }, [PRO, MAX])).toEqual([PRO])
    expect(simulatorsIn('Bash', { command: "xcodebuild -destination 'name=iPhone 18 Pro Max' test" }, [PRO, MAX])).toEqual([MAX])
  })

  it('should take the only booted simulator for booted and for Xcode runs', () => {
    expect(simulatorsIn('Bash', { command: 'xcrun simctl openurl booted myapp://x' }, [PRO])).toEqual([PRO])
    expect(simulatorsIn('mcp__xcode__RunProject', {}, [PRO])).toEqual([PRO])
    expect(simulatorsIn('mcp__xcode__RunProject', {}, [PRO, MAX])).toEqual([])
  })

  it('should leave a simulator alone for commands that only look', () => {
    expect(simulatorsIn('Bash', { command: 'xcrun simctl list devices booted' }, [PRO])).toEqual([])
    expect(simulatorsIn('Bash', { command: 'xcodebuild -showdestinations -scheme App' }, [PRO])).toEqual([])
    expect(simulatorsIn('Bash', { command: 'xcrun simctl io booted screenshot shot.png' }, [PRO])).toEqual([PRO])
    expect(simulatorsIn('Bash', { command: `xcodebuild -scheme App -destination 'id=${PRO.udid}' test` }, [PRO])).toEqual([PRO])
  })

  it('should ignore commands that do not touch a simulator', () => {
    expect(simulatorsIn('Bash', { command: `echo ${PRO.name}` }, [PRO])).toEqual([])
  })
})

describe('detectors', () => {
  it('should take the Xcode app on calls that change its state and leave reads alone', () => {
    expect(detect('xcode', 'mcp__xcode__XcodeSwitchScheme', { scheme: 'App' })).toEqual([{ id: 'Xcode', name: 'the Xcode app' }])
    expect(detect('xcode', 'mcp__xcode__BuildProject', {})).toHaveLength(1)
    expect(detect('xcode', 'mcp__xcode__XcodeRead', { path: 'a.swift' })).toEqual([])
  })

  it('should take a Claude Design project by its id', () => {
    expect(detect('designs', 'mcp__claude-design__render_preview', { project_id: 'p1', path: 'a.html' })).toEqual([{ id: 'p1', name: '' }])
  })
})

describe('rows', () => {
  const me = { session: 'a', project: 'app', at: 0, items: { designs: { d1: { name: 'Onboarding', at: 0 } } } }

  it('should show free simulators in an Xcode project and this session’s designs', () => {
    expect(rows({ isXcode: true, booted: [PRO], others: [] }, me, 1000, 60_000)).toEqual([
      { icon: '📱', label: 'iPhone 18 Pro (iOS 27.2)', status: 'free', color: 'gray' },
      { icon: '🎨', label: 'Onboarding', status: 'this session', color: 'green' },
    ])
  })

  it('should drop a claim from a session that stopped writing it', () => {
    const gone = { session: 'b', project: 'web', at: -10 * 60_000, items: { simulators: { [PRO.udid]: { name: PRO.name, at: 0 } } } }
    expect(rows({ isXcode: true, booted: [PRO], others: [gone] }, null, 1000, 60 * 60_000)[0]?.status).toBe('free')
  })
})

describe('notes', () => {
  it('should never point a waiting session at another simulator', () => {
    expect(waitNote('iPhone 18 Pro', ['the web session'])).toMatch(/Do not switch to another simulator or create one; ask your user if you cannot wait\.$/)
    expect(selfNote('Onboarding', ['another app session'])).toBe('resource-watch: Onboarding is also in use by another app session, which has been told you are using it. If a reply asks you to wait, wait for its next message.')
  })
})

/** Stands in for the machine: HOME, the booted iPhone and an Xcode project. */
const machine = ($: unknown, e: { argv: readonly string[] }) => {
  const [cmd] = e.argv
  if (cmd === 'printenv') return run('/home/me\n')
  if (cmd === 'git') return run('App.xcodeproj/project.pbxproj\n')

  return run(SIMCTL)
}

describe('resource-watch', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    it(`should hold a simulator call until the session using it has been asked on ${surface}`, async ($, on) => {
      mock.clock(on, { now: 1_000_000 })
      const toasts: string[] = []
      const sent: { to: string; text: string }[] = []
      const written: Record<string, string> = {}
      let launches = 0
      const other = { session: 'other', project: 'web', at: 1_000_000, items: { simulators: { [PRO.udid]: { name: PRO.name, at: 1_000_000 } } } }
      on('session.start', ($, e) => ({ cwd: e.cwd }))
      on('session.id', () => ({ value: 'mine' }))
      on('session.root', () => ({ value: '/work/app' }))
      on('process.run', machine)
      on('fs.list', () => ({ value: [{ name: 'other.json', kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false }] }))
      on('fs.read', () => ({ value: JSON.stringify(other) }))
      on('fs.write', ($, e) => ((written[e.path] = e.text), { value: undefined }))
      on('tool.call', { tool: 'Bash' }, () => (launches++, { result: { stdout: '', stderr: '', interrupted: false }, text: '' }))
      on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
      on('session.send', ($, e) => (sent.push({ to: e.to, text: e.text }), { isDelivered: true as const }))
      on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'beneath' }))
      const launch = () => $.tool.call({ tool: 'Bash', command: 'xcrun simctl launch booted com.example.app', description: 'Launch' })

      await $.session.start({ surface, isInteractive: true, cwd: '/work/app' })
      const ui = await $.ui.mount({ plugin: 'resource-watch', surface, component: 'AbovePrompt', props: BAND })
      expect(await ui.find({ type: 'Text', text: '📱 iPhone 18 Pro (iOS 27.2) · the web session', props: { color: 'cyan' } })).toBeDefined()

      const held = await launch()
      expect(held.deny).toContain('iPhone 18 Pro is in use by the web session, which has been asked whether you can use it.')
      expect(launches).toBe(0)
      expect(toasts).toEqual(['iPhone 18 Pro is in use by the web session; asked it, waiting'])
      expect(sent).toEqual([{ to: expect.anything(), text: expect.stringMatching(/^resource-watch: the app session \(mine\) wants to use iPhone 18 Pro, which you are using, and is waiting for your reply\./) }])
      expect(JSON.parse(written['/home/me/.claude/resource-watch/mine.json']!).waiting[PRO.udid]).toBe(1_000_000)

      // Asked once, the repeat runs, takes the simulator and stops waiting for it.
      await launch()
      expect(launches).toBe(1)
      expect(sent).toHaveLength(1)
      const claim = JSON.parse(written['/home/me/.claude/resource-watch/mine.json']!)
      expect(claim.items.simulators[PRO.udid].name).toBe(PRO.name)
      expect(claim.waiting).toEqual({})
      expect(await ui.find({ type: 'Text', text: '📱 iPhone 18 Pro (iOS 27.2) · ⚠ also the web session', props: { color: 'yellow' } })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'beneath' })).toBeDefined()
      await ui.unmount()
    })
  }

  it('should tell a waiting session once it stops and once its hold runs out', async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    const sent: string[] = []
    const waiter = { session: 'other', project: 'web', at: 1_000_000, items: {}, waiting: { [PRO.udid]: 1_000_000 } }
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.id', () => ({ value: 'mine' }))
    on('session.root', () => ({ value: '/work/app' }))
    on('process.run', machine)
    on('fs.list', () => ({ value: [{ name: 'other.json', kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false }] }))
    on('fs.read', () => ({ value: JSON.stringify(waiter) }))
    on('fs.write', () => ({ value: undefined }))
    on('tool.call', () => ({ result: {}, text: 'ok' }))
    on('ui.toast', () => ({ value: undefined }))
    on('session.send', ($, e) => (sent.push(e.text), { isDelivered: true as const }))
    const done = 'resource-watch: the app session (mine) is done with iPhone 18 Pro, so you can use it now.'

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work/app' })
    await $.tool.call({ tool: 'mcp__xcode__RunProject' })
    expect(sent).toEqual([])
    await $.tool.call({ tool: 'mcp__xcode__StopProject' })
    expect(sent).toEqual([done])

    // Used again and left alone: the hold runs out and the waiter hears so at the next poll.
    await $.tool.call({ tool: 'Bash', command: 'xcrun simctl launch booted com.example.app', description: 'Launch' })
    await clock.advance(30_000)
    waiter.at = 1_000_000 + 11 * 60_000
    await clock.advance(11 * 60_000)
    expect(sent).toEqual([done, done])
  })

  it('should tell the sessions it shared the Xcode app with when it ends', async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    const sent: string[] = []
    const other = { session: 'other', project: 'app', at: 1_000_000, items: { xcode: { Xcode: { name: 'the Xcode app', at: 1_000_000 } } } }
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.id', () => ({ value: 'mine' }))
    on('session.root', () => ({ value: '/work/app' }))
    on('process.run', machine)
    on('fs.list', () => ({ value: [{ name: 'other.json', kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false }] }))
    on('fs.read', () => ({ value: JSON.stringify(other) }))
    on('fs.write', () => ({ value: undefined }))
    on('tool.call', { tool: 'mcp__xcode__XcodeSwitchScheme' }, () => ({ result: {}, text: 'ok' }))
    on('ui.toast', () => ({ value: undefined }))
    on('session.send', ($, e) => (sent.push(e.text), { isDelivered: true as const }))
    on('session.end', () => ({ sessionId: 'mine' }))

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work/app' })
    await $.tool.call({ tool: 'mcp__xcode__XcodeSwitchScheme', scheme: 'App' })
    expect(sent).toEqual([expect.stringMatching(/has started using the Xcode app, which you are also driving\./)])
    await $.session.end({ reason: 'other' })
    expect(sent[1]).toBe('resource-watch: the app session (mine) has ended and is no longer using the Xcode app.')
  })
})
