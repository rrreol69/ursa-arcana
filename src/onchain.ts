import { useQuery } from '@tanstack/react-query'
import { decodeEventLog, zeroAddress, type Address, type Hex } from 'viem'
import { usePublicClient } from 'wagmi'
import { addresses, auctionAbi, collectionCatalog, type CollectionConfig, lendingAbi, nftAbi, raffleAbi } from './contracts'
import { arcTestnet } from './wallet'

export type ChainRaffle = {
  id: number
  creator: Address
  nftContract: Address
  tokenId: number
  ticketPrice: bigint
  maxTickets: number
  ticketsSold: number
  endAt: number
  revealDeadline: number
  commitment: `0x${string}`
  winner: Address
  state: number
  prizeClaimed: boolean
  proceedsClaimed: boolean
  userTickets: number
}

export type ChainAuction = {
  id: number
  seller: Address
  nftContract: Address
  tokenId: number
  reservePrice: bigint
  highestBid: bigint
  highestBidder: Address
  startAt: number
  endAt: number
  originalEndAt: number
  minIncrementBps: number
  state: number
  sold: boolean
  nftClaimed: boolean
  proceedsClaimed: boolean
  withdrawable: bigint
}

export type ChainLoan = {
  id: number
  borrower: Address
  lender: Address
  nftContract: Address
  tokenId: number
  principal: bigint
  interest: bigint
  fundingDeadline: number
  duration: number
  dueAt: number
  state: number
  lenderClaimed: boolean
  collateralClaimed: boolean
}

export type OwnedArtifact = {
  collection: Address
  tokenId: number
  legacy: boolean
  collectionId: string
  collectionName: string
}

export type RaffleParticipant = {
  address: Address
  tickets: number
  spent: bigint
  purchases: number
  lastEnteredAt: string
  transactionHash: Hex
}

export type RaffleOutcome = {
  winner: Address
  winningIndex: number
  blockNumber: number
  revealedAt: string
  transactionHash: Hex
}

export type RaffleActivity = {
  participants: RaffleParticipant[]
  totalTickets: number
  outcome?: RaffleOutcome
}

export type AuctionBid = {
  bidder: Address
  amount: bigint
  endAt: number
  blockNumber: number
  logIndex: number
  placedAt: string
  transactionHash: Hex
}

export type AuctionOutcome = {
  sold: boolean
  winner: Address
  amount: bigint
  blockNumber: number
  settledAt: string
  transactionHash: Hex
}

export type AuctionActivity = {
  bids: AuctionBid[]
  contributorCount: number
  outcome?: AuctionOutcome
}

type ExplorerLog = {
  block_number: number
  block_timestamp: string
  data: Hex
  index: number
  topics: Array<Hex | null>
  transaction_hash: Hex
}

type ExplorerLogPage = {
  items: ExplorerLog[]
  next_page_params: Record<string, string | number> | null
}

const explorerApiUrl = `${arcTestnet.blockExplorers.default.url}/api/v2`

function compactTopics(topics: Array<Hex | null>) {
  const values = topics.filter((topic): topic is Hex => Boolean(topic))
  if (!values.length) throw new Error('Event log has no signature topic.')
  return values as [Hex, ...Hex[]]
}

async function fetchContractLogs(address: Address) {
  const items: ExplorerLog[] = []
  let nextPage: ExplorerLogPage['next_page_params'] = null

  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`${explorerApiUrl}/addresses/${address}/logs`)
    if (nextPage) Object.entries(nextPage).forEach(([key, value]) => url.searchParams.set(key, String(value)))
    const response = await fetch(url)
    if (!response.ok) throw new Error(`ArcScan activity request failed with ${response.status}.`)
    const data = await response.json() as ExplorerLogPage
    items.push(...data.items)
    nextPage = data.next_page_params
    if (!nextPage) break
  }

  return items
}

const normalize = (address?: Address) => address?.toLowerCase()

