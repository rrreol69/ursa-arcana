import { useQuery } from '@tanstack/react-query'
import { zeroAddress, type Address } from 'viem'
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
