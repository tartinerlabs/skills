import { describe, expect, test as it } from 'claude-code/testing'
import { findVideoIds, formatContext, formatTime, formatTranscript } from './hooks/register'

const VIDEO = {
  id: 'SfX43uIubj4',
  title: '4 UI Design Hacks to KILL boring designs',
  channel: 'Kole Jain',
  duration: 404,
  description: 'Boring UI designs are super common.',
  chapters: [
    { title: 'Intro', start_time: 0 },
    { title: 'Hack 1', start_time: 42 },
  ],
}
const JSON3 = JSON.stringify({
  events: [
    { tStartMs: 0, dDurationMs: 405889 },
    { tStartMs: 0, segs: [{ utf8: 'Playful' }, { utf8: ' websites' }] },
    { tStartMs: 1870, segs: [{ utf8: '\n' }] },
    { tStartMs: 1880, segs: [{ utf8: 'are' }, { utf8: ' fading.' }] },
    { tStartMs: 31_000, segs: [{ utf8: 'Hack' }, { utf8: ' one.' }] },
  ],
})

type Setup = { hasYtDlp?: boolean; hasBrew?: boolean; answer?: string; installs?: boolean; fails?: boolean }

/** Stands in for yt-dlp, Homebrew, the file system and the question dialog. */
function fake(on: Parameters<Parameters<typeof it>[1]>[1], setup: Setup = {}) {
  const toasts: string[] = []
  const ran: string[] = []
  const asked: string[] = []
  const sent: { text: string; context?: readonly string[] }[] = []
  let hasYtDlp = setup.hasYtDlp ?? true
  const ok = (stdout = '', exitCode = 0, stderr = '') => ({ value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } })

  on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
  on('prompt.submit', ($, e) => (sent.push({ text: e.text, context: e.context }), { text: e.text, context: e.context }))
  on('tool.call', ($, e) => {
    if (e.tool !== 'AskUserQuestion') return { deny: 'unexpected tool' }
    const question = e.questions[0]!.question
    asked.push(question)
    return { result: { questions: e.questions, answers: { [question]: setup.answer ?? 'Not now' } } }
  })
  on('process.run', ($, e) => {
    const line = e.argv.join(' ')
    ran.push(line)
    if (line === 'yt-dlp --version') return hasYtDlp ? ok('2026.10.26') : { deny: 'ENOENT' }
    if (line === 'brew --version') return setup.hasBrew ? ok('Homebrew 5.0') : { deny: 'ENOENT' }
    if (line === 'brew install yt-dlp') {
      hasYtDlp = setup.installs ?? true
      return ok()
    }
    if (line === 'mktemp -d') return ok('/tmp/yt\n')
    if (line.startsWith('rm -rf')) return ok()
    if (e.argv[0] === 'yt-dlp') {
      return setup.fails ? ok('', 1, 'ERROR: [youtube] SfX43uIubj4: Video unavailable') : ok(`${JSON.stringify(VIDEO)}\n`)
    }
    return { deny: 'ENOENT' }
  })
  on('fs.list', () => ({
    value: ['SfX43uIubj4.en-orig.json3', 'SfX43uIubj4.en.json3'].map(name => ({ name, kind: 'file', size: 1, mtimeMs: 0, isLink: false })),
  }))
  on('fs.read', ($, e) => (e.path === '/tmp/yt/SfX43uIubj4.en.json3' ? { value: JSON3 } : { deny: 'ENOENT' }))

  return { toasts, ran, asked, sent }
}

const submit = ($: Parameters<Parameters<typeof it>[1]>[0], text: string) =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } } as never)

describe('youtube', () => {
  it('should find each video once across link styles', () => {
    const text = [
      'https://www.youtube.com/watch?v=SfX43uIubj4',
      'youtu.be/SfX43uIubj4?t=10',
      'https://m.youtube.com/watch?list=PL1&v=dQw4w9WgXcQ',
      'https://youtube.com/shorts/abcdefghijk',
      'https://www.youtube.com/channel/UC123',
    ].join(' ')

    expect(findVideoIds(text)).toEqual(['SfX43uIubj4', 'dQw4w9WgXcQ', 'abcdefghijk'])
  })

  it('should format times under and over an hour', () => {
    expect(formatTime(404)).toBe('6:44')
    expect(formatTime(3725)).toBe('1:02:05')
  })

  it('should group the transcript into timestamped paragraphs', () => {
    expect(formatTranscript(JSON3)).toBe('[0:00] Playful websites are fading.\n[0:31] Hack one.')
  })

  it('should say when a video has no transcript', () => {
    expect(formatContext(VIDEO, null)).toContain('Chapters:\n0:00 Intro\n0:42 Hack 1\n\nTranscript: none available.')
  })

  it('should add the video and its transcript to the prompt', async ($, on) => {
    const { toasts, sent } = fake(on)

    await submit($, 'apply https://www.youtube.com/watch?v=SfX43uIubj4 to the landing page')

    expect(sent[0]!.text).toBe('apply https://www.youtube.com/watch?v=SfX43uIubj4 to the landing page')
    expect(sent[0]!.context).toEqual([formatContext(VIDEO, '[0:00] Playful websites are fading.\n[0:31] Hack one.')])
    expect(toasts).toEqual(['YouTube: added "4 UI Design Hacks to KILL boring designs" with its transcript'])
  })

  it('should leave prompts without links alone', async ($, on) => {
    const { ran, sent } = fake(on)

    await submit($, 'fix the tests')

    expect(ran).toEqual([])
    expect(sent[0]!.context).toBeUndefined()
  })

  it('should toast yt-dlp errors and send the prompt as typed', async ($, on) => {
    const { toasts, sent } = fake(on, { fails: true })

    await submit($, 'youtu.be/SfX43uIubj4')

    expect(sent[0]!.context).toBeUndefined()
    expect(toasts).toEqual(["YouTube: couldn't read SfX43uIubj4: ERROR: [youtube] SfX43uIubj4: Video unavailable"])
  })

  it('should install yt-dlp with Homebrew when the user agrees', async ($, on) => {
    const { asked, ran, sent } = fake(on, { hasYtDlp: false, hasBrew: true, answer: 'Install with Homebrew' })

    await submit($, 'youtu.be/SfX43uIubj4')

    expect(asked).toEqual(["yt-dlp isn't installed. Install it with Homebrew so Claude can read YouTube links?"])
    expect(ran).toContain('brew install yt-dlp')
    expect(sent[0]!.context).toHaveLength(1)
  })

  it('should stop asking for the session once the user declines', async ($, on) => {
    const { asked, ran, sent } = fake(on, { hasYtDlp: false, hasBrew: true })

    await submit($, 'youtu.be/SfX43uIubj4')
    await submit($, 'youtu.be/SfX43uIubj4')

    expect(asked).toHaveLength(1)
    expect(ran).not.toContain('brew install yt-dlp')
    expect(sent.map(s => s.context)).toEqual([undefined, undefined])
  })

  it('should point to the install guide when no installer is found', async ($, on) => {
    const { asked, toasts } = fake(on, { hasYtDlp: false })

    await submit($, 'youtu.be/SfX43uIubj4')

    expect(asked).toEqual([])
    expect(toasts).toEqual(['YouTube: install yt-dlp to read video links (github.com/yt-dlp/yt-dlp#installation)'])
  })
})