export function useNftSupply() {
  const client = usePublicClient({ chainId: arcTestnet.id })
  return useQuery({
    queryKey: ['ursa', 'nft-supply', addresses.nft],
    enabled: Boolean(client && addresses.nft),
    refetchInterval: 15_000,
    queryFn: async () => Number(await client!.readContract({ address: addresses.nft!, abi: nftAbi, functionName: 'totalSupply' })),
  })
}

export function useMintStatus(owner?: Address) {
  const client = usePublicClient({ chainId: arcTestnet.id })
  return useQuery({
    queryKey: ['ursa', 'mint-status', addresses.nft, owner],
    enabled: Boolean(client && addresses.nft && owner),
    refetchInterval: 15_000,
    queryFn: async () => {
      const [supply, maxSupply, minted, walletLimit] = await Promise.all([
        client!.readContract({ address: addresses.nft!, abi: nftAbi, functionName: 'totalSupply' }),
        client!.readContract({ address: addresses.nft!, abi: nftAbi, functionName: 'MAX_SUPPLY' }),
        client!.readContract({ address: addresses.nft!, abi: nftAbi, functionName: 'mintedBy', args: [owner!] }),
        client!.readContract({ address: addresses.nft!, abi: nftAbi, functionName: 'MAX_PER_WALLET' }),
      ])
      return { supply: Number(supply), maxSupply: Number(maxSupply), minted: Number(minted), walletLimit: Number(walletLimit) }
    },
  })
}

export function useCollectionMintStatus(collection: CollectionConfig, owner?: Address) {
  const client = usePublicClient({ chainId: arcTestnet.id })
  return useQuery({
    queryKey: ['ursa', 'mint-status', collection.id, collection.contract, owner],
    enabled: Boolean(client && collection.contract),
    refetchInterval: 15_000,
    queryFn: async () => {
      const [supply, maxSupply, minted, walletLimit, onchainMintPrice] = await Promise.all([
        client!.readContract({ address: collection.contract!, abi: nftAbi, functionName: 'totalSupply' }),
        client!.readContract({ address: collection.contract!, abi: nftAbi, functionName: 'MAX_SUPPLY' }),
        owner ? client!.readContract({ address: collection.contract!, abi: nftAbi, functionName: 'mintedBy', args: [owner] }) : 0n,
        client!.readContract({ address: collection.contract!, abi: nftAbi, functionName: 'MAX_PER_WALLET' }),
        collection.mintable && (collection.mintPrice ?? 0n) > 0n
          ? client!.readContract({ address: collection.contract!, abi: nftAbi, functionName: 'mintPrice' }).catch(() => collection.mintPrice ?? 0n)
          : collection.mintPrice ?? 0n,
      ])
      return { supply: Number(supply), maxSupply: Number(maxSupply), minted: Number(minted), walletLimit: Number(walletLimit), mintPrice: onchainMintPrice }
    },
  })
}

export function useOwnedNfts(owner?: Address) {
  const client = usePublicClient({ chainId: arcTestnet.id })
  const configuredCollections = collectionCatalog.filter(collection => Boolean(collection.contract))
  return useQuery({
    queryKey: ['ursa', 'nfts', configuredCollections.map(collection => collection.contract), owner],
    enabled: Boolean(client && configuredCollections.length && owner),
    refetchInterval: 15_000,
    queryFn: async () => {
      const collections = configuredCollections.filter((collection, index, all) => all.findIndex(item => item.contract?.toLowerCase() === collection.contract?.toLowerCase()) === index)
      const scans = await Promise.allSettled(collections.map(async config => {
        const collectionAddress = config.contract!
        const supply = Number(await client!.readContract({ address: collectionAddress, abi: nftAbi, functionName: 'totalSupply' }))
        const ownership = await Promise.allSettled(Array.from({ length: supply }, (_, index) => client!.readContract({ address: collectionAddress, abi: nftAbi, functionName: 'ownerOf', args: [BigInt(index + 1)] })))
        return ownership.flatMap((result, index): OwnedArtifact[] => result.status === 'fulfilled' && normalize(result.value) === normalize(owner) ? [{ collection: collectionAddress, tokenId: index + 1, legacy: config.id === 'legacy', collectionId: config.id, collectionName: config.name }] : [])
      }))
      if (scans.every(result => result.status === 'rejected')) throw scans[0].reason
      return scans.flatMap(result => result.status === 'fulfilled' ? result.value : [])
    },
  })
}

