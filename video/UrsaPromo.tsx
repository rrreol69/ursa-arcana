import type { CSSProperties, ReactNode } from 'react'
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { BearArtwork, UrsaMark, UtilityGlyph } from '../src/Artwork'
import './video.css'

export type UrsaPromoProps = {
  tagline: string
  ctaUrl: string
  socialHandle: string
  testnetLabel: string
}

export const DEFAULT_PROMO_PROPS: UrsaPromoProps = {
  tagline: 'Guard the rare. Unlock its utility.',
  ctaUrl: 'ursa-arcana.vercel.app',
  socialHandle: '@ursaarcana',
  testnetLabel: 'Testnet only.',
}

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const

const SCENES = {
  brand: { from: 0, duration: 240 },
  hero: { from: 180, duration: 330 },
  collections: { from: 450, duration: 300 },
  raffle: { from: 690, duration: 360 },
  auction: { from: 990, duration: 360 },
  lending: { from: 1290, duration: 360 },
  hub: { from: 1590, duration: 330 },
  end: { from: 1860, duration: 240 },
} as const

function fadeScene(frame: number, duration: number, fadeIn = 28, fadeOut = 36) {
  return interpolate(frame, [0, fadeIn, duration - fadeOut, duration], [0, 1, 1, 0], clamp)
}

function enterProgress(frame: number, fps: number, delay = 0, durationInFrames = 48) {
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    durationInFrames,
    config: { damping: 28, stiffness: 135, mass: 0.9 },
  })
}

function SceneShell({
  duration,
  children,
  className = '',
}: {
  duration: number
  children: ReactNode
  className?: string
}) {
  const frame = useCurrentFrame()
  const opacity = fadeScene(frame, duration)

  return (
    <AbsoluteFill className={`ua-scene ${className}`} style={{ opacity }}>
      {children}
    </AbsoluteFill>
  )
}

function CosmicBackdrop() {
  const frame = useCurrentFrame()
  const particles = Array.from({ length: 34 }, (_, index) => {
    const x = random(`particle-x-${index}`) * 100
    const y = random(`particle-y-${index}`) * 100
    const size = 1 + random(`particle-size-${index}`) * 3.2
    const phase = random(`particle-phase-${index}`) * Math.PI * 2
    const opacity = 0.12 + (Math.sin(frame / 32 + phase) + 1) * 0.13
    return { x, y, size, opacity }
  })

  return (
    <AbsoluteFill className="ua-backdrop">
      <div
        className="ua-aurora ua-aurora--one"
        style={{ transform: `translate3d(${Math.sin(frame / 110) * 38}px, ${Math.cos(frame / 145) * 24}px, 0)` }}
      />
      <div
        className="ua-aurora ua-aurora--two"
        style={{ transform: `translate3d(${Math.cos(frame / 130) * 34}px, ${Math.sin(frame / 170) * 28}px, 0)` }}
      />
      <div className="ua-orbit ua-orbit--wide" style={{ transform: `rotate(${frame * 0.018 - 12}deg)` }} />
      <div className="ua-orbit ua-orbit--tall" style={{ transform: `rotate(${-frame * 0.013 + 28}deg)` }} />
      {particles.map((particle, index) => (
        <i
          className="ua-particle"
          key={index}
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            opacity: particle.opacity,
          }}
        />
      ))}
      <div className="ua-vignette" />
      <div className="ua-grain" />
    </AbsoluteFill>
  )
}

function ProductBadge({ children }: { children: ReactNode }) {
  return <div className="ua-product-badge"><i />{children}</div>
}

