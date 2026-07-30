import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const input = resolve(process.argv[2] ?? 'renders/ursa-arcana-x-promo-1080p60.mp4')
if (!existsSync(input)) {
  throw new Error(`Video not found: ${input}`)
}

const raw = execFileSync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,pix_fmt',
  '-of', 'json',
  input,
], { encoding: 'utf8' })

const probe = JSON.parse(raw)
const video = probe.streams.find((stream) => stream.codec_type === 'video')
const audio = probe.streams.find((stream) => stream.codec_type === 'audio')
const duration = Number(probe.format.duration)

const checks = [
  ['duration is 35 seconds', Math.abs(duration - 35) < 0.03],
  ['video is H.264', video?.codec_name === 'h264'],
  ['resolution is 1920x1080', video?.width === 1920 && video?.height === 1080],
  ['framerate is 60fps', video?.r_frame_rate === '60/1'],
  ['pixel format is yuv420p', video?.pix_fmt === 'yuv420p'],
  ['audio is AAC', audio?.codec_name === 'aac'],
  ['audio is stereo 48kHz', audio?.channels === 2 && audio?.sample_rate === '48000'],
]

for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`)
}

if (checks.some(([, passed]) => !passed)) {
  process.exitCode = 1
}