export function useRaffles(user?: Address) {
  const client = usePublicClient({ chainId: arcTestnet.id })
  return useQuery({
    queryKey: ['ursa', 'raffles', addresses.raffle, user],
    enabled: Boolean(client && addresses.raffle),
    refetchInterval: 15_000,
    queryFn: async () => {
      const count = Number(await client!.readContract({ address: addresses.raffle!, abi: raffleAbi, functionName: 'raffleCount' }))
      return Promise.all(Array.from({ length: count }, async (_, index): Promise<ChainRaffle> => {
        const id = index + 1
        const [row, userTickets] = await Promise.all([
          client!.readContract({ address: addresses.raffle!, abi: raffleAbi, functionName: 'raffles', args: [BigInt(id)] }),
          user ? client!.readContract({ address: addresses.raffle!, abi: raffleAbi, functionName: 'ticketsByOwner', args: [BigInt(id), user] }) : 0n,
        ])
        return { id, creator: row[0], nftContract: row[1], tokenId: Number(row[2]), ticketPrice: row[3], maxTickets: Number(row[4]), ticketsSold: Number(row[5]), endAt: Number(row[6]), revealDeadline: Number(row[7]), commitment: row[8], winner: row[9], state: row[10], prizeClaimed: row[11], proceedsClaimed: row[12], userTickets: Number(userTickets) }
      }))
    },
  })
}

export function useAuctions(user?: Address) {
  const client = usePublicClient({ chainId: arcTestnet.id })
  return useQuery({
    queryKey: ['ursa', 'auctions', addresses.auction, user],
    enabled: Boolean(client && addresses.auction),
    refetchInterval: 15_000,
    queryFn: async () => {
      const count = Number(await client!.readContract({ address: addresses.auction!, abi: auctionAbi, functionName: 'auctionCount' }))
      return Promise.all(Array.from({ length: count }, async (_, index): Promise<ChainAuction> => {
        const id = index + 1
        const [row, withdrawable] = await Promise.all([
          client!.readContract({ address: addresses.auction!, abi: auctionAbi, functionName: 'auctions', args: [BigInt(id)] }),
          user ? client!.readContract({ address: addresses.auction!, abi: auctionAbi, functionName: 'withdrawableBids', args: [BigInt(id), user] }) : 0n,
        ])
        return { id, seller: row[0], nftContract: row[1], tokenId: Number(row[2]), reservePrice: row[3], highestBid: row[4], highestBidder: row[5], startAt: Number(row[6]), endAt: Number(row[7]), originalEndAt: Number(row[8]), minIncrementBps: row[9], state: row[10], sold: row[11], nftClaimed: row[12], proceedsClaimed: row[13], withdrawable }
      }))
    },
  })
}

export function useRaffleActivity(raffleId?: number) {
  return useQuery({
    queryKey: ['ursa', 'raffle-activity', addresses.raffle, raffleId],
    enabled: Boolean(addresses.raffle && raffleId && raffleId > 0),
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<RaffleActivity> => {
      const logs = await fetchContractLogs(addresses.raffle!)
      const entries = new Map<string, RaffleParticipant>()
      let outcome: RaffleOutcome | undefined

      for (const log of logs) {
        try {
          const decoded = decodeEventLog({ abi: raffleAbi, data: log.data, topics: compactTopics(log.topics), strict: false })
          if (decoded.eventName === 'TicketsPurchased' && Number(decoded.args.raffleId) === raffleId && decoded.args.buyer && decoded.args.quantity !== undefined && decoded.args.cost !== undefined) {
            const buyer = decoded.args.buyer
            const key = buyer.toLowerCase()
            const previous = entries.get(key)
            const isLatest = !previous || new Date(log.block_timestamp).getTime() > new Date(previous.lastEnteredAt).getTime()
            entries.set(key, {
              address: buyer,
              tickets: (previous?.tickets ?? 0) + Number(decoded.args.quantity),
              spent: (previous?.spent ?? 0n) + decoded.args.cost,
              purchases: (previous?.purchases ?? 0) + 1,
              lastEnteredAt: isLatest ? log.block_timestamp : previous.lastEnteredAt,
              transactionHash: isLatest ? log.transaction_hash : previous.transactionHash,
            })
          }
          if (decoded.eventName === 'WinnerRevealed' && Number(decoded.args.raffleId) === raffleId && decoded.args.winner && decoded.args.winningIndex !== undefined) {
            if (!outcome || log.block_number > outcome.blockNumber) {
              outcome = {
                winner: decoded.args.winner,
                winningIndex: Number(decoded.args.winningIndex),
                blockNumber: log.block_number,
                revealedAt: log.block_timestamp,
                transactionHash: log.transaction_hash,
              }
            }
          }
        } catch {
          // Ignore unrelated logs emitted by inherited contracts.
        }
      }

      const participants = [...entries.values()].sort((a, b) => b.tickets - a.tickets || a.address.localeCompare(b.address))
      return { participants, totalTickets: participants.reduce((sum, participant) => sum + participant.tickets, 0), outcome }
    },
  })
}

