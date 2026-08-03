import { parseAbi, type Address } from 'viem'

export const addresses = {
  nft: import.meta.env.NEXT_PUBLIC_URSA_NFT_ADDRESS,
  legacyNft: import.meta.env.NEXT_PUBLIC_LEGACY_NFT_ADDRESS,
  collection3: import.meta.env.NEXT_PUBLIC_URSA_BLUE_HOUR_ADDRESS,
  collection4: import.meta.env.NEXT_PUBLIC_URSA_DEEP_CURRENT_ADDRESS,
  collection5: import.meta.env.NEXT_PUBLIC_URSA_NIGHT_LEDGER_ADDRESS,
  raffle: import.meta.env.NEXT_PUBLIC_RAFFLE_ADDRESS,
  auction: import.meta.env.NEXT_PUBLIC_AUCTION_ADDRESS,
  lending: import.meta.env.NEXT_PUBLIC_LENDING_ADDRESS,
} as const

export type CollectionId = 'genesis' | 'legacy' | 'blue-hour' | 'deep-current' | 'night-ledger'

export type CollectionConfig = {
  id: CollectionId
  name: string
  shortName: string
  contract?: Address
  mintPrice: bigint | null
  mintable: boolean
  description: string
  accent: string
}

export const collectionCatalog: CollectionConfig[] = [
  { id: 'genesis', name: 'Genesis Keepers', shortName: 'Genesis', contract: addresses.nft, mintPrice: 0n, mintable: true, description: 'The original Ursa Arcana collection. Free mint, gas only.', accent: 'indigo' },
  { id: 'legacy', name: 'Legacy Keepers', shortName: 'Legacy', contract: addresses.legacyNft, mintPrice: null, mintable: false, description: 'The first generation collection. Available across every utility, not open for new minting.', accent: 'slate' },
  { id: 'blue-hour', name: 'Blue Hour', shortName: 'Blue Hour', contract: addresses.collection3, mintPrice: 1_000_000n, mintable: true, description: 'A cool-edged set of Keepers for collectors entering at one USDC.', accent: 'sky' },
  { id: 'deep-current', name: 'Deep Current', shortName: 'Deep Current', contract: addresses.collection4, mintPrice: 2_000_000n, mintable: true, description: 'A deeper signal from the Arcana, priced at two USDC per Keeper.', accent: 'blue' },
  { id: 'night-ledger', name: 'Night Ledger', shortName: 'Night Ledger', contract: addresses.collection5, mintPrice: 3_000_000n, mintable: true, description: 'The most limited new chapter, with three USDC minting.', accent: 'midnight' },
]

export function collectionForAddress(address?: string) {
  return collectionCatalog.find(collection => Boolean(address && collection.contract && address.toLowerCase() === collection.contract.toLowerCase()))
}

export const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

export const nftAbi = parseAbi([
  'function mint(uint256 quantity)',
  'function usdc() view returns (address)',
  'function mintPrice() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function MAX_PER_WALLET() view returns (uint256)',
  'function mintedBy(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function approve(address to, uint256 tokenId)',
])

export const raffleAbi = parseAbi([
  'function raffleCount() view returns (uint256)',
  'function raffles(uint256) view returns (address creator, address nftContract, uint256 tokenId, uint256 ticketPrice, uint256 maxTickets, uint256 ticketsSold, uint64 endAt, uint64 revealDeadline, bytes32 commitment, address winner, uint8 state, bool prizeClaimed, bool proceedsClaimed)',
  'function ticketsByOwner(uint256 raffleId, address owner) view returns (uint256)',
  'function ticketOwnerAt(uint256 raffleId, uint256 index) view returns (address)',
  'function createRaffle(address nftContract, uint256 tokenId, uint256 ticketPrice, uint256 maxTickets, uint64 endAt, bytes32 commitment) returns (uint256)',
  'function buyTickets(uint256 raffleId, uint256 quantity)',
  'function revealWinner(uint256 raffleId, bytes32 secret)',
  'function cancelUnrevealed(uint256 raffleId)',
  'function claimPrize(uint256 raffleId)',
  'function claimProceeds(uint256 raffleId)',
  'function claimRefund(uint256 raffleId)',
  'event TicketsPurchased(uint256 indexed raffleId, address indexed buyer, uint256 quantity, uint256 cost)',
  'event WinnerRevealed(uint256 indexed raffleId, address indexed winner, uint256 winningIndex)',
])

export const auctionAbi = parseAbi([
  'function auctionCount() view returns (uint256)',
  'function auctions(uint256) view returns (address seller, address nftContract, uint256 tokenId, uint256 reservePrice, uint256 highestBid, address highestBidder, uint64 startAt, uint64 endAt, uint64 originalEndAt, uint16 minIncrementBps, uint8 state, bool sold, bool nftClaimed, bool proceedsClaimed)',
  'function withdrawableBids(uint256 auctionId, address bidder) view returns (uint256)',
  'function createAuction(address nftContract, uint256 tokenId, uint64 startAt, uint64 endAt, uint256 reservePrice, uint16 minIncrementBps) returns (uint256)',
  'function placeBid(uint256 auctionId, uint256 amount)',
  'function withdrawBid(uint256 auctionId)',
  'function cancelAuction(uint256 auctionId)',
  'function settleAuction(uint256 auctionId)',
  'function claimNFT(uint256 auctionId)',
  'function claimProceeds(uint256 auctionId)',
  'event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount, uint256 endAt)',
  'event AuctionSettled(uint256 indexed auctionId, bool sold, address winner, uint256 amount)',
])

export const lendingAbi = parseAbi([
  'function loanCount() view returns (uint256)',
  'function loans(uint256) view returns (address borrower, address lender, address nftContract, uint256 tokenId, uint256 principal, uint256 interest, uint64 fundingDeadline, uint64 duration, uint64 dueAt, uint8 state, bool lenderClaimed, bool collateralClaimed)',
  'function createLoanRequest(address nftContract, uint256 tokenId, uint256 principal, uint256 interest, uint64 fundingDeadline, uint64 duration) returns (uint256)',
  'function cancelLoanRequest(uint256 loanId)',
  'function fundLoan(uint256 loanId)',
  'function repayLoan(uint256 loanId)',
  'function claimLenderRepayment(uint256 loanId)',
  'function claimBorrowerCollateral(uint256 loanId)',
  'function claimDefaultCollateral(uint256 loanId)',
])
