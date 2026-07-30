import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const sampleRate = 48_000
const outputDir = join(process.cwd(), 'public', 'video', 'sfx')
mkdirSync(outputDir, { recursive: true })

function writeWav(filename, duration, generator) {
  const frames = Math.ceil(duration * sampleRate)
  const channels = 2
  const bytesPerSample = 2
  const dataSize = frames * channels * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28)
  buffer.writeUInt16LE(channels * bytesPerSample, 32)
  buffer.writeUInt16LE(bytesPerSample * 8, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let frame = 0; frame < frames; frame += 1) {
    const time = frame / sampleRate
    const [left, right] = generator(time, duration)
    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(left * 32767))), 44 + frame * 4)
    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(right * 32767))), 46 + frame * 4)
  }

  writeFileSync(join(outputDir, filename), buffer)
}

const smooth = (value) => value * value * (3 - 2 * value)

writeWav('logo-swell.wav', 2.25, (time, duration) => {
  const progress = time / duration
  const attack = smooth(Math.min(1, progress * 2.2))
  const release = smooth(Math.min(1, (1 - progress) * 1.6))
  const envelope = attack * release
  const sweep = 105 + progress * 210
  const shimmer = Math.sin(Math.PI * 2 * (sweep * time + progress * 18))
  const low = Math.sin(Math.PI * 2 * 54 * time) * 0.38
  const signal = (shimmer * 0.22 + low) * envelope * 0.46
  return [signal * (0.92 + progress * 0.08), signal * (1 - progress * 0.06)]
})

writeWav('transition-tick.wav', 0.62, (time, duration) => {
  const progress = time / duration
  const envelope = Math.exp(-progress * 8.5)
  const click = Math.sin(Math.PI * 2 * (520 - progress * 170) * time)
  const air = Math.sin(Math.PI * 2 * 2_800 * time) * Math.exp(-progress * 18)
  const signal = (click * 0.56 + air * 0.15) * envelope * 0.42
  return [signal, signal * 0.94]
})

writeWav('end-chime.wav', 2.5, (time, duration) => {
  const progress = time / duration
  const envelope = Math.exp(-progress * 3.4)
  const fundamental = Math.sin(Math.PI * 2 * 392 * time)
  const fifth = Math.sin(Math.PI * 2 * 588 * time) * 0.54
  const octave = Math.sin(Math.PI * 2 * 784 * time) * 0.22
  const signal = (fundamental + fifth + octave) * envelope * 0.22
  return [signal * 0.96, signal]
})

console.log(`Generated original video sound accents in ${outputDir}`)
