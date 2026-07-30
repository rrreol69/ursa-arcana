import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  Gavel,
  Gem,
  HandCoins,
  Landmark,
  Menu,
  Network,
  Plus,
  ShieldCheck,
  Sparkles,
  Ticket,
  Wallet,
  X,
} from 'lucide-react'
import {
  createContext,
  type PropsWithChildren,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import { Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { bytesToHex, encodePacked, formatUnits, keccak256, parseUnits, zeroAddress, type Address } from 'viem'
import { useAccount, useBalance, useConnect, useDisconnect, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { BearArtwork, UrsaMark, UtilityGlyph } from './Artwork'
import { addresses, auctionAbi, collectionCatalog, collectionForAddress, erc20Abi, lendingAbi, nftAbi, raffleAbi, type CollectionConfig } from './contracts'
import { nfts } from './data'
import { useAuctions, useCollectionMintStatus, useLoans, useNftSupply, useOwnedNfts, useRaffles, type ChainAuction, type ChainLoan, type ChainRaffle, type OwnedArtifact } from './onchain'
import { arcTestnet, USDC_ADDRESS } from './wallet'

type ActionContextValue = {
  runAction: (label: string, success: string, transaction?: ContractAction) => Promise<boolean>
  openWallet: () => void
}

type ContractAction =
  | { kind: 'mint'; quantity: number }
  | { kind: 'mintCollection'; nftContract: Address; quantity: number; amount: bigint }
  | { kind: 'raffle'; id?: number; quantity: number; amount: bigint }
  | { kind: 'auction'; id?: number; amount: bigint }
  | { kind: 'lending'; id?: number; amount: bigint }
  | { kind: 'createRaffle'; nftContract: Address; tokenId: number; ticketPrice: bigint; maxTickets: number; endAt: number; commitment: `0x${string}` }
  | { kind: 'createAuction'; nftContract: Address; tokenId: number; startAt: number; endAt: number; reservePrice: bigint }
  | { kind: 'createLoan'; nftContract: Address; tokenId: number; principal: bigint; interest: bigint; fundingDeadline: number; duration: number }
  | { kind: 'raffleLifecycle'; id: number; functionName: 'revealWinner' | 'cancelUnrevealed' | 'claimPrize' | 'claimProceeds' | 'claimRefund'; secret?: `0x${string}` }
  | { kind: 'auctionLifecycle'; id: number; functionName: 'withdrawBid' | 'cancelAuction' | 'settleAuction' | 'claimNFT' | 'claimProceeds' }
  | { kind: 'loanLifecycle'; id: number; functionName: 'cancelLoanRequest' | 'repayLoan' | 'claimLenderRepayment' | 'claimBorrowerCollateral' | 'claimDefaultCollateral'; amount?: bigint }

const ActionContext = createContext<ActionContextValue>({ runAction: async () => false, openWallet: () => undefined })
function useActions() {
  return useContext(ActionContext)
}

const sameAddress = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase())
const usdcValue = (value: bigint) => Number(formatUnits(value, 6))
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
const countdown = (timestamp: number) => {
  const seconds = Math.max(0, timestamp - Math.floor(Date.now() / 1000))
  if (seconds === 0) return 'Ended'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
const formatDuration = (seconds: number) => seconds < 86_400 ? `${Math.round(seconds / 3_600)} ${seconds === 3_600 ? 'hour' : 'hours'}` : `${Math.round(seconds / 86_400)} ${seconds === 86_400 ? 'day' : 'days'}`
const formatTimestamp = (timestamp: number) => new Date(timestamp * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const loanStatus = (loan: ChainLoan) => {
  const now = Date.now() / 1000
  if (loan.state === 0) return now > loan.fundingDeadline ? 'Funding expired' : 'Awaiting lender'
  if (loan.state === 1) return now > loan.dueAt ? 'Overdue' : 'Active'
  return ['Repaid', 'Cancelled', 'Defaulted'][loan.state - 2]
}
const collectionName = (address?: string) => collectionForAddress(address)?.name ?? (address ? `Collection ${shortAddress(address)}` : 'Unknown collection')

function CollectionBadge({ address }: { address?: string }) {
  return <span className="collection-badge">{collectionName(address)}</span>
}

function CollectionGroups<T extends { nftContract: Address }>({ items, render }: { items: T[]; render: (item: T) => ReactNode }) {
  const groups = collectionCatalog.map(collection => ({ collection, items: items.filter(item => sameAddress(item.nftContract, collection.contract)) })).filter(group => group.items.length)
  const knownAddresses = new Set(collectionCatalog.map(collection => collection.contract?.toLowerCase()).filter(Boolean))
  const unknown = items.filter(item => !knownAddresses.has(item.nftContract.toLowerCase()))
  if (unknown.length) groups.push({ collection: { id: 'legacy', name: 'Unregistered collection', shortName: 'Unregistered', contract: undefined, mintPrice: null, mintable: false, description: 'This collection is not configured in the current frontend.', accent: 'slate' }, items: unknown })
  return <div className="collection-groups">{groups.map(group => <section className="collection-group" key={group.collection.id}><div className="collection-group__head"><div><span className="eyebrow">NFT collection</span><h3>{group.collection.name}</h3><p>{group.collection.contract ? `${group.collection.description} · ${shortAddress(group.collection.contract)}` : group.collection.description}</p></div><CollectionBadge address={group.collection.contract} /></div><div className="card-grid card-grid--three">{group.items.map(render)}</div></section>)}</div>
}

function LoadingState({ label = 'Reading Arc Testnet' }: { label?: string }) {
  return <div className="empty-tab"><span className="spinner" /><h3>{label}</h3><p>Querying the latest confirmed contract state.</p></div>
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-tab"><UrsaMark compact /><h3>{title}</h3><p>{copy}</p></div>
}

type TimeUnit = 'hours' | 'days'

function DurationFields({ label, unit, value, hint, onUnitChange, onValueChange }: { label: string; unit: TimeUnit; value: number; hint?: string; onUnitChange: (unit: TimeUnit) => void; onValueChange: (value: number) => void }) {
  const options = unit === 'hours' ? [1, 4, 12] : [1, 3, 7, 14]
  return (
    <div className="duration-fields">
      <label><span>{label} unit</span><select value={unit} onChange={event => { const nextUnit = event.target.value as TimeUnit; onUnitChange(nextUnit); onValueChange(nextUnit === 'hours' ? 1 : 1) }}><option value="hours">Hours</option><option value="days">Days</option></select></label>
      <label><span>{label}</span><select value={value} onChange={event => onValueChange(Number(event.target.value))}>{options.map(option => <option value={option} key={option}>{option} {unit === 'hours' ? (option === 1 ? 'hour' : 'hours') : (option === 1 ? 'day' : 'days')}</option>)}</select></label>
      {hint && <p className="duration-hint">{hint}</p>}
    </div>
  )
}

function ScrollRestoration() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status status--${status.toLowerCase().replace(/\s+/g, '-')}`}><i />{status}</span>
}

function SectionHead({ eyebrow, title, copy, link, linkText = 'View all' }: { eyebrow: string; title: string; copy?: string; link?: string; linkText?: string }) {
  return (
    <div className="section-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {copy && <p>{copy}</p>}
      </div>
      {link && <Link className="text-link" to={link}>{linkText}<ArrowRight size={15} /></Link>}
    </div>
  )
}

function NFTCard({ nftId, children, to }: PropsWithChildren<{ nftId: number; to: string }>) {
  const nft = nfts[nftId - 1]
  return (
    <Link className="nft-card" to={to}>
      <div className="nft-card__art"><BearArtwork id={nft.id} /></div>
      <div className="nft-card__body">
        <div className="nft-card__title"><div><span>Ursa Arcana #{String(nft.id).padStart(2, '0')}</span><strong>{nft.name}</strong></div><ArrowUpRight size={18} /></div>
        {children}
      </div>
    </Link>
  )
}

function ChainRaffleCard({ raffle }: { raffle: ChainRaffle }) {
  const active = raffle.state === 0
  const status = active ? (raffle.endAt <= Date.now() / 1000 ? 'Awaiting reveal' : 'Live') : raffle.state === 1 ? 'Revealed' : raffle.state === 2 ? 'Refunding' : 'Closed'
  return (
    <NFTCard nftId={raffle.tokenId} to={`/raffles/${raffle.id}`}>
      <div className="card-status-row"><StatusPill status={status} /><span><Clock3 size={13} />{active ? countdown(raffle.endAt) : status}</span></div>
      <CollectionBadge address={raffle.nftContract} />
      <div className="metric-pair"><div><small>Ticket price</small><b>{usdcValue(raffle.ticketPrice)} <em>USDC</em></b></div><div><small>Tickets sold</small><b>{raffle.ticketsSold}<em> / {raffle.maxTickets}</em></b></div></div>
      <div className="progress"><i style={{ width: `${raffle.ticketsSold / raffle.maxTickets * 100}%` }} /></div>
    </NFTCard>
  )
}

function ChainAuctionCard({ auction }: { auction: ChainAuction }) {
  const status = auction.state === 0 ? 'Pending' : auction.state === 1 ? (auction.endAt <= Date.now() / 1000 ? 'Ready to settle' : 'Live') : auction.state === 2 ? (auction.sold ? 'Sold' : 'No sale') : 'Cancelled'
  return (
    <NFTCard nftId={auction.tokenId} to={`/auctions/${auction.id}`}>
      <div className="card-status-row"><StatusPill status={status} /><span><Clock3 size={13} />{auction.state < 2 ? countdown(auction.endAt) : status}</span></div>
      <CollectionBadge address={auction.nftContract} />
      <div className="metric-pair"><div><small>Current bid</small><b>{usdcValue(auction.highestBid)} <em>USDC</em></b></div><div><small>Reserve</small><b>{usdcValue(auction.reservePrice)} <em>USDC</em></b></div></div>
    </NFTCard>
  )
}

function ChainLoanCard({ loan }: { loan: ChainLoan }) {
  const nft = nfts[loan.tokenId - 1]
  const status = loanStatus(loan)
  const deadline = loan.state === 0 ? loan.fundingDeadline : loan.dueAt
  return (
    <Link className="loan-card" to={`/lend/${loan.id}`}>
      <div className="loan-card__art"><BearArtwork id={loan.tokenId} /></div>
      <div className="loan-card__content">
        <div className="card-status-row"><StatusPill status={status} /><span>Loan #{loan.id}</span></div>
        <CollectionBadge address={loan.nftContract} />
        <span className="overline">Ursa Arcana #{String(loan.tokenId).padStart(2, '0')}</span>
        <h3>{nft.name}</h3>
        <div className="loan-figures"><div><small>Borrower receives</small><b>{usdcValue(loan.principal)} USDC</b></div><div><small>Fixed interest</small><b>+{usdcValue(loan.interest)} USDC</b></div></div>
        <div className="loan-meta"><span><Clock3 size={14} />{formatDuration(loan.duration)} repayment term</span><span>{loan.state === 0 ? (deadline > Date.now() / 1000 ? `Funding ${countdown(deadline)}` : 'Return NFT available') : loan.state === 1 ? (deadline > Date.now() / 1000 ? `Due ${countdown(deadline)}` : 'Collateral claimable') : status}</span></div>
      </div>
      <ArrowUpRight className="loan-card__arrow" size={18} />
    </Link>
  )
}

function CreatePositionModal({ type, artifacts, initialArtifact, onClose }: { type: 'raffle' | 'auction' | 'loan' | 'choose'; artifacts: OwnedArtifact[]; initialArtifact?: OwnedArtifact; onClose: () => void }) {
  const { runAction } = useActions()
  const [selectedType, setSelectedType] = useState(type === 'choose' ? 'raffle' : type)
  const [artifactKey, setArtifactKey] = useState(initialArtifact ? `${initialArtifact.collection}:${initialArtifact.tokenId}` : artifacts[0] ? `${artifacts[0].collection}:${artifacts[0].tokenId}` : '')
  const [price, setPrice] = useState(selectedType === 'raffle' ? 0.2 : selectedType === 'auction' ? 0.5 : 1)
  const [interest, setInterest] = useState(0.1)
  const [durationUnit, setDurationUnit] = useState<TimeUnit>('days')
  const [durationValue, setDurationValue] = useState(7)
  const [termUnit, setTermUnit] = useState<TimeUnit>('days')
  const [termValue, setTermValue] = useState(7)
  const [maxTickets, setMaxTickets] = useState(20)

  useEffect(() => {
    setPrice(selectedType === 'raffle' ? 0.2 : selectedType === 'auction' ? 0.5 : 1)
  }, [selectedType])

  const submit = async () => {
    const now = Math.floor(Date.now() / 1000)
    const artifact = artifacts.find(item => `${item.collection}:${item.tokenId}` === artifactKey)
    if (!artifact) return
    const durationSeconds = durationValue * (durationUnit === 'hours' ? 3_600 : 86_400)
    const termSeconds = termValue * (termUnit === 'hours' ? 3_600 : 86_400)
    const startAt = selectedType === 'auction' ? now + 120 : now
    const endAt = startAt + durationSeconds
    if (selectedType === 'raffle') {
      const secret = bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
      const commitment = keccak256(secret)
      localStorage.setItem(`ursa:raffle-secret:${commitment}`, secret)
      if (await runAction('Creating raffle', 'Raffle created', { kind: 'createRaffle', nftContract: artifact.collection, tokenId: artifact.tokenId, ticketPrice: parseUnits(String(price), 6), maxTickets, endAt, commitment })) onClose()
    } else if (selectedType === 'auction') {
      if (await runAction('Creating auction', 'Auction created', { kind: 'createAuction', nftContract: artifact.collection, tokenId: artifact.tokenId, startAt, endAt, reservePrice: parseUnits(String(price), 6) })) onClose()
    } else {
      if (await runAction('Creating loan request', 'Loan request created', { kind: 'createLoan', nftContract: artifact.collection, tokenId: artifact.tokenId, principal: parseUnits(String(price), 6), interest: parseUnits(String(interest), 6), fundingDeadline: endAt, duration: termSeconds })) onClose()
    }
  }

  const total = selectedType === 'loan' ? price + interest : price
  const invalid = !artifactKey || price <= 0 || price > 5 || durationValue < 1 || termValue < 1 || (selectedType === 'loan' && (interest < 0 || total > 5))
  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="wallet-modal create-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close create position dialog"><X size={18} /></button>
        <span className="eyebrow">New onchain position</span><h2>{selectedType === 'loan' ? 'Request a loan' : `Create ${selectedType}`}</h2>
        {type === 'choose' && <div className="create-type"><button className={selectedType === 'raffle' ? 'active' : ''} onClick={() => setSelectedType('raffle')}>Raffle</button><button className={selectedType === 'auction' ? 'active' : ''} onClick={() => setSelectedType('auction')}>Auction</button><button className={selectedType === 'loan' ? 'active' : ''} onClick={() => setSelectedType('loan')}>Loan</button></div>}
        {artifacts.length === 0 ? <EmptyState title="No available artifacts" copy="Mint an NFT or wait until an escrowed position closes." /> : <div className="create-form">
          <label><span>Collateral artifact</span><select value={artifactKey} onChange={event => setArtifactKey(event.target.value)}>{artifacts.map(artifact => <option value={`${artifact.collection}:${artifact.tokenId}`} key={`${artifact.collection}:${artifact.tokenId}`}>#{String(artifact.tokenId).padStart(2, '0')} · {nfts[artifact.tokenId - 1].name}{artifact.legacy ? ' · Legacy' : ''}</option>)}</select></label>
          <label><span>{selectedType === 'raffle' ? 'Ticket price · max 5 USDC' : selectedType === 'auction' ? 'Reserve price · max 5 USDC' : 'Amount you receive if funded'}</span><input type="number" min="0.01" max="5" step="0.01" value={price} onChange={event => setPrice(Number(event.target.value))} /></label>
          {selectedType === 'raffle' && <label><span>Maximum tickets</span><input type="number" min="1" max="500" value={maxTickets} onChange={event => setMaxTickets(Math.min(500, Math.max(1, Number(event.target.value))))} /></label>}
          {selectedType === 'loan' && <label><span>Fixed interest you pay · flat USDC amount</span><input type="number" min="0" max="5" step="0.01" value={interest} onChange={event => setInterest(Number(event.target.value))} /></label>}
          <DurationFields label={selectedType === 'loan' ? 'Time to find a lender' : 'Duration'} unit={durationUnit} value={durationValue} hint={selectedType === 'loan' ? 'Your NFT stays in escrow while the request is open. No USDC moves until another wallet funds it.' : undefined} onUnitChange={setDurationUnit} onValueChange={setDurationValue} />
          {selectedType === 'loan' && <DurationFields label="Time to repay after funding" unit={termUnit} value={termValue} hint="This clock starts only when a lender sends the principal. It does not start when you publish the request." onUnitChange={setTermUnit} onValueChange={setTermValue} />}
          {selectedType === 'loan' && <div className="loan-cashflow"><div><span>Publish request</span><b>NFT locked · 0 USDC received</b></div><div><span>If a lender funds it</span><b>You receive {price.toFixed(2)} USDC</b></div><div><span>Amount due by deadline</span><b>{total.toFixed(2)} USDC</b></div></div>}
          <button className="button button--primary button--wide" disabled={invalid} onClick={submit}>{selectedType === 'loan' ? 'Lock NFT & publish request' : 'Approve NFT & create'} <ArrowRight size={16} /></button>
          <p className="action-note"><ShieldCheck size={14} />{selectedType === 'loan' ? 'Publishing only escrows the NFT. Your USDC balance changes after funding, repayment, or gas.' : 'Your wallet will request NFT approval first, then the escrow transaction.'}</p>
        </div>}
      </section>
    </div>
  )
}

function FilterTabs({ value, onChange, counts, options }: { value: string; onChange: (value: string) => void; counts: Record<string, number>; options: string[] }) {
  return (
    <div className="filter-tabs" role="tablist">
      {options.map(option => <button className={value === option ? 'active' : ''} onClick={() => onChange(option)} key={option}>{option}<span>{counts[option] ?? 0}</span></button>)}
    </div>
  )
}

function PageIntro({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return (
    <section className="page-intro wrap">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>
      {action}
    </section>
  )
}

function EmptyRoute() {
  return (
    <main className="empty-route wrap">
      <UrsaMark />
      <span className="eyebrow">Page not found</span>
      <h1>There is nothing here.</h1>
      <Link className="button button--primary" to="/">Return home</Link>
    </main>
  )
}

function MintCollectionCard({ collection }: { collection: CollectionConfig }) {
  const { address } = useAccount()
  const { openWallet, runAction } = useActions()
  const { data: status, isLoading } = useCollectionMintStatus(collection, address)
  const [quantity, setQuantity] = useState(1)
  const price = status?.mintPrice ?? collection.mintPrice ?? 0n
  const unavailable = !collection.contract || !status || status.supply >= status.maxSupply || status.minted >= status.walletLimit
  const maxQuantity = status ? Math.max(0, Math.min(status.walletLimit - status.minted, status.maxSupply - status.supply)) : 1
  const submit = () => {
    if (!collection.contract || !address || !status || quantity < 1) return
    void runAction(`Minting ${collection.name}`, `${quantity} ${collection.shortName} Keeper${quantity > 1 ? 's' : ''} added to your vault`, { kind: 'mintCollection', nftContract: collection.contract, quantity, amount: price * BigInt(quantity) })
  }
  return (
    <article className={`mint-card mint-card--${collection.accent}`}>
      <div className="mint-card__art"><BearArtwork id={collection.id === 'legacy' ? 24 : collection.id === 'genesis' ? 1 : collection.id === 'blue-hour' ? 8 : collection.id === 'deep-current' ? 14 : 19} /></div>
      <div className="mint-card__body">
        <div className="mint-card__eyebrow"><span className="eyebrow">{collection.id === 'legacy' ? 'Archive collection' : collection.id === 'genesis' ? 'Original collection' : 'New collection'}</span><CollectionBadge address={collection.contract} /></div>
        <h2>{collection.name}</h2>
        <p>{collection.description}</p>
        <div className="mint-card__meta"><div><small>Mint price</small><b>{collection.mintable ? (price === 0n ? 'Free' : `${usdcValue(price)} USDC`) : 'Not available'}</b></div><div><small>Supply</small><b>{isLoading || !status ? '—' : `${status.supply} / ${status.maxSupply}`}</b></div></div>
        {collection.mintable && collection.contract && <div className="mint-card__action"><div className="stepper"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><input aria-label={`Quantity for ${collection.name}`} value={quantity} max={maxQuantity} onChange={event => setQuantity(Math.max(1, Math.min(maxQuantity || 1, Number(event.target.value))))} type="number" /><button onClick={() => setQuantity(Math.min(maxQuantity || 1, quantity + 1))}>+</button></div><button className="button button--primary" disabled={!address ? false : unavailable || quantity > maxQuantity} onClick={() => address ? submit() : openWallet()}>{!address ? 'Connect to mint' : unavailable ? (status?.supply === status?.maxSupply ? 'Sold out' : 'Mint limit reached') : `Mint for ${price === 0n ? 'free' : `${usdcValue(price * BigInt(quantity))} USDC`}`}</button></div>}
        {!collection.mintable && <div className="mint-card__archived"><span>Read-only collection</span><Link to="/vault">View in vault <ArrowRight size={14} /></Link></div>}
        {collection.mintable && <small className="mint-card__note">Mint uses ERC-20 USDC. Arc native USDC is used for gas.</small>}
      </div>
    </article>
  )
}

function MintPage() {
  return (
    <main>
      <PageIntro eyebrow="Five collections · One vault" title="Choose your chapter." copy="Mint from the live collections, then use any owned Keeper across raffles, auctions, and lending when its collection is allowlisted." />
      <section className="mint-page wrap">
        <div className="mint-page__intro"><div><span className="eyebrow">Collection map</span><h2>Start where the signal feels right.</h2></div><p>Genesis is free. The three new chapters use fixed USDC prices: 1, 2, and 3 USDC. Legacy stays available for utility and ownership history, but is not open for new minting.</p></div>
        <div className="mint-grid">{collectionCatalog.map(collection => <MintCollectionCard collection={collection} key={collection.id} />)}</div>
      </section>
    </main>
  )
}

type EscrowedArtifact = { collection: Address; tokenId: number; label: string; to: string }

function VaultArtifactGroups({ owned, escrowed, onUse }: { owned: OwnedArtifact[]; escrowed: EscrowedArtifact[]; onUse: (artifact: OwnedArtifact) => void }) {
  return <div className="vault-collections">{collectionCatalog.map(collection => {
    const available = owned.filter(artifact => artifact.collectionId === collection.id)
    const held = escrowed.filter(artifact => sameAddress(artifact.collection, collection.contract))
    if (!available.length && !held.length) return null
    return <section className="vault-collection" key={collection.id}><div className="collection-group__head"><div><span className="eyebrow">Collection</span><h3>{collection.name}</h3><p>{collection.description}</p></div><CollectionBadge address={collection.contract} /></div><div className="card-grid card-grid--three">{available.map(artifact => <div className="nft-card" key={`${artifact.collection}:${artifact.tokenId}`}><div className="nft-card__art"><BearArtwork id={artifact.tokenId} /></div><div className="nft-card__body"><div className="nft-card__title"><div><span>{collection.name} · #{String(artifact.tokenId).padStart(2, '0')}</span><strong>{nfts[artifact.tokenId - 1].name}</strong></div></div><div className="vault-card-row"><StatusPill status="Owned" /><button onClick={() => onUse(artifact)}>Use artifact <ArrowRight size={14} /></button></div></div></div>)}{held.map(artifact => <Link className="nft-card" to={artifact.to} key={`escrow:${artifact.collection}:${artifact.tokenId}`}><div className="nft-card__art"><BearArtwork id={artifact.tokenId} /></div><div className="nft-card__body"><div className="nft-card__title"><div><span>{collection.name} · #{String(artifact.tokenId).padStart(3, '0')}</span><strong>{nfts[artifact.tokenId - 1].name}</strong></div><ArrowUpRight size={18} /></div><div className="vault-card-row"><StatusPill status="Escrowed" /><span className="text-link">{artifact.label} <ArrowRight size={14} /></span></div></div></Link>)}</div></section>
  })}</div>
}

function HomePage() {
  const { data: chainRaffles = [] } = useRaffles()
  const { data: chainAuctions = [] } = useAuctions()
  const { data: chainLoans = [] } = useLoans()
  const { data: supply = 0 } = useNftSupply()
  const volume = chainRaffles.reduce((sum, item) => sum + usdcValue(item.ticketPrice) * item.ticketsSold, 0) + chainAuctions.reduce((sum, item) => sum + usdcValue(item.highestBid), 0) + chainLoans.filter(item => item.state > 0).reduce((sum, item) => sum + usdcValue(item.principal), 0)
  return (
    <main>
      <section className="hero">
        <div className="hero__copy">
          <div className="product-badge"><i />Live on Arc Testnet</div>
          <h1>Your collection.<br /><em>In motion.</em></h1>
          <p>Collect through transparent raffles. Compete in fair auctions. Unlock USDC without letting go of the NFTs you own.</p>
          <div className="button-row">
            <Link className="button button--primary" to="/raffles">Explore Ursa <ArrowRight size={16} /></Link>
            <Link className="button button--ghost" to="/mint">Mint a Keeper <Sparkles size={16} /></Link>
          </div>
          <div className="hero__trust"><ShieldCheck size={17} /><span>24 original Keepers. Purpose-built escrow. Zero platform fees.</span></div>
        </div>
        <div className="hero__visual">
          <div className="hero__plate"><BearArtwork id={24} hero /></div>
          <div className="hero__caption"><span>GENESIS COLLECTION</span><b>Guardian of Arc</b><small>MYTHIC · #024</small></div>
          <div className="hero__availability"><i /><span><small>Collection</small><b>{supply} of 24 minted</b></span></div>
        </div>
      </section>

      <section className="signal-strip">
        <div className="wrap signal-strip__inner">
          <div><small>Keepers minted</small><b>{supply}<em> / 24</em></b></div><i />
          <div><small>Onchain volume</small><b>{volume.toFixed(2)} <em>USDC</em></b></div><i />
          <div><small>Open positions</small><b>{chainRaffles.filter(item => item.state === 0).length + chainAuctions.filter(item => item.state < 2).length + chainLoans.filter(item => item.state < 2).length}</b></div><i />
          <div><small>Platform fee</small><b>0<em>%</em></b></div>
        </div>
      </section>

      <section className="section utility-section wrap">
        <SectionHead eyebrow="One collection · Three utilities" title="More ways to own what matters." copy="Ursa Arcana brings collecting, exchange, and collateral into one product that stays clear at every step." />
        <div className="utility-grid">
          <Link className="utility-card utility-card--raffle" to="/raffles"><span className="utility-card__number">01</span><div className="utility-card__glyph"><UtilityGlyph type="raffle" /></div><div><span className="eyebrow">Collect</span><h3>A little luck.<br />Complete clarity.</h3><p>Enter limited-ticket draws with a winner reveal anyone can verify onchain.</p><span className="text-link">Explore raffles <ArrowRight size={15} /></span></div></Link>
          <Link className="utility-card utility-card--auction" to="/auctions"><span className="utility-card__number">02</span><div className="utility-card__glyph"><UtilityGlyph type="auction" /></div><div><span className="eyebrow">Compete</span><h3>Every bid.<br />Out in the open.</h3><p>English auctions, protected outbid balances, and fair last-minute extensions.</p><span className="text-link">Explore auctions <ArrowRight size={15} /></span></div></Link>
          <Link className="utility-card utility-card--lend" to="/lend"><span className="utility-card__number">03</span><div className="utility-card__glyph"><UtilityGlyph type="lend" /></div><div><span className="eyebrow">Unlock</span><h3>Liquidity.<br />Without letting go.</h3><p>Use a Keeper as collateral with direct, fixed USDC terms and no price oracle.</p><span className="text-link">Explore lending <ArrowRight size={15} /></span></div></Link>
        </div>
      </section>

      <section className="section section--ink">
        <div className="wrap">
          <SectionHead eyebrow="Live now" title="Ready when you are." copy="Confirmed raffle positions, read directly from Arc Testnet." link="/raffles" linkText="See all raffles" />
          {chainRaffles.length ? <div className="card-grid card-grid--three">{chainRaffles.slice(0, 3).map(raffle => <ChainRaffleCard raffle={raffle} key={raffle.id} />)}</div> : <EmptyState title="The draw chamber is open" copy="No raffle has been created on the current contract yet." />}
        </div>
      </section>

      <section className="lore wrap section">
        <div className="lore__mark"><UrsaMark /></div>
        <div className="lore__copy"><span className="eyebrow">Designed as one product</span><blockquote>One Keeper can become a raffle prize, an auction lot, or collateral for a direct loan. It never leaves purpose-built escrow until the outcome is final.</blockquote><Link className="text-link" to="/learn">See how it works <ArrowRight size={15} /></Link></div>
        <div className="lore__diagram"><div className="diagram-ring"><span>COLLECT</span><span>COMPETE</span><span>UNLOCK</span><UrsaMark compact /></div></div>
      </section>
    </main>
  )
}

function RafflesPage() {
  const { address } = useAccount()
  const { openWallet } = useActions()
  const { data = [], isLoading } = useRaffles(address)
  const { data: owned = [] } = useOwnedNfts(address)
  const [filter, setFilter] = useState('All')
  const [createOpen, setCreateOpen] = useState(false)
  const shown = filter === 'All' ? data : data.filter(item => filter === 'Live' ? item.state === 0 : item.state !== 0)
  return (
    <main>
      <PageIntro eyebrow="Collect by chance" title="A simpler way to collect." copy="Choose a Keeper, pick your entries, and follow a winner reveal anyone can verify on Arc." action={<button className="button button--primary" onClick={() => address ? setCreateOpen(true) : openWallet()}><Plus size={16} /> Create raffle</button>} />
      <section className="listing wrap">
        <FilterTabs value={filter} onChange={setFilter} options={['All', 'Live', 'Settled']} counts={{ All: data.length, Live: data.filter(r => r.state === 0).length, Settled: data.filter(r => r.state !== 0).length }} />
        {isLoading ? <LoadingState /> : shown.length ? <CollectionGroups items={shown} render={raffle => <ChainRaffleCard raffle={raffle} key={raffle.id} />} /> : <EmptyState title="No raffles found" copy="Create the first raffle from an NFT you own." />}
      </section>
      {createOpen && address && <CreatePositionModal type="raffle" artifacts={owned} onClose={() => setCreateOpen(false)} />}
    </main>
  )
}

function AuctionsPage() {
  const { address } = useAccount()
  const { openWallet } = useActions()
  const { data = [], isLoading } = useAuctions(address)
  const { data: owned = [] } = useOwnedNfts(address)
  const [filter, setFilter] = useState('All')
  const [createOpen, setCreateOpen] = useState(false)
  const shown = filter === 'All' ? data : data.filter(item => filter === 'Live' ? item.state < 2 : item.state >= 2)
  return (
    <main>
      <PageIntro eyebrow="Compete in public" title="For the ones you won't let go." copy="Every bid is visible. Every outbid balance stays withdrawable. The final ten minutes remain fair." action={<button className="button button--primary" onClick={() => address ? setCreateOpen(true) : openWallet()}><Plus size={16} /> Create auction</button>} />
      <section className="listing wrap">
        <FilterTabs value={filter} onChange={setFilter} options={['All', 'Live', 'Settled']} counts={{ All: data.length, Live: data.filter(r => r.state < 2).length, Settled: data.filter(r => r.state >= 2).length }} />
        {isLoading ? <LoadingState /> : shown.length ? <CollectionGroups items={shown} render={auction => <ChainAuctionCard auction={auction} key={auction.id} />} /> : <EmptyState title="No auctions found" copy="Create the first auction from an NFT you own." />}
      </section>
      {createOpen && address && <CreatePositionModal type="auction" artifacts={owned} onClose={() => setCreateOpen(false)} />}
    </main>
  )
}

function LendingPage() {
  const { address } = useAccount()
  const { openWallet } = useActions()
  const { data = [], isLoading } = useLoans()
  const { data: owned = [] } = useOwnedNfts(address)
  const [filter, setFilter] = useState('All')
  const [createOpen, setCreateOpen] = useState(false)
  const stateByFilter: Record<string, number> = { 'Awaiting lender': 0, Active: 1, Repaid: 2 }
  const shown = filter === 'All' ? data : data.filter(item => item.state === stateByFilter[filter])
  const openPrincipal = data.filter(item => item.state === 0 && item.fundingDeadline >= Date.now() / 1000).reduce((sum, item) => sum + usdcValue(item.principal), 0)
  const activePrincipal = data.filter(item => item.state === 1).reduce((sum, item) => sum + usdcValue(item.principal), 0)
  return (
    <main>
      <PageIntro eyebrow="NFT-backed liquidity" title="Make your collection work." copy="Borrow against a Keeper or fund another collector with fixed terms, clear deadlines, and no price oracle." action={<button className="button button--primary" onClick={() => address ? setCreateOpen(true) : openWallet()}><Plus size={16} /> Request a loan</button>} />
      <section className="lending-summary wrap">
        <div><small>Available to fund</small><b>{openPrincipal.toFixed(2)} <em>USDC</em></b></div><div><small>Currently borrowed</small><b>{activePrincipal.toFixed(2)} <em>USDC</em></b></div><div><small>Maximum total due</small><b>5 <em>USDC</em></b></div><div><small>Collateral locked</small><b>{data.filter(item => !item.collateralClaimed && item.state < 4).length} <em>keepers</em></b></div>
      </section>
      <section className="listing wrap">
        <FilterTabs value={filter} onChange={setFilter} options={['All', 'Awaiting lender', 'Active', 'Repaid']} counts={{ All: data.length, 'Awaiting lender': data.filter(r => r.state === 0).length, Active: data.filter(r => r.state === 1).length, Repaid: data.filter(r => r.state === 2).length }} />
        {isLoading ? <LoadingState /> : shown.length ? <CollectionGroups items={shown} render={loan => <ChainLoanCard loan={loan} key={loan.id} />} /> : <EmptyState title="No loan requests found" copy="Publishing a request locks your NFT. USDC moves only after another wallet funds it." />}
      </section>
      {createOpen && address && <CreatePositionModal type="loan" artifacts={owned} onClose={() => setCreateOpen(false)} />}
    </main>
  )
}

function DetailTop({ type, id, title }: { type: string; id: number; title: string }) {
  const base = type === 'Loan' ? '/lend' : `/${type.toLowerCase()}s`
  return <div className="detail-top"><Link to={base}><ArrowLeft size={15} /> Back to {type === 'Loan' ? 'lending' : `${type.toLowerCase()}s`}</Link><span>{type} #{id} · {title}</span></div>
}

function RaffleDetail() {
  const { id } = useParams()
  const { address } = useAccount()
  const { data = [], isLoading } = useRaffles(address)
  const raffle = data.find(item => item.id === Number(id))
  const nft = raffle ? nfts[raffle.tokenId - 1] : undefined
  const [quantity, setQuantity] = useState(1)
  const [manualSecret, setManualSecret] = useState('')
  const { runAction } = useActions()
  if (isLoading) return <main className="detail wrap"><LoadingState /></main>
  if (!raffle || !nft) return <EmptyRoute />
  const now = Math.floor(Date.now() / 1000)
  const isCreator = sameAddress(address, raffle.creator)
  const isWinner = sameAddress(address, raffle.winner)
  const storedSecret = (() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key?.startsWith('ursa:raffle-secret:')) continue
      const candidate = localStorage.getItem(key) as `0x${string}` | null
      if (candidate && keccak256(encodePacked(['bytes32', 'address', 'uint256'], [keccak256(candidate), raffle.creator, BigInt(raffle.id)])) === raffle.commitment) return candidate
    }
    return null
  })()
  const secret = (manualSecret || storedSecret) as `0x${string}` | null
  const canReveal = raffle.state === 0 && raffle.ticketsSold > 0 && isCreator && (now >= raffle.endAt || raffle.ticketsSold >= raffle.maxTickets) && now <= raffle.revealDeadline
  const canRefund = raffle.state === 2 && raffle.userTickets > 0
  const soldOut = raffle.ticketsSold >= raffle.maxTickets
  const maxPurchase = Math.min(20, raffle.maxTickets - raffle.ticketsSold, Math.floor(5 / usdcValue(raffle.ticketPrice)))
  return (
    <main className="detail wrap">
      <DetailTop type="Raffle" id={raffle.id} title={nft.name} />
      <div className="detail-grid">
        <div className="detail-art"><BearArtwork id={nft.id} /><span className="detail-art__edition">URSA ARCANA · #{String(nft.id).padStart(3, '0')}</span></div>
        <section className="detail-copy">
          <div className="detail-status"><StatusPill status={raffle.state === 0 ? 'Active' : raffle.state === 1 ? 'Revealed' : raffle.state === 2 ? 'Refunding' : 'Closed'} /><span><Clock3 size={14} />{countdown(raffle.endAt)}</span></div>
          <span className="eyebrow">{sameAddress(raffle.nftContract, addresses.legacyNft) ? 'Legacy guarded artifact' : 'Guarded artifact'}</span><h1>{nft.name}</h1>
          <p className="detail-description">A mythic keeper charted near the outer threshold, carrying a key said to open paths between distant constellations.</p>
          <div className="trait-row"><span><small>Order</small>{nft.role}</span><span><small>Aura</small>{nft.aura}</span><span><small>Rarity</small>{nft.rarity}</span></div>
          <div className="action-panel">
            <div className="action-panel__head"><div><small>Ticket price</small><b>{usdcValue(raffle.ticketPrice)} <em>USDC</em></b></div><div><small>Your tickets</small><b>{raffle.userTickets}</b></div></div>
            {raffle.state === 0 && now < raffle.endAt && !soldOut && <><div className="quantity-row"><label htmlFor="tickets">Number of tickets · max 5 USDC total</label><div className="stepper"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><input id="tickets" value={quantity} onChange={event => setQuantity(Math.min(maxPurchase, Math.max(1, Number(event.target.value))))} type="number" /><button onClick={() => setQuantity(Math.min(maxPurchase, quantity + 1))}>+</button></div></div><button className="button button--primary button--wide" onClick={() => runAction('Reserving your tickets', `${quantity} tickets entered into raffle #${raffle.id}`, { kind: 'raffle', id: raffle.id, quantity, amount: raffle.ticketPrice * BigInt(quantity) })}>Buy {quantity} ticket{quantity > 1 ? 's' : ''}<span>{(usdcValue(raffle.ticketPrice) * quantity).toFixed(2)} USDC</span></button></>}
            {canReveal && <><label className="bid-input"><span>Reveal secret {storedSecret ? '· saved in this browser' : ''}</span><div><input value={manualSecret || storedSecret || ''} onChange={event => setManualSecret(event.target.value)} placeholder="0x…" /></div></label><button className="button button--primary button--wide" disabled={!secret} onClick={() => runAction('Revealing winner', `Winner revealed for raffle #${raffle.id}`, { kind: 'raffleLifecycle', id: raffle.id, functionName: 'revealWinner', secret: secret || undefined })}>Reveal winner <Sparkles size={16} /></button></>}
            {raffle.state === 0 && raffle.ticketsSold > 0 && now > raffle.revealDeadline && <button className="button button--primary button--wide" onClick={() => runAction('Opening refunds', `Refunds opened for raffle #${raffle.id}`, { kind: 'raffleLifecycle', id: raffle.id, functionName: 'cancelUnrevealed' })}>Open refund flow</button>}
            {raffle.state === 0 && raffle.ticketsSold === 0 && now >= raffle.endAt && <button className="button button--ghost button--wide" onClick={() => runAction('Closing empty raffle', `NFT #${raffle.tokenId} returned`, { kind: 'raffleLifecycle', id: raffle.id, functionName: 'cancelUnrevealed' })}>Close raffle & return NFT</button>}
            {raffle.state === 1 && isWinner && !raffle.prizeClaimed && <button className="button button--primary button--wide" onClick={() => runAction('Claiming prize', `NFT #${raffle.tokenId} claimed`, { kind: 'raffleLifecycle', id: raffle.id, functionName: 'claimPrize' })}>Claim prize</button>}
            {raffle.state === 1 && isCreator && !raffle.proceedsClaimed && <button className="button button--ghost button--wide" onClick={() => runAction('Claiming proceeds', `Raffle #${raffle.id} proceeds claimed`, { kind: 'raffleLifecycle', id: raffle.id, functionName: 'claimProceeds' })}>Claim proceeds</button>}
            {raffle.state === 2 && isCreator && !raffle.prizeClaimed && <button className="button button--ghost button--wide" onClick={() => runAction('Returning prize', `NFT #${raffle.tokenId} returned`, { kind: 'raffleLifecycle', id: raffle.id, functionName: 'claimPrize' })}>Return NFT</button>}
            {canRefund && <button className="button button--primary button--wide" onClick={() => runAction('Claiming refund', `Refund claimed for ${raffle.userTickets} tickets`, { kind: 'raffleLifecycle', id: raffle.id, functionName: 'claimRefund' })}>Claim refund</button>}
            <p className="action-note"><ShieldCheck size={14} />All actions above are enabled only for the current onchain state and wallet role.</p>
          </div>
          <div className="progress-info"><div><span>{raffle.ticketsSold} of {raffle.maxTickets} tickets</span><b>{Math.round(raffle.ticketsSold / raffle.maxTickets * 100)}% filled</b></div><div className="progress"><i style={{ width: `${raffle.ticketsSold / raffle.maxTickets * 100}%` }} /></div><small>Creator {shortAddress(raffle.creator)}</small></div>
        </section>
      </div>
      <section className="history-panel"><div className="panel-heading"><div><span className="eyebrow">Verified contract</span><h2>Raffle #{raffle.id} on Arc</h2></div><a href={`${arcTestnet.blockExplorers.default.url}/address/${addresses.raffle}`} target="_blank" rel="noreferrer" className="text-link">Open ArcScan <ExternalLink size={14} /></a></div></section>
    </main>
  )
}

function AuctionDetail() {
  const { id } = useParams()
  const { address } = useAccount()
  const { data = [], isLoading } = useAuctions(address)
  const auction = data.find(item => item.id === Number(id))
  const nft = auction ? nfts[auction.tokenId - 1] : undefined
  const minimum = auction ? (auction.highestBid === 0n ? 0.01 : usdcValue(auction.highestBid) * (1 + auction.minIncrementBps / 10_000)) : 0
  const [amount, setAmount] = useState(minimum)
  const { runAction } = useActions()
  useEffect(() => {
    setAmount(Number(minimum.toFixed(6)))
  }, [minimum])
  if (isLoading) return <main className="detail wrap"><LoadingState /></main>
  if (!auction || !nft) return <EmptyRoute />
  const now = Math.floor(Date.now() / 1000)
  const isSeller = sameAddress(address, auction.seller)
  const isWinner = sameAddress(address, auction.highestBidder)
  const ended = now >= auction.endAt
  const canBid = auction.state < 2 && now >= auction.startAt && !ended && !isSeller
  return (
    <main className="detail wrap">
      <DetailTop type="Auction" id={auction.id} title={nft.name} />
      <div className="detail-grid">
        <div className="detail-art"><BearArtwork id={nft.id} /><span className="detail-art__edition">URSA ARCANA · #{String(nft.id).padStart(3, '0')}</span></div>
        <section className="detail-copy">
          <div className="detail-status"><StatusPill status={auction.state === 0 ? 'Pending' : auction.state === 1 ? (ended ? 'Ready to settle' : 'Live') : auction.state === 2 ? (auction.sold ? 'Sold' : 'No sale') : 'Cancelled'} /><span><Clock3 size={14} />{countdown(auction.endAt)}</span></div>
          <span className="eyebrow">{sameAddress(auction.nftContract, addresses.legacyNft) ? 'Legacy open auction' : 'Open auction'}</span><h1>{nft.name}</h1>
          <p className="detail-description">The final guardian in the genesis observatory. Offered by its current steward to the collector with the strongest conviction.</p>
          <div className="trait-row"><span><small>Order</small>{nft.role}</span><span><small>Aura</small>{nft.aura}</span><span><small>Rarity</small>{nft.rarity}</span></div>
          <div className="action-panel">
            <div className="action-panel__head"><div><small>Current bid</small><b>{usdcValue(auction.highestBid)} <em>USDC</em></b></div><div><small>Reserve</small><b className={auction.highestBid >= auction.reservePrice ? 'reserve-met' : ''}>{auction.highestBid >= auction.reservePrice ? <><Check size={14} />Met</> : `${usdcValue(auction.reservePrice)} USDC`}</b></div></div>
            {canBid && <><label className="bid-input"><span>Your bid · maximum 5 USDC</span><div><input value={amount} min={minimum} max="5" step="0.01" onChange={event => setAmount(Number(event.target.value))} type="number" /><b>USDC</b></div><small>Minimum next bid: {minimum.toFixed(2)} USDC · 5% increment</small></label><button className="button button--primary button--wide" disabled={amount < minimum || amount > 5} onClick={() => runAction('Securing your bid', `${amount} USDC bid placed on auction #${auction.id}`, { kind: 'auction', id: auction.id, amount: parseUnits(String(amount), 6) })}>Place bid <Gavel size={16} /></button></>}
            {auction.state < 2 && ended && <button className="button button--primary button--wide" onClick={() => runAction('Settling auction', `Auction #${auction.id} settled`, { kind: 'auctionLifecycle', id: auction.id, functionName: 'settleAuction' })}>Settle auction</button>}
            {auction.state < 2 && isSeller && auction.highestBidder === zeroAddress && <button className="button button--ghost button--wide" onClick={() => runAction('Cancelling auction', `Auction #${auction.id} cancelled`, { kind: 'auctionLifecycle', id: auction.id, functionName: 'cancelAuction' })}>Cancel auction</button>}
            {auction.withdrawable > 0n && <button className="button button--ghost button--wide" onClick={() => runAction('Withdrawing outbid balance', `${usdcValue(auction.withdrawable)} USDC withdrawn`, { kind: 'auctionLifecycle', id: auction.id, functionName: 'withdrawBid' })}>Withdraw {usdcValue(auction.withdrawable)} USDC</button>}
            {auction.state === 2 && ((auction.sold && isWinner) || (!auction.sold && isSeller)) && !auction.nftClaimed && <button className="button button--primary button--wide" onClick={() => runAction('Claiming NFT', `NFT #${auction.tokenId} claimed`, { kind: 'auctionLifecycle', id: auction.id, functionName: 'claimNFT' })}>Claim NFT</button>}
            {auction.state === 2 && auction.sold && isSeller && !auction.proceedsClaimed && <button className="button button--ghost button--wide" onClick={() => runAction('Claiming proceeds', `Auction #${auction.id} proceeds claimed`, { kind: 'auctionLifecycle', id: auction.id, functionName: 'claimProceeds' })}>Claim proceeds</button>}
            <p className="action-note"><Clock3 size={14} />Bids are capped at 5 USDC. A bid in the final 10 minutes extends the auction.</p>
          </div>
          <div className="seller-line"><span>Seller <b className="mono">{shortAddress(auction.seller)}</b></span><span>Highest bidder {auction.highestBidder === zeroAddress ? 'None' : shortAddress(auction.highestBidder)}</span></div>
        </section>
      </div>
      <section className="history-panel"><div className="panel-heading"><div><span className="eyebrow">Verified contract</span><h2>Auction #{auction.id} on Arc</h2></div><a href={`${arcTestnet.blockExplorers.default.url}/address/${addresses.auction}`} target="_blank" rel="noreferrer" className="text-link">Open ArcScan <ExternalLink size={14} /></a></div></section>
    </main>
  )
}

function LoanDetail() {
  const { id } = useParams()
  const { address } = useAccount()
  const { data = [], isLoading } = useLoans()
  const loan = data.find(item => item.id === Number(id))
  const nft = loan ? nfts[loan.tokenId - 1] : undefined
  const { runAction } = useActions()
  if (isLoading) return <main className="detail wrap"><LoadingState /></main>
  if (!loan || !nft) return <EmptyRoute />
  const total = loan.principal + loan.interest
  const totalUsdc = usdcValue(total)
  const isBorrower = sameAddress(address, loan.borrower)
  const isLender = sameAddress(address, loan.lender)
  const now = Math.floor(Date.now() / 1000)
  const status = loanStatus(loan)
  const interestPercent = loan.principal ? Number(loan.interest * 10_000n / loan.principal) / 100 : 0
  const stageCopy = loan.state === 0
    ? now > loan.fundingDeadline
      ? 'The funding window ended without a lender. No principal was transferred. The borrower can close this request and return the NFT.'
      : `Awaiting a lender. The NFT is locked, but no USDC has moved. If funded, ${usdcValue(loan.principal)} USDC goes directly to the borrower and the ${formatDuration(loan.duration)} repayment clock starts.`
    : loan.state === 1
      ? now > loan.dueAt
        ? 'The repayment deadline has passed. The lender can now claim the NFT collateral; repayment is no longer accepted.'
        : `Funded and active. The borrower received ${usdcValue(loan.principal)} USDC and must repay ${totalUsdc} USDC by ${formatTimestamp(loan.dueAt)}.`
      : loan.state === 2
        ? 'Repayment is confirmed. The lender can claim the USDC held by the contract, and the borrower can reclaim the NFT.'
        : loan.state === 3
          ? 'The request was cancelled before funding. No principal was transferred and the NFT was returned.'
          : 'The loan defaulted after its deadline. The lender claimed the NFT collateral instead of repayment.'
  return (
    <main className="detail wrap">
      <DetailTop type="Loan" id={loan.id} title={nft.name} />
      <div className="detail-grid">
        <div className="detail-art"><BearArtwork id={nft.id} /><span className="detail-art__edition">COLLATERAL · #{String(nft.id).padStart(3, '0')}</span></div>
        <section className="detail-copy">
          <div className="detail-status"><StatusPill status={status} /><span><Clock3 size={14} />{loan.state === 0 ? (now <= loan.fundingDeadline ? `Find a lender in ${countdown(loan.fundingDeadline)}` : 'Funding window ended') : loan.state === 1 ? (now <= loan.dueAt ? `Repay in ${countdown(loan.dueAt)}` : 'Repayment overdue') : 'Position closed'}</span></div>
          <span className="eyebrow">{sameAddress(loan.nftContract, addresses.legacyNft) ? 'Legacy collateral offered' : 'Collateral offered'}</span><h1>{nft.name}</h1>
          <p className="detail-description">This Keeper secures a direct loan request. The funding and repayment periods are separate, and the repayment amount never changes after publication.</p>
          <div className="trait-row"><span><small>Order</small>{nft.role}</span><span><small>Aura</small>{nft.aura}</span><span><small>Rarity</small>{nft.rarity}</span></div>
          <div className="action-panel loan-action">
            <div className="loan-terms"><div><small>Borrower receives</small><b>{usdcValue(loan.principal)} <em>USDC</em></b></div><div><small>Fixed interest</small><b>+{usdcValue(loan.interest)} <em>USDC · {interestPercent.toFixed(1)}%</em></b></div><div><small>Total amount due</small><b>{totalUsdc} <em>USDC</em></b></div><div><small>Time to repay</small><b>{formatDuration(loan.duration)}</b></div></div>
            <div className={`loan-stage loan-stage--${loan.state}`}><strong>{status}</strong><p>{stageCopy}</p>{loan.state === 0 && <small>Funding deadline: {formatTimestamp(loan.fundingDeadline)}</small>}{loan.state === 1 && <small>Repayment deadline: {formatTimestamp(loan.dueAt)}</small>}</div>
            {loan.state === 0 && now <= loan.fundingDeadline && !isBorrower && <button className="button button--primary button--wide" onClick={() => runAction('Funding the request', `${usdcValue(loan.principal)} USDC sent to the borrower for loan #${loan.id}`, { kind: 'lending', id: loan.id, amount: loan.principal })}>Fund with {usdcValue(loan.principal)} USDC <HandCoins size={17} /></button>}
            {loan.state === 0 && isBorrower && <button className="button button--ghost button--wide" onClick={() => runAction('Closing loan request', `Loan #${loan.id} closed and NFT returned`, { kind: 'loanLifecycle', id: loan.id, functionName: 'cancelLoanRequest' })}>{now > loan.fundingDeadline ? 'Close request & return NFT' : 'Cancel request & return NFT'}</button>}
            {loan.state === 1 && isBorrower && now <= loan.dueAt && <button className="button button--primary button--wide" onClick={() => runAction('Repaying loan', `Loan #${loan.id} repaid`, { kind: 'loanLifecycle', id: loan.id, functionName: 'repayLoan', amount: total })}>Repay {totalUsdc} USDC</button>}
            {loan.state === 2 && isLender && !loan.lenderClaimed && <button className="button button--primary button--wide" onClick={() => runAction('Claiming repayment', `${totalUsdc} USDC repayment claimed`, { kind: 'loanLifecycle', id: loan.id, functionName: 'claimLenderRepayment' })}>Claim repayment</button>}
            {loan.state === 2 && isBorrower && !loan.collateralClaimed && <button className="button button--ghost button--wide" onClick={() => runAction('Claiming collateral', `NFT #${loan.tokenId} returned`, { kind: 'loanLifecycle', id: loan.id, functionName: 'claimBorrowerCollateral' })}>Claim collateral</button>}
            {loan.state === 1 && isLender && now > loan.dueAt && !loan.collateralClaimed && <button className="button button--primary button--wide" onClick={() => runAction('Claiming default collateral', `NFT #${loan.tokenId} claimed after default`, { kind: 'loanLifecycle', id: loan.id, functionName: 'claimDefaultCollateral' })}>Claim default collateral</button>}
            <p className="action-note"><ShieldCheck size={14} />{loan.state === 0 && !isBorrower ? 'Your wallet may request USDC approval first. Only the confirmed funding transaction sends principal to the borrower.' : 'USDC uses its ERC-20 interface for transfers and the native balance for gas. Confirmed balances refresh automatically.'}</p>
          </div>
          <div className="seller-line"><span>Borrower <b className="mono">{shortAddress(loan.borrower)}</b></span><span>Lender {loan.lender === zeroAddress ? 'Not funded' : shortAddress(loan.lender)}</span></div>
        </section>
      </div>
      <section className="loan-timeline"><div className="timeline-step complete"><i><Check size={14} /></i><span><b>Request published</b><small>NFT locked · no USDC moved</small></span></div><div className="timeline-line" /><div className={`timeline-step ${loan.state >= 1 && loan.state !== 3 ? 'complete' : ''}`}><i>2</i><span><b>Funded</b><small>{usdcValue(loan.principal)} USDC to borrower</small></span></div><div className="timeline-line" /><div className={`timeline-step ${loan.state >= 2 && loan.state !== 3 ? 'complete' : ''}`}><i>3</i><span><b>{loan.state === 4 ? 'Default' : 'Repayment'}</b><small>{loan.state === 4 ? 'Deadline passed' : `${totalUsdc} USDC into contract`}</small></span></div><div className="timeline-line" /><div className={`timeline-step ${loan.collateralClaimed ? 'complete' : ''}`}><i>4</i><span><b>Final claims</b><small>NFT and USDC leave escrow</small></span></div></section>
    </main>
  )
}

function VaultPage() {
  const { address, isConnected } = useAccount()
  const { openWallet } = useActions()
  const { data: owned = [], isLoading: nftsLoading, isError: nftsError, error: nftScanError, refetch: refetchNfts } = useOwnedNfts(address)
  const { data: chainRaffles = [] } = useRaffles(address)
  const { data: chainAuctions = [] } = useAuctions(address)
  const { data: chainLoans = [] } = useLoans()
  const [tab, setTab] = useState('Artifacts')
  const [createArtifact, setCreateArtifact] = useState<OwnedArtifact | null>(null)
  const escrowedArtifacts = [
    ...chainRaffles.filter(item => sameAddress(item.creator, address) && !item.prizeClaimed).map(item => ({ collection: item.nftContract, tokenId: item.tokenId, label: `Raffle #${item.id}`, to: `/raffles/${item.id}` })),
    ...chainAuctions.filter(item => sameAddress(item.seller, address) && !item.nftClaimed && item.state !== 3).map(item => ({ collection: item.nftContract, tokenId: item.tokenId, label: `Auction #${item.id}`, to: `/auctions/${item.id}` })),
    ...chainLoans.filter(item => sameAddress(item.borrower, address) && !item.collateralClaimed && item.state !== 3).map(item => ({ collection: item.nftContract, tokenId: item.tokenId, label: `Loan #${item.id}`, to: `/lend/${item.id}` })),
  ]
  if (!isConnected) {
    return <main className="vault-locked wrap"><div className="vault-lock__seal"><UrsaMark /></div><span className="eyebrow">Your collection</span><h1>Everything, in one place.</h1><p>Connect an EVM wallet to see Keepers you own, positions in escrow, ticket entries, bids, and loans.</p><button className="button button--primary" onClick={openWallet}><Wallet size={16} /> Connect wallet</button><div className="vault-lock__hint"><ShieldCheck size={15} />Ursa Arcana never stores your private keys.</div></main>
  }
  return (
    <main>
        <PageIntro eyebrow="Your collection" title="Everything you own. Everywhere it moves." copy={`Live positions for ${address?.slice(0, 6)}…${address?.slice(-4)}, read directly from Arc Testnet.`} action={<Link className="button button--primary" to="/mint"><Sparkles size={16} /> Mint a Keeper</Link>} />
      <section className="vault-summary wrap"><div><Gem size={18} /><span><small>Artifacts available</small><b>{owned.length}</b></span></div><div><Landmark size={18} /><span><small>Artifacts in escrow</small><b>{escrowedArtifacts.length}</b></span></div><div><Ticket size={18} /><span><small>Active tickets</small><b>{chainRaffles.reduce((sum, item) => sum + item.userTickets, 0)}</b></span></div><div><HandCoins size={18} /><span><small>Loans funded</small><b>{chainLoans.filter(item => sameAddress(item.lender, address)).length}</b></span></div></section>
      <section className="listing wrap"><FilterTabs value={tab} onChange={setTab} options={['Artifacts', 'Raffles', 'Auctions', 'Loans']} counts={{ Artifacts: owned.length + escrowedArtifacts.length, Raffles: chainRaffles.filter(item => sameAddress(item.creator, address) || item.userTickets > 0 || sameAddress(item.winner, address)).length, Auctions: chainAuctions.filter(item => sameAddress(item.seller, address) || sameAddress(item.highestBidder, address) || item.withdrawable > 0n).length, Loans: chainLoans.filter(item => sameAddress(item.borrower, address) || sameAddress(item.lender, address)).length }} />
         {tab === 'Artifacts' && (nftsLoading ? <LoadingState /> : nftsError ? <div className="empty-tab"><X size={24} /><h3>NFT scan failed</h3><p>{nftScanError instanceof Error ? nftScanError.message.split('\n')[0] : 'Arc RPC did not return ownership data.'}</p><button className="button button--ghost" onClick={() => refetchNfts()}>Retry scan</button></div> : owned.length || escrowedArtifacts.length ? <VaultArtifactGroups owned={owned} escrowed={escrowedArtifacts} onUse={setCreateArtifact} /> : <EmptyState title="No NFT positions" copy="Mint a Keeper from any live collection or connect the wallet that owns your Ursa Arcana NFTs." />)}
         {tab === 'Raffles' && (chainRaffles.filter(item => sameAddress(item.creator, address) || item.userTickets > 0 || sameAddress(item.winner, address)).length ? <CollectionGroups items={chainRaffles.filter(item => sameAddress(item.creator, address) || item.userTickets > 0 || sameAddress(item.winner, address))} render={item => <ChainRaffleCard raffle={item} key={item.id} />} /> : <EmptyState title="No raffle positions" copy="Created raffles and ticket entries will appear here." />)}
         {tab === 'Auctions' && (chainAuctions.filter(item => sameAddress(item.seller, address) || sameAddress(item.highestBidder, address) || item.withdrawable > 0n).length ? <CollectionGroups items={chainAuctions.filter(item => sameAddress(item.seller, address) || sameAddress(item.highestBidder, address) || item.withdrawable > 0n)} render={item => <ChainAuctionCard auction={item} key={item.id} />} /> : <EmptyState title="No auction positions" copy="Created auctions, highest bids, and withdrawable balances will appear here." />)}
         {tab === 'Loans' && (chainLoans.filter(item => sameAddress(item.borrower, address) || sameAddress(item.lender, address)).length ? <CollectionGroups items={chainLoans.filter(item => sameAddress(item.borrower, address) || sameAddress(item.lender, address))} render={item => <ChainLoanCard loan={item} key={item.id} />} /> : <EmptyState title="No loan positions" copy="Borrowed and funded loans will appear here." />)}
      </section>
      {createArtifact && address && <CreatePositionModal type="choose" artifacts={owned} initialArtifact={createArtifact} onClose={() => setCreateArtifact(null)} />}
    </main>
  )
}

function LearnPage() {
  const [open, setOpen] = useState(0)
  const faqs = [
    ['What is Arc Testnet?', 'Arc is an EVM-compatible network where USDC is used for both gas and application payments. Testnet assets have no real-world value.'],
    ['How are raffle winners selected?', 'A creator commits a secret hash before tickets go on sale. After the raffle closes, revealing that secret produces a verifiable winner index. If they fail to reveal, entrants can claim refunds.'],
    ['What happens to escrowed NFTs?', 'Each artifact is held by the relevant smart contract. It can only move through a valid settlement, refund, repayment, or default path.'],
    ['Can I lose real funds here?', 'Ursa Arcana V1 targets Arc Testnet only. Testnet USDC is not real money, but you should still review every wallet request and never expose a private key.'],
  ]
  return (
    <main>
      <PageIntro eyebrow="Ursa essentials" title="Start with confidence." copy="Everything you need to understand Arc Testnet, each utility, and what happens to a Keeper after you sign." />
      <section className="guide wrap">
        <aside className="guide__aside"><span>IN THIS GUIDE</span><a href="#start">01 · Arc Testnet</a><a href="#rituals">02 · Three utilities</a><a href="#safety">03 · Staying safe</a><a href="#questions">04 · Questions</a></aside>
        <div className="guide__content">
          <article id="start" className="guide-section"><span className="guide-number">01</span><div><span className="eyebrow">Entering Arc</span><h2>A testnet built around USDC</h2><p>Arc Testnet is an EVM network, so your existing injected wallet works here. Unlike most chains, USDC is the native gas currency. A separate ERC-20 USDC contract powers tickets, bids, and loans.</p><div className="network-card"><div><Network size={20} /><span><small>Network</small><b>Arc Testnet</b></span></div><div><small>Chain ID</small><b>5,042,002</b></div><div><small>RPC endpoint</small><b className="mono">rpc.drpc.testnet.arc.network</b></div><button onClick={() => navigator.clipboard?.writeText('https://rpc.drpc.testnet.arc.network')}><Copy size={15} /> Copy RPC</button></div><a className="text-link" href="https://docs.arc.io/arc/references/connect-to-arc" target="_blank" rel="noreferrer">Read Arc documentation <ExternalLink size={14} /></a></div></article>
          <article id="rituals" className="guide-section"><span className="guide-number">02</span><div><span className="eyebrow">Three utilities</span><h2>One collection. Three clear paths.</h2><div className="ritual-list"><div><Ticket /><span><b>Raffle</b><p>Buy fixed-price entries, then verify the committed reveal.</p></span></div><div><Gavel /><span><b>Auction</b><p>Bid upward in USDC; outbid funds remain withdrawable.</p></span></div><div><HandCoins /><span><b>Lending</b><p>Set direct fixed terms with an NFT held as collateral.</p></span></div></div></div></article>
          <article id="safety" className="guide-section"><span className="guide-number">03</span><div><span className="eyebrow">Staying safe</span><h2>Know what happens before you sign.</h2><div className="safety-grid"><div><ShieldCheck /><b>Non-custodial</b><p>Your wallet signs each action. Private keys never enter this site.</p></div><div><Clock3 /><b>Time-bound</b><p>Raffles, auctions, and loans each have explicit onchain deadlines.</p></div><div><Landmark /><b>Escrowed</b><p>NFTs stay in purpose-built contracts until the final valid claim.</p></div><div><CircleHelp /><b>Testnet only</b><p>All displayed assets are for testing and carry no monetary value.</p></div></div></div></article>
          <article id="questions" className="guide-section"><span className="guide-number">04</span><div><span className="eyebrow">Questions</span><h2>The details, made simple.</h2><div className="faq">{faqs.map(([question, answer], index) => <div className={`faq-item ${open === index ? 'open' : ''}`} key={question}><button onClick={() => setOpen(open === index ? -1 : index)}><span>{question}</span><Plus size={18} /></button><div><p>{answer}</p></div></div>)}</div></div></article>
        </div>
      </section>
    </main>
  )
}

function WalletModal({ onClose }: { onClose: () => void }) {
  const { connectors, connect, error, isPending } = useConnect()
  const unique = connectors.filter((connector, index, all) => all.findIndex(item => item.name === connector.name) === index)
  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title">
        <button className="modal-close" onClick={onClose} aria-label="Close wallet dialog"><X size={18} /></button>
        <UrsaMark /><span className="eyebrow">Continue to Ursa</span><h2 id="wallet-title">Connect a wallet</h2><p>Use an installed EVM wallet to view your collection and transact on Arc Testnet.</p>
        <div className="wallet-options">{unique.map(connector => <button key={connector.uid} onClick={() => connect({ connector }, { onSuccess: onClose })} disabled={isPending}><span className="wallet-option-icon"><Wallet size={19} /></span><span><b>{connector.name}</b><small>{connector.type === 'injected' ? 'Browser extension' : connector.type}</small></span><ArrowRight size={16} /></button>)}</div>
        {error && <p className="wallet-error">{error.message}</p>}
        <small className="wallet-legal"><ShieldCheck size={13} />By connecting, you acknowledge this is a testnet application.</small>
      </section>
    </div>
  )
}

function WalletControl({ onOpen }: { onOpen: () => void }) {
  const { address, chainId, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending } = useSwitchChain()
  const [expanded, setExpanded] = useState(false)
  const { data: balance } = useBalance({ address, token: USDC_ADDRESS, chainId: arcTestnet.id, query: { enabled: isConnected && chainId === arcTestnet.id, refetchInterval: 5_000 } })
  if (!isConnected) return <button className="wallet-button" onClick={onOpen}><Wallet size={15} />Connect wallet</button>
  if (chainId !== arcTestnet.id) return <button className="wallet-button wallet-button--wrong" onClick={() => switchChain({ chainId: arcTestnet.id })}><Network size={15} />{isPending ? 'Switching…' : 'Switch to Arc'}</button>
  return (
    <div className="account-control">
      <button className="account-button" onClick={() => setExpanded(!expanded)}><i /><span><b>{address?.slice(0, 6)}…{address?.slice(-4)}</b><small>{balance ? `${Number(formatUnits(balance.value, balance.decimals)).toFixed(2)} USDC` : 'Arc Testnet'}</small></span><ChevronDown size={14} /></button>
      {expanded && <div className="account-menu"><Link to="/vault" onClick={() => setExpanded(false)}><Gem size={14} />View vault</Link><a href={`${arcTestnet.blockExplorers.default.url}/address/${address}`} target="_blank" rel="noreferrer"><ExternalLink size={14} />View on ArcScan</a><button onClick={() => disconnect()}><ArrowDownRight size={14} />Disconnect</button></div>}
    </div>
  )
}

function Header({ openWallet }: { openWallet: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link className="brand" to="/"><UrsaMark compact /><span><b>Ursa</b><em>Arcana</em></span></Link>
        <nav className={menuOpen ? 'open' : ''}>
          <NavLink to="/mint">Mint</NavLink><NavLink to="/raffles">Raffles</NavLink><NavLink to="/auctions">Auctions</NavLink><NavLink to="/lend">Lending</NavLink><NavLink to="/vault">Vault</NavLink><NavLink to="/learn">Learn</NavLink>
          <div className="mobile-wallet"><WalletControl onOpen={openWallet} /></div>
        </nav>
        <div className="header-tools"><div className="network-pill"><i />Arc Testnet</div><WalletControl onOpen={openWallet} /><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X /> : <Menu />}</button></div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-main"><div className="footer-brand"><Link className="brand" to="/"><UrsaMark compact /><span><b>Ursa</b><em>Arcana</em></span></Link><p>One home for collecting, exchanging, and unlocking NFT utility on Arc Testnet.</p></div><div className="footer-col"><b>Explore</b><Link to="/raffles">Raffles</Link><Link to="/auctions">Auctions</Link><Link to="/lend">Lending</Link><Link to="/vault">Vault</Link></div><div className="footer-col"><b>Resources</b><Link to="/learn">How it works</Link><a href="https://docs.arc.io" target="_blank" rel="noreferrer">Arc docs</a><a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">ArcScan</a></div><div className="footer-status"><span className="eyebrow">Network status</span><b><i />Arc Testnet live</b><small>Chain 5,042,002 · Testnet USDC</small></div></div>
      <div className="wrap footer-bottom"><span>© 2026 Ursa Arcana</span><span>Testnet assets have no monetary value.</span><span>Built independently on Arc Testnet</span></div>
    </footer>
  )
}

