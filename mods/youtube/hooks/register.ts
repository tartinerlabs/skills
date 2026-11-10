import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Video } from '../types'

const isInstallDeclined = atom({ plugin: 'youtube', key: 'isInstallDeclined' } as const, false)

const LINK = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/g
const MAX_VIDEOS = 3
// A new timestamped paragraph at least this often.
const PARAGRAPH_MS = 30_000

const INSTALLERS = [
  { name: 'Homebrew', argv: ['brew', 'install', 'yt-dlp'] },
  { name: 'uv', argv: ['uv', 'tool', 'install', 'yt-dlp'] },
  { name: 'pipx', argv: ['pipx', 'install', 'yt-dlp'] },
] as const

type Json3 = { events?: { tStartMs?: number; segs?: { utf8?: string }[] }[] }

/** The distinct video ids linked in `text`, in order. */
export function findVideoIds(text: string) {
  return [...new Set([...text.matchAll(LINK)].map(m => m[1]!))]
}

/** Seconds as `m:ss`, or `h:mm:ss` from an hour. */
export function formatTime(seconds: number) {
  const s = Math.floor(seconds)
  const [h, m, r] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
  const pad = (n: number) => String(n).padStart(2, '0')

  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`
}

/** A yt-dlp `json3` subtitle file as timestamped paragraphs, one every 30 seconds or so. */
export function formatTranscript(json3: string) {
  const paragraphs: string[] = []
  let start = -Infinity
  let words = ''
  const flush = () => {
    const text = words.replace(/\s+/g, ' ').trim()
    if (text) paragraphs.push(`[${formatTime(start / 1000)}] ${text}`)
    words = ''
  }

  for (const event of (JSON.parse(json3) as Json3).events ?? []) {
    const text = (event.segs ?? []).map(s => s.utf8 ?? '').join('')
    if (!text.trim()) continue
    const at = event.tStartMs ?? 0
    if (at - start >= PARAGRAPH_MS) {
      flush()
      start = at
    }
    words += ` ${text}`
  }
  flush()

  return paragraphs.join('\n')
}

/** The block Claude reads beside the prompt for one video. */
export function formatContext(video: Video, transcript: string | null) {
  const lines = [`YouTube video https://www.youtube.com/watch?v=${video.id}`]
  if (video.title) lines.push(`Title: ${video.title}`)
  const channel = video.channel ?? video.uploader
  if (channel) lines.push(`Channel: ${channel}`)
  if (video.duration) lines.push(`Length: ${formatTime(video.duration)}`)
  if (video.description?.trim()) lines.push('', 'Description:', video.description.trim())
  if (video.chapters?.length) lines.push('', 'Chapters:', ...video.chapters.map(c => `${formatTime(c.start_time)} ${c.title}`))
  lines.push('', transcript ? `Transcript:\n${transcript}` : 'Transcript: none available.')

  return lines.join('\n')
}

const lastLine = (text: string) => text.trim().split('\n').at(-1) ?? ''

async function canRun($: EngineInterface, argv: readonly string[]) {
  try {
    return (await $.process.run(argv)).exitCode === 0
  } catch {
    return false
  }
}

/** True once yt-dlp runs, offering to install it the first time it does not. */
async function ensureYtDlp($: EngineInterface) {
  if (await canRun($, ['yt-dlp', '--version'])) return true
  if (await read($, isInstallDeclined)) return false
  const decline = () => update($, isInstallDeclined, () => true)

  let installer: (typeof INSTALLERS)[number] | undefined
  for (const candidate of INSTALLERS) {
    if (await canRun($, [candidate.argv[0], '--version'])) {
      installer = candidate
      break
    }
  }
  if (!installer) {
    $.ui.toast('YouTube: install yt-dlp to read video links (github.com/yt-dlp/yt-dlp#installation)')
    await decline()
    return false
  }

  const answer = await $.ui
    .ask(`yt-dlp isn't installed. Install it with ${installer.name} so Claude can read YouTube links?`, {
      header: 'YouTube',
      options: [`Install with ${installer.name}`, 'Not now'],
    })
    .catch(() => 'Not now')
  if (!answer.startsWith('Install')) {
    await decline()
    return false
  }

  $.ui.toast(`YouTube: installing yt-dlp with ${installer.name}`)
  const result = await $.process.run(installer.argv, { timeoutMs: 600_000 }).catch((error: Error) => ({ exitCode: 1, stderr: error.message }))
  if (result.exitCode === 0 && (await canRun($, ['yt-dlp', '--version']))) return true

  $.ui.toast(`YouTube: yt-dlp didn't install: ${lastLine(result.stderr) || 'it is not on PATH'}`)
  await decline()
  return false
}

/** Fetches one video's details and English transcript with yt-dlp; throws with yt-dlp's error. */
async function fetchVideo($: EngineInterface, id: string) {
  const dir = (await $.process.run(['mktemp', '-d'])).stdout.trim()
  try {
    const { exitCode, stdout, stderr } = await $.process.run(
      [
        'yt-dlp',
        '--skip-download',
        '--no-simulate',
        '--no-playlist',
        '--no-progress',
        '--no-warnings',
        '--write-subs',
        '--write-auto-subs',
        '--sub-langs',
        'en.*,en',
        '--sub-format',
        'json3',
        '-P',
        dir,
        '-o',
        '%(id)s.%(ext)s',
        '--print',
        '%(.{id,title,channel,uploader,duration,description,chapters})j',
        `https://www.youtube.com/watch?v=${id}`,
      ],
      { timeoutMs: 120_000 },
    )
    if (exitCode !== 0) throw new Error(lastLine(stderr) || `yt-dlp exited ${exitCode}`)
    const video = JSON.parse(lastLine(stdout)) as Video

    const files = (await $.fs.list(dir)).map(f => f.name).filter(n => n.endsWith('.json3'))
    const file = files.find(n => n === `${id}.en.json3`) ?? files.sort()[0]
    const transcript = file ? formatTranscript(await $.fs.read(`${dir}/${file}`)) || null : null

    return { video, transcript }
  } finally {
    await $.process.run(['rm', '-rf', dir]).catch(() => {})
  }
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    if (e.command) return next(e)
    const ids = findVideoIds(e.text).slice(0, MAX_VIDEOS)
    if (!ids.length || !(await ensureYtDlp($))) return next(e)

    const blocks: string[] = []
    for (const id of ids) {
      try {
        const { video, transcript } = await fetchVideo($, id)
        blocks.push(formatContext(video, transcript))
        const title = video.title ?? id
        $.ui.toast(transcript ? `YouTube: added "${title}" with its transcript` : `YouTube: added "${title}" (no transcript)`)
      } catch (error) {
        $.ui.toast(`YouTube: couldn't read ${id}: ${(error as Error).message}`)
      }
    }

    return next(blocks.length ? { ...e, context: [...(e.context ?? []), ...blocks] } : e)
  })
}