export function useAuctionActivity(auctionId?: number) {
  return useQuery({
    queryKey: ['ursa', 'auction-activity', addresses.auction, auctionId],
    enabled: Boolean(addresses.auction && auctionId && auctionId > 0),
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<AuctionActivity> => {
      const logs = await fetchContractLogs(addresses.auction!)
      const bids: AuctionBid[] = []
      let outcome: AuctionOutcome | undefined

      for (const log of logs) {
        try {
          const decoded = decodeEventLog({ abi: auctionAbi, data: log.data, topics: compactTopics(log.topics), strict: false })
          if (decoded.eventName === 'BidPlaced' && Number(decoded.args.auctionId) === auctionId && decoded.args.bidder && decoded.args.amount !== undefined && decoded.args.endAt !== undefined) {
            bids.push({
              bidder: decoded.args.bidder,
              amount: decoded.args.amount,
              endAt: Number(decoded.args.endAt),
              blockNumber: log.block_number,
              logIndex: log.index,
              placedAt: log.block_timestamp,
              transactionHash: log.transaction_hash,
            })
          }
          if (decoded.eventName === 'AuctionSettled' && Number(decoded.args.auctionId) === auctionId && decoded.args.sold !== undefined && decoded.args.winner && decoded.args.amount !== undefined) {
            if (!outcome || log.block_number > outcome.blockNumber) {
              outcome = {
                sold: decoded.args.sold,
                winner: decoded.args.winner,
                amount: decoded.args.amount,
                blockNumber: log.block_number,
                settledAt: log.block_timestamp,
                transactionHash: log.transaction_hash,
              }
            }
          }
        } catch {
          // Ignore unrelated logs emitted by inherited contracts.
        }
      }

      bids.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
      return { bids, contributorCount: new Set(bids.map(bid => bid.bidder.toLowerCase())).size, outcome }
    },
  })
}

export function useLoans() {
  const client = usePublicClient({ chainId: arcTestnet.id })
  return useQuery({
    queryKey: ['ursa', 'loans', addresses.lending],
    enabled: Boolean(client && addresses.lending),
    refetchInterval: 15_000,
    queryFn: async () => {
      const count = Number(await client!.readContract({ address: addresses.lending!, abi: lendingAbi, functionName: 'loanCount' }))
      return Promise.all(Array.from({ length: count }, async (_, index): Promise<ChainLoan> => {
        const id = index + 1
        const row = await client!.readContract({ address: addresses.lending!, abi: lendingAbi, functionName: 'loans', args: [BigInt(id)] })
        return { id, borrower: row[0], lender: row[1] || zeroAddress, nftContract: row[2], tokenId: Number(row[3]), principal: row[4], interest: row[5], fundingDeadline: Number(row[6]), duration: Number(row[7]), dueAt: Number(row[8]), state: row[9], lenderClaimed: row[10], collateralClaimed: row[11] }
      }))
    },
  })
}