function ActionProvider({ children }: PropsWithChildren) {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: arcTestnet.id })
  const { writeContractAsync } = useWriteContract()
  const queryClient = useQueryClient()
  const [walletOpen, setWalletOpen] = useState(false)
  const [toast, setToast] = useState<{ state: 'signing' | 'pending' | 'submitted' | 'success' | 'failed'; text: string; onchain?: boolean; hash?: `0x${string}` } | null>(null)
  const runAction = async (label: string, success: string, transaction?: ContractAction) => {
    if (!isConnected) {
      setWalletOpen(true)
      return false
    }
    if (chainId !== arcTestnet.id) {
      switchChain({ chainId: arcTestnet.id })
      return false
    }

    const hasOnchainTarget = transaction?.kind === 'mint'
      ? Boolean(addresses.nft)
      : transaction?.kind === 'mintCollection'
        ? Boolean(transaction.nftContract)
      : transaction?.kind === 'raffle' || transaction?.kind === 'createRaffle' || transaction?.kind === 'raffleLifecycle'
        ? Boolean(addresses.raffle)
        : transaction?.kind === 'auction' || transaction?.kind === 'createAuction' || transaction?.kind === 'auctionLifecycle'
          ? Boolean(addresses.auction)
          : transaction?.kind === 'lending' || transaction?.kind === 'createLoan' || transaction?.kind === 'loanLifecycle'
            ? Boolean(addresses.lending)
            : false
    if (!hasOnchainTarget || !transaction || !publicClient) {
      setToast({ state: 'pending', text: 'Preparing preview state' })
      window.setTimeout(() => setToast({ state: 'success', text: `${success} · preview only`, onchain: false }), 700)
      window.setTimeout(() => setToast(null), 4300)
      return false
    }

    let finalSubmittedHash: `0x${string}` | undefined
    try {
      setToast({ state: 'signing', text: label })
      let hash: `0x${string}` | undefined
      const confirm = async (transactionHash: `0x${string}`, text: string) => {
        setToast({ state: 'pending', text })
        const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash, timeout: 90_000 })
        if (receipt.status === 'reverted') throw new Error('Transaction reverted on Arc Testnet')
      }
      if (transaction.kind === 'mint' || transaction.kind === 'mintCollection') {
        const nftAddress = transaction.kind === 'mintCollection' ? transaction.nftContract : addresses.nft!
        if (transaction.kind === 'mintCollection' && transaction.amount > 0n) {
          const allowance = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [address!, nftAddress] })
          if (allowance < transaction.amount) {
            const approvalHash = await writeContractAsync({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [nftAddress, transaction.amount], chainId: arcTestnet.id })
            await confirm(approvalHash, 'USDC approved. One more signature is required')
          }
          setToast({ state: 'signing', text: label })
        }
        hash = await writeContractAsync({ address: nftAddress, abi: nftAbi, functionName: 'mint', args: [BigInt(transaction.quantity)], chainId: arcTestnet.id })
      } else if (transaction.kind === 'raffle' || transaction.kind === 'auction' || transaction.kind === 'lending') {
        const spender = transaction.kind === 'raffle' ? addresses.raffle! : transaction.kind === 'auction' ? addresses.auction! : addresses.lending!
        const allowance = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [address!, spender] })
        if (allowance < transaction.amount) {
          const approvalHash = await writeContractAsync({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [spender, transaction.amount], chainId: arcTestnet.id })
          await confirm(approvalHash, 'USDC approved. One more signature is required')
        }
        setToast({ state: 'signing', text: label })

        if (transaction.kind === 'raffle') {
          hash = await writeContractAsync({ address: addresses.raffle!, abi: raffleAbi, functionName: 'buyTickets', args: [BigInt(transaction.id!), BigInt(transaction.quantity)], chainId: arcTestnet.id })
        } else if (transaction.kind === 'auction') {
          hash = await writeContractAsync({ address: addresses.auction!, abi: auctionAbi, functionName: 'placeBid', args: [BigInt(transaction.id!), transaction.amount], chainId: arcTestnet.id })
        } else {
          hash = await writeContractAsync({ address: addresses.lending!, abi: lendingAbi, functionName: 'fundLoan', args: [BigInt(transaction.id!)], chainId: arcTestnet.id })
        }
      } else if (transaction.kind === 'createRaffle' || transaction.kind === 'createAuction' || transaction.kind === 'createLoan') {
        const spender = transaction.kind === 'createRaffle' ? addresses.raffle! : transaction.kind === 'createAuction' ? addresses.auction! : addresses.lending!
        const approvalHash = await writeContractAsync({ address: transaction.nftContract, abi: nftAbi, functionName: 'approve', args: [spender, BigInt(transaction.tokenId)], chainId: arcTestnet.id })
        await confirm(approvalHash, 'Confirming NFT approval')
        setToast({ state: 'signing', text: label })
        if (transaction.kind === 'createRaffle') {
          hash = await writeContractAsync({ address: addresses.raffle!, abi: raffleAbi, functionName: 'createRaffle', args: [transaction.nftContract, BigInt(transaction.tokenId), transaction.ticketPrice, BigInt(transaction.maxTickets), BigInt(transaction.endAt), transaction.commitment], chainId: arcTestnet.id })
        } else if (transaction.kind === 'createAuction') {
          hash = await writeContractAsync({ address: addresses.auction!, abi: auctionAbi, functionName: 'createAuction', args: [transaction.nftContract, BigInt(transaction.tokenId), BigInt(transaction.startAt), BigInt(transaction.endAt), transaction.reservePrice, 500], chainId: arcTestnet.id })
        } else {
          hash = await writeContractAsync({ address: addresses.lending!, abi: lendingAbi, functionName: 'createLoanRequest', args: [transaction.nftContract, BigInt(transaction.tokenId), transaction.principal, transaction.interest, BigInt(transaction.fundingDeadline), BigInt(transaction.duration)], chainId: arcTestnet.id })
        }
      } else if (transaction.kind === 'raffleLifecycle') {
        hash = transaction.functionName === 'revealWinner'
          ? await writeContractAsync({ address: addresses.raffle!, abi: raffleAbi, functionName: 'revealWinner', args: [BigInt(transaction.id), transaction.secret!], chainId: arcTestnet.id })
          : await writeContractAsync({ address: addresses.raffle!, abi: raffleAbi, functionName: transaction.functionName, args: [BigInt(transaction.id)], chainId: arcTestnet.id })
      } else if (transaction.kind === 'auctionLifecycle') {
        hash = await writeContractAsync({ address: addresses.auction!, abi: auctionAbi, functionName: transaction.functionName, args: [BigInt(transaction.id)], chainId: arcTestnet.id })
      } else if (transaction.kind === 'loanLifecycle') {
        if (transaction.functionName === 'repayLoan' && transaction.amount) {
          const allowance = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [address!, addresses.lending!] })
          if (allowance < transaction.amount) {
            const approvalHash = await writeContractAsync({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [addresses.lending!, transaction.amount], chainId: arcTestnet.id })
            await confirm(approvalHash, 'USDC approved. One more signature is required')
          }
          setToast({ state: 'signing', text: label })
        }
        hash = await writeContractAsync({ address: addresses.lending!, abi: lendingAbi, functionName: transaction.functionName, args: [BigInt(transaction.id)], chainId: arcTestnet.id })
      }

      if (!hash) throw new Error('Unsupported transaction action')
      finalSubmittedHash = hash
      await confirm(hash, 'Waiting for Arc confirmation')
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['ursa'] }), queryClient.invalidateQueries({ queryKey: ['balance'] })])
      setToast({ state: 'success', text: success, onchain: true, hash: finalSubmittedHash })
      window.setTimeout(() => setToast(null), 4000)
      return true
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message.split('\n')[0] : 'Transaction rejected'
      const message = rawMessage.includes('WalletLimitReached') ? 'This wallet has reached the 10 NFT mint limit.' : rawMessage.includes('MaxSupplyReached') ? 'The 24 NFT collection is sold out.' : rawMessage
      if (finalSubmittedHash && !message.toLowerCase().includes('revert')) {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: finalSubmittedHash })
          if (receipt.status === 'success') {
            await queryClient.invalidateQueries({ queryKey: ['ursa'] })
            setToast({ state: 'success', text: success, onchain: true, hash: finalSubmittedHash })
            window.setTimeout(() => setToast(null), 5000)
            return true
          }
        } catch {
          setToast({ state: 'submitted', text: 'Transaction submitted. Arc RPC confirmation is delayed.', onchain: true, hash: finalSubmittedHash })
          window.setTimeout(() => queryClient.invalidateQueries({ queryKey: ['ursa'] }), 5000)
          window.setTimeout(() => setToast(null), 8000)
          return true
        }
      }
      setToast({ state: 'failed', text: message.length > 90 ? `${message.slice(0, 87)}...` : message })
      window.setTimeout(() => setToast(null), 6000)
      return false
    }
  }
  const value = { runAction, openWallet: () => setWalletOpen(true) }
  return <ActionContext.Provider value={value}>{children}{walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}{toast && <div className={`toast toast--${toast.state}`}>{toast.state === 'success' ? <Check size={17} /> : toast.state === 'failed' ? <X size={17} /> : <span className="spinner" />}<div><small>{toast.state === 'signing' ? 'Signature requested' : toast.state === 'pending' ? 'Transaction pending' : toast.state === 'submitted' ? 'Submitted to Arc' : toast.state === 'success' ? (toast.onchain ? 'Confirmed on Arc' : 'Preview complete') : 'Transaction failed'}</small><b>{toast.text}</b>{toast.hash && <a className="toast-link" href={`${arcTestnet.blockExplorers.default.url}/tx/${toast.hash}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={11} /></a>}</div></div>}</ActionContext.Provider>
}

function AppContent() {
  const { openWallet } = useActions()
  return (
    <>
      <ScrollRestoration />
      <Header openWallet={openWallet} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/mint" element={<MintPage />} />
        <Route path="/raffles" element={<RafflesPage />} />
        <Route path="/raffles/:id" element={<RaffleDetail />} />
        <Route path="/auctions" element={<AuctionsPage />} />
        <Route path="/auctions/:id" element={<AuctionDetail />} />
        <Route path="/lend" element={<LendingPage />} />
        <Route path="/lend/:id" element={<LoanDetail />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="*" element={<EmptyRoute />} />
      </Routes>
      <Footer />
    </>
  )
}

export default function App() {
  return <ActionProvider><AppContent /></ActionProvider>
}