function BrandReveal({ duration }: { duration: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const mark = enterProgress(frame, fps, 4, 58)
  const copy = enterProgress(frame, fps, 30, 54)
  const line = enterProgress(frame, fps, 54, 62)

  return (
    <SceneShell duration={duration} className="ua-brand-scene">
      <div className="ua-brand-orbit ua-brand-orbit--outer" style={{ transform: `rotate(${frame * 0.16}deg) scale(${0.82 + mark * 0.18})`, opacity: mark * 0.42 }} />
      <div className="ua-brand-orbit ua-brand-orbit--inner" style={{ transform: `rotate(${-frame * 0.22}deg) scale(${0.78 + mark * 0.22})`, opacity: mark * 0.56 }} />
      <div
        className="ua-brand-mark"
        style={{
          opacity: mark,
          transform: `translate3d(0, ${(1 - mark) * 48}px, 0) scale(${0.72 + mark * 0.28})`,
          filter: `blur(${(1 - mark) * 18}px)`,
        }}
      >
        <UrsaMark />
      </div>
      <div
        className="ua-brand-intro"
        style={{ opacity: copy, transform: `translate3d(0, ${(1 - copy) * 28}px, 0)` }}
      >
        <span>URSA ARCANA</span>
        <h1>An NFT utility hub</h1>
        <ProductBadge>Live on Arc Testnet</ProductBadge>
      </div>
      <div className="ua-intro-line" style={{ transform: `scaleX(${line})`, opacity: line }} />
    </SceneShell>
  )
}

function HeroScene({ duration }: { duration: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const copy = enterProgress(frame, fps, 10)
  const card = enterProgress(frame, fps, 22, 64)
  const drift = Math.sin(frame / 38) * 8

  return (
    <SceneShell duration={duration} className="ua-hero-scene">
      <div
        className="ua-hero-copy"
        style={{ opacity: copy, transform: `translate3d(${(1 - copy) * -74}px, 0, 0)` }}
      >
        <ProductBadge>24 original Keepers</ProductBadge>
        <h2>Your collection.<br /><em>In motion.</em></h2>
        <p>Collect through transparent raffles. Compete in fair auctions. Unlock USDC with NFT-backed lending.</p>
      </div>
      <div
        className="ua-hero-art-stage"
        style={{
          opacity: card,
          transform: `perspective(1300px) translate3d(${(1 - card) * 110}px, ${drift}px, 0) rotateY(${-7 + (1 - card) * 12}deg) scale(${0.92 + card * 0.08})`,
        }}
      >
        <div className="ua-hero-art">
          <BearArtwork id={24} hero />
          <div className="ua-art-status"><i /><span><small>GENESIS COLLECTION</small><b>Guardian of Arc</b></span></div>
          <div className="ua-edition">MYTHIC · #024</div>
        </div>
        <div className="ua-card-light" />
      </div>
    </SceneShell>
  )
}

const collectionCards = [
  { id: 1, name: 'Genesis', meta: 'Free mint', color: '#7da4d6' },
  { id: 8, name: 'Blue Hour', meta: '1 USDC', color: '#58b4e8' },
  { id: 14, name: 'Deep Current', meta: '2 USDC', color: '#527fc3' },
  { id: 19, name: 'Night Ledger', meta: '3 USDC', color: '#7974bd' },
]

function CollectionsScene({ duration }: { duration: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const heading = enterProgress(frame, fps, 2)

  return (
    <SceneShell duration={duration} className="ua-collections-scene">
      <header style={{ opacity: heading, transform: `translateY(${(1 - heading) * 32}px)` }}>
        <span>ONE UNIVERSE · FOUR LIVE CHAPTERS</span>
        <h2>Five chapters.<br />One universe.</h2>
      </header>
      <div className="ua-collection-fan">
        {collectionCards.map((collection, index) => {
          const progress = enterProgress(frame, fps, 28 + index * 8, 56)
          const angle = [-10, -3, 4, 11][index]
          const y = [36, 4, 4, 36][index]
          return (
            <div
              className="ua-collection-card"
              key={collection.name}
              style={{
                '--collection-accent': collection.color,
                opacity: progress,
                transform: `translate3d(${(1 - progress) * 72}px, ${y + (1 - progress) * 100}px, 0) rotate(${angle * progress}deg)`,
              } as CSSProperties}
            >
              <div className="ua-collection-art"><BearArtwork id={collection.id} /></div>
              <div className="ua-collection-meta"><span>{collection.name}</span><b>{collection.meta}</b></div>
            </div>
          )
        })}
      </div>
    </SceneShell>
  )
}

function SceneCopy({
  eyebrow,
  title,
  body,
  align = 'left',
  progress,
}: {
  eyebrow: string
  title: string
  body: string
  align?: 'left' | 'right'
  progress: number
}) {
  return (
    <div
      className={`ua-scene-copy ua-scene-copy--${align}`}
      style={{ opacity: progress, transform: `translate3d(${(1 - progress) * (align === 'left' ? -68 : 68)}px, 0, 0)` }}
    >
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  )
}

function ProductWindow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="ua-product-window">
      <div className="ua-window-bar"><div><i /><i /><i /></div><span>{label}</span><b>ARC TESTNET</b></div>
      <div className="ua-window-body">{children}</div>
    </div>
  )
}

function MiniNft({ id, label }: { id: number; label: string }) {
  return (
    <div className="ua-mini-nft">
      <BearArtwork id={id} />
      <span>{label}</span>
    </div>
  )
}

function RaffleScene({ duration }: { duration: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const copy = enterProgress(frame, fps, 6)
  const panel = enterProgress(frame, fps, 20, 58)
  const sold = Math.round(interpolate(frame, [42, 230], [8, 18], clamp))
  const progressWidth = interpolate(sold, [0, 24], [0, 100], clamp)

  return (
    <SceneShell duration={duration} className="ua-utility-scene">
      <SceneCopy
        eyebrow="01 · RAFFLES"
        title="Transparent raffles."
        body="Fixed-price entries. Verifiable outcomes."
        progress={copy}
      />
      <div className="ua-window-stage" style={{ opacity: panel, transform: `translate3d(${(1 - panel) * 110}px, 0, 0) scale(${0.95 + panel * 0.05})` }}>
        <ProductWindow label="RAFFLE #001">
          <MiniNft id={1} label="Keeper of First Light · #001" />
          <div className="ua-utility-panel">
            <div className="ua-panel-heading"><span><small>Entry price</small><b>0.25 USDC</b></span><em>LIVE</em></div>
            <div className="ua-ticket-count"><span>{sold}</span><small>of 24 entries</small></div>
            <div className="ua-progress"><i style={{ width: `${progressWidth}%` }} /></div>
            <div className="ua-commit-row"><span>COMMITMENT</span><code>0x9F2A…73C1</code><b>VERIFIED</b></div>
            <div className="ua-action-button"><span>Enter raffle</span><b>→</b></div>
          </div>
        </ProductWindow>
      </div>
    </SceneShell>
  )
}

function AuctionScene({ duration }: { duration: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const panel = enterProgress(frame, fps, 14, 58)
  const copy = enterProgress(frame, fps, 2)
  const bidIndex = frame < 90 ? 0 : frame < 165 ? 1 : 2
  const bids = ['1.6', '2.1', '2.4']
  const bidHistory = [
    { amount: '1.6 USDC', address: '71B4…2E91' },
    { amount: '2.1 USDC', address: '16A8…C809' },
    { amount: '2.4 USDC', address: '92C1…630B' },
  ].slice(0, bidIndex + 1).reverse()
  const pulse = enterProgress(frame % 75, fps, 0, 26)

  return (
    <SceneShell duration={duration} className="ua-utility-scene ua-utility-scene--reverse">
      <div className="ua-window-stage" style={{ opacity: panel, transform: `translate3d(${(1 - panel) * -110}px, 0, 0) scale(${0.95 + panel * 0.05})` }}>
        <ProductWindow label="AUCTION #001">
          <MiniNft id={2} label="Indigo Cartographer · #002" />
          <div className="ua-utility-panel">
            <div className="ua-panel-heading"><span><small>Highest bid</small><b className="ua-live-bid">{bids[bidIndex]} USDC</b></span><em>04m 18s</em></div>
            <div className="ua-bid-stack">
              {bidHistory.map((bid, index) => (
                <div key={bid.amount} className={index === 0 ? 'is-current' : ''} style={{ opacity: 0.92 - index * 0.22 }}>
                  <span>0x{bid.address}</span><b>{bid.amount}</b>
                </div>
              ))}
            </div>
            <div className="ua-bid-pulse" style={{ opacity: 0.18 + pulse * 0.48, transform: `scaleX(${0.55 + pulse * 0.45})` }} />
            <div className="ua-action-button"><span>Place bid</span><b>→</b></div>
          </div>
        </ProductWindow>
      </div>
      <SceneCopy
        eyebrow="02 · AUCTIONS"
        title="Onchain auctions."
        body="Bid in USDC. Settle transparently."
        align="right"
        progress={copy}
      />
    </SceneShell>
  )
}

function LendingScene({ duration }: { duration: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const copy = enterProgress(frame, fps, 4)
  const panel = enterProgress(frame, fps, 18, 58)
  const lock = enterProgress(frame, fps, 82, 64)
  const flow = interpolate(frame, [92, 225], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })

  return (
    <SceneShell duration={duration} className="ua-utility-scene">
      <SceneCopy
        eyebrow="03 · LENDING"
        title="NFT-backed lending."
        body="Unlock utility without letting go."
        progress={copy}
      />
      <div className="ua-window-stage" style={{ opacity: panel, transform: `translate3d(${(1 - panel) * 110}px, 0, 0) scale(${0.95 + panel * 0.05})` }}>
        <ProductWindow label="LOAN REQUEST #003">
          <div className="ua-escrow-stage">
            <div className="ua-escrow-nft" style={{ transform: `translate3d(${lock * 88}px, 0, 0) scale(${1 - lock * 0.12})` }}>
              <MiniNft id={3} label="The Quiet Oracle · #003" />
            </div>
            <div className="ua-escrow-vault" style={{ opacity: lock, transform: `scale(${0.88 + lock * 0.12})` }}>
              <span>ESCROW</span>
              <UtilityGlyph type="lend" />
              <b>{lock > 0.88 ? 'LOCKED' : 'VERIFYING'}</b>
            </div>
            <div className="ua-usdc-flow" style={{ '--flow': flow } as CSSProperties}><i /><i /><i /><span>3 USDC</span></div>
          </div>
          <div className="ua-loan-terms">
            <span><small>Principal</small><b>3.0 USDC</b></span>
            <span><small>Fixed interest</small><b>0.3 USDC</b></span>
            <span><small>Term</small><b>7 days</b></span>
            <em>READY TO FUND</em>
          </div>
        </ProductWindow>
      </div>
    </SceneShell>
  )
}

const utilities = [
  { type: 'raffle' as const, title: 'Collect', note: 'Transparent raffles', accent: '#70b7e9' },
  { type: 'auction' as const, title: 'Compete', note: 'Onchain auctions', accent: '#8d9fe0' },
  { type: 'lend' as const, title: 'Unlock', note: 'NFT-backed lending', accent: '#77c7b1' },
]

function HubScene({ duration }: { duration: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const copy = enterProgress(frame, fps, 8)

  return (
    <SceneShell duration={duration} className="ua-hub-scene">
      <div className="ua-hub-heading" style={{ opacity: copy, transform: `translateY(${(1 - copy) * 34}px)` }}>
        <span>ONE HUB · THREE PATHS</span>
        <h2>Collect. Compete. Unlock.</h2>
      </div>
      <div className="ua-utility-triad">
        {utilities.map((utility, index) => {
          const progress = enterProgress(frame, fps, 34 + index * 14, 58)
          return (
            <div
              className="ua-utility-tile"
              key={utility.title}
              style={{
                '--tile-accent': utility.accent,
                opacity: progress,
                transform: `translateY(${(1 - progress) * 90}px) scale(${0.9 + progress * 0.1})`,
              } as CSSProperties}
            >
              <div><UtilityGlyph type={utility.type} /></div>
              <span>0{index + 1}</span>
              <h3>{utility.title}</h3>
              <p>{utility.note}</p>
            </div>
          )
        })}
      </div>
      <div className="ua-chain-line" style={{ transform: `scaleX(${enterProgress(frame, fps, 92, 72)})` }}><span>ARC TESTNET · CHAIN 5,042,002</span></div>
    </SceneShell>
  )
}

function EndScene({ duration, tagline, ctaUrl, socialHandle, testnetLabel }: { duration: number } & UrsaPromoProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const mark = enterProgress(frame, fps, 2, 50)
  const copy = enterProgress(frame, fps, 22, 54)
  const links = enterProgress(frame, fps, 54, 54)

  return (
    <SceneShell duration={duration} className="ua-end-scene">
      <div className="ua-end-mark" style={{ opacity: mark, transform: `scale(${0.74 + mark * 0.26}) rotate(${(1 - mark) * -8}deg)` }}>
        <UrsaMark />
      </div>
      <div className="ua-end-brand" style={{ opacity: copy, transform: `translateY(${(1 - copy) * 30}px)` }}>
        <span>URSA ARCANA</span>
        <h2>{tagline}</h2>
      </div>
      <div className="ua-end-links" style={{ opacity: links, transform: `translateY(${(1 - links) * 22}px)` }}>
        <b>{ctaUrl}</b>
        <i />
        <b>{socialHandle}</b>
      </div>
      <div className="ua-testnet-note" style={{ opacity: links }}><span>{testnetLabel}</span><em>Built on Arc Testnet</em></div>
    </SceneShell>
  )
}

function Soundtrack() {
  const duration = 2100

  return (
    <>
      <Audio
        src={staticFile('video/audio/close-up.mp3')}
        volume={(frame) => 0.86 * interpolate(frame, [0, 36, duration - 54, duration], [0, 1, 1, 0], clamp)}
      />
      <Sequence from={0} durationInFrames={150}><Audio src={staticFile('video/sfx/logo-swell.wav')} volume={0.22} /></Sequence>
      {[450, 690, 990, 1290, 1590].map((from) => (
        <Sequence from={from} durationInFrames={72} key={from}><Audio src={staticFile('video/sfx/transition-tick.wav')} volume={0.15} /></Sequence>
      ))}
      <Sequence from={1860} durationInFrames={180}><Audio src={staticFile('video/sfx/end-chime.wav')} volume={0.2} /></Sequence>
    </>
  )
}

export function UrsaArcanaXPromo(props: UrsaPromoProps) {
  return (
    <AbsoluteFill className="ua-video">
      <CosmicBackdrop />
      <Sequence from={SCENES.brand.from} durationInFrames={SCENES.brand.duration}><BrandReveal duration={SCENES.brand.duration} /></Sequence>
      <Sequence from={SCENES.hero.from} durationInFrames={SCENES.hero.duration}><HeroScene duration={SCENES.hero.duration} /></Sequence>
      <Sequence from={SCENES.collections.from} durationInFrames={SCENES.collections.duration}><CollectionsScene duration={SCENES.collections.duration} /></Sequence>
      <Sequence from={SCENES.raffle.from} durationInFrames={SCENES.raffle.duration}><RaffleScene duration={SCENES.raffle.duration} /></Sequence>
      <Sequence from={SCENES.auction.from} durationInFrames={SCENES.auction.duration}><AuctionScene duration={SCENES.auction.duration} /></Sequence>
      <Sequence from={SCENES.lending.from} durationInFrames={SCENES.lending.duration}><LendingScene duration={SCENES.lending.duration} /></Sequence>
      <Sequence from={SCENES.hub.from} durationInFrames={SCENES.hub.duration}><HubScene duration={SCENES.hub.duration} /></Sequence>
      <Sequence from={SCENES.end.from} durationInFrames={SCENES.end.duration}><EndScene duration={SCENES.end.duration} {...props} /></Sequence>
      <Soundtrack />
    </AbsoluteFill>
  )
}
