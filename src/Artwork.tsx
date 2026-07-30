import type { CSSProperties } from 'react'

const palettes = [
  ['#111d3a', '#2f578c', '#acc6e9', '#d8e8f7'],
  ['#10283e', '#286b9d', '#74c2ec', '#c9e4f5'],
  ['#1d2448', '#4f68b2', '#99bce8', '#d7e2f6'],
  ['#112d43', '#2f7895', '#88cee2', '#d0eaf3'],
  ['#20214a', '#626db4', '#a8b9ed', '#dce3fa'],
  ['#16243d', '#427ca0', '#b9d8f3', '#e0edf8'],
]

export function UrsaMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`ursa-mark ${compact ? 'ursa-mark--compact' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <path className="ursa-mark__head" d="M8 9.5 23 13l9 6 9-6 15-3.5-4.5 16L54 37 47 51 32 59 17 51 10 37l2.5-11.5Z" />
        <path className="ursa-mark__detail" d="m14.5 15.5 8.5 2.2-7.1 6.4Zm35 0-8.5 2.2 7.1 6.4ZM19.2 32l9 2.4-7.4 3.8Zm25.6 0-9 2.4 7.4 3.8Z" />
        <path className="ursa-mark__muzzle" d="M23.5 42.5 32 38l8.5 4.5-2.2 8L32 54l-6.3-3.5Z" />
        <path className="ursa-mark__nose" d="m28.5 43.2 3.5-1.8 3.5 1.8-1.1 3.2H29.6Z" />
        <path className="ursa-mark__star" d="m32 22 1.8 3.2L37 27l-3.2 1.8L32 32l-1.8-3.2L27 27l3.2-1.8Z" />
      </svg>
    </span>
  )
}

export function BearArtwork({ id, className = '', hero = false }: { id: number; className?: string; hero?: boolean }) {
  const p = palettes[(id - 1) % palettes.length]
  const tilt = ((id * 7) % 13) - 6
  const uid = `bear-${id}-${hero ? 'hero' : 'card'}`
  const style = { '--art-tilt': `${tilt}deg` } as CSSProperties

  return (
    <svg className={`bear-art ${className}`} style={style} viewBox="0 0 600 720" role="img" aria-label="Original cosmic bear artwork">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p[0]} />
          <stop offset="0.58" stopColor={p[1]} />
          <stop offset="1" stopColor="#080a12" />
        </linearGradient>
        <radialGradient id={`${uid}-halo`} cx="50%" cy="42%" r="48%">
          <stop offset="0" stopColor={p[2]} stopOpacity=".72" />
          <stop offset=".52" stopColor={p[1]} stopOpacity=".24" />
          <stop offset="1" stopColor={p[0]} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-fur`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#eef4fa" />
          <stop offset=".48" stopColor="#bbc9d8" />
          <stop offset="1" stopColor="#626f82" />
        </linearGradient>
        <linearGradient id={`${uid}-cloak`} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor={p[1]} />
          <stop offset="1" stopColor={p[0]} />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <filter id={`${uid}-grain`}>
          <feTurbulence baseFrequency=".8" numOctaves="3" seed={id} stitchTiles="stitch" result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" result="grain" />
          <feBlend in="SourceGraphic" in2="grain" mode="soft-light" />
        </filter>
      </defs>
      <rect width="600" height="720" rx={hero ? 0 : 18} fill={`url(#${uid}-bg)`} />
      <circle cx="300" cy="310" r="250" fill={`url(#${uid}-halo)`} />
      <g opacity=".8" fill={p[2]}>
        <circle cx={70 + (id * 19) % 80} cy="96" r="2" />
        <circle cx={420 + (id * 11) % 90} cy="126" r="3" />
        <circle cx={84 + (id * 7) % 120} cy="338" r="1.6" />
        <circle cx={402 + (id * 17) % 100} cy="392" r="2" />
        <circle cx={112 + (id * 31) % 310} cy="54" r="1.5" />
      </g>
      <g fill="none" stroke={p[2]} opacity=".32">
        <circle cx="300" cy="286" r="218" strokeWidth="1" />
        <ellipse cx="300" cy="286" rx="267" ry="92" transform={`rotate(${tilt} 300 286)`} />
        <path d="M62 260c106-38 370-38 476 0M108 165c96 42 288 42 384 0" />
      </g>
      <path d="M72 720c23-177 108-263 228-263s205 86 228 263Z" fill={`url(#${uid}-cloak)`} />
      <path d="M181 503c-27 36-44 94-52 174h342c-8-80-25-138-52-174-31 42-70 66-119 66s-88-24-119-66Z" fill="#0d101b" opacity=".48" />
      <g filter={`url(#${uid}-grain)`}>
        <circle cx="205" cy="270" r="70" fill="#75859a" />
        <circle cx="395" cy="270" r="70" fill="#75859a" />
        <circle cx="205" cy="270" r="42" fill="#34445b" />
        <circle cx="395" cy="270" r="42" fill="#34445b" />
        <path d="M152 339c0-116 63-193 148-193s148 77 148 193c0 108-65 191-148 191s-148-83-148-191Z" fill={`url(#${uid}-fur)`} />
        <path d="M194 302c10-42 45-69 106-69s96 27 106 69c-23-20-58-30-106-30s-83 10-106 30Z" fill="#d6e1ec" opacity=".42" />
        <ellipse cx="300" cy="399" rx="92" ry="76" fill="#b5c7d8" />
        <path d="M268 380c0-18 13-29 32-29s32 11 32 29c0 15-14 29-32 29s-32-14-32-29Z" fill="#211f27" />
        <path d="M300 406v28m0 0c-16 0-29-7-37-17m37 17c16 0 29-7 37-17" fill="none" stroke="#39323a" strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="239" cy="341" rx="13" ry="17" fill="#191820" />
        <ellipse cx="361" cy="341" rx="13" ry="17" fill="#191820" />
        <circle cx="243" cy="336" r="4" fill={p[2]} />
        <circle cx="365" cy="336" r="4" fill={p[2]} />
      </g>
      <g stroke={p[3]} fill="none" strokeLinecap="round">
        <path d="M217 224c49-42 117-42 166 0" strokeWidth="10" />
        <path d="M188 245c73-70 151-70 224 0" strokeWidth="3" />
        <path d="M300 174v-36m-17 18 17-18 17 18" strokeWidth="4" />
      </g>
      <circle cx="300" cy="138" r="8" fill={p[3]} filter={`url(#${uid}-glow)`} />
      <circle cx="300" cy="138" r="5" fill="#e7f3ff" />
      <g transform="translate(300 594)">
        <circle r="36" fill="#0c0f18" stroke={p[3]} strokeWidth="3" />
        <path d="M-16 13C-11-6-5-19 0-26 5-19 11-6 16 13M-22 15h44" fill="none" stroke={p[3]} strokeWidth="3" />
      </g>
      <path d="M18 18h72M18 18v72M582 18h-72M582 18v72M18 702h72M18 702v-72M582 702h-72M582 702v-72" fill="none" stroke={p[3]} strokeWidth="2" opacity=".65" />
    </svg>
  )
}

export function UtilityGlyph({ type }: { type: 'raffle' | 'auction' | 'lend' }) {
  if (type === 'raffle') {
    return <svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="62"/><path d="M45 79h90v55H45zM56 60h68v19H56zM90 48v86M66 60c0-20 24-21 24 0M114 60c0-20-24-21-24 0"/></svg>
  }
  if (type === 'auction') {
    return <svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="62"/><path d="m55 68 24-24 33 33-24 24zM97 92l31 31M109 116l12-12 19 19-12 12zM43 136h74"/></svg>
  }
  return <svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="62"/><path d="M51 80h78v55H51zM62 80V66c0-22 14-36 28-36s28 14 28 36v14M74 107h32M90 96v23"/></svg>
}
