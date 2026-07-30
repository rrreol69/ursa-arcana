export type Raffle = {
  id: number
  onchainId?: number
  nftId: number
  ticketPrice: number
  sold: number
  maxTickets: number
  ends: string
  status: 'live' | 'ending' | 'settled'
  creator: string
  entrants: number
}

export type Auction = {
  id: number
  onchainId?: number
  nftId: number
  currentBid: number
  reserve: number
  bids: number
  ends: string
  status: 'live' | 'ending' | 'settled'
  seller: string
  bidder: string
}

export type Loan = {
  id: number
  onchainId?: number
  nftId: number
  principal: number
  interest: number
  duration: number
  deadline: string
  status: 'open' | 'funded' | 'repaid'
  borrower: string
}

export const nftNames = [
  'Keeper of First Light', 'Indigo Cartographer', 'The Quiet Oracle', 'Ember Archivist',
  'Warden of Tides', 'Gilded Wayfinder', 'Astral Botanist', 'Keeper of the Rift',
  'The Night Alchemist', 'Aurora Sentinel', 'Moonwell Scribe', 'The Cinder Seer',
  'Vault Listener', 'Comet Shepherd', 'The Azure Regent', 'Starlit Antiquarian',
  'Oracle of Moss', 'Celestial Locksmith', 'The Golden Pilgrim', 'Nebula Gardener',
  'Midnight Curator', 'Arcane Mariner', 'The Last Astrologer', 'Guardian of Arc'
]

const roles = ['Keeper', 'Oracle', 'Archivist', 'Wayfinder', 'Sentinel', 'Alchemist']
const auras = ['Aurora', 'Ember', 'Tidal', 'Gilded', 'Void', 'Verdant']

export const nfts = nftNames.map((name, index) => ({
  id: index + 1,
  name,
  role: roles[index % roles.length],
  aura: auras[(index * 5 + 1) % auras.length],
  rarity: index === 7 || index === 23 ? 'Mythic' : index % 4 === 0 ? 'Rare' : 'Arcane',
}))

export const raffles: Raffle[] = [
  { id: 104, onchainId: 1, nftId: 1, ticketPrice: 4, sold: 172, maxTickets: 220, ends: '02h 14m', status: 'ending', creator: '0x71b4…2e91', entrants: 89 },
  { id: 103, nftId: 2, ticketPrice: 2.5, sold: 84, maxTickets: 180, ends: '11h 38m', status: 'live', creator: '0x0a93…81f4', entrants: 47 },
  { id: 102, nftId: 15, ticketPrice: 6, sold: 121, maxTickets: 160, ends: '1d 08h', status: 'live', creator: '0xc416…37ad', entrants: 72 },
  { id: 101, nftId: 19, ticketPrice: 3, sold: 140, maxTickets: 140, ends: 'Revealed', status: 'settled', creator: '0x87d2…ea08', entrants: 104 },
  { id: 100, nftId: 5, ticketPrice: 1.5, sold: 96, maxTickets: 120, ends: 'Settled', status: 'settled', creator: '0x22ac…06e3', entrants: 61 },
  { id: 99, nftId: 12, ticketPrice: 5, sold: 73, maxTickets: 100, ends: 'Settled', status: 'settled', creator: '0x6bf9…90dc', entrants: 51 },
]

export const auctions: Auction[] = [
  { id: 78, onchainId: 1, nftId: 2, currentBid: 286, reserve: 200, bids: 18, ends: '00h 46m', status: 'ending', seller: '0x3df2…e102', bidder: '0x92c1…630b' },
  { id: 77, nftId: 10, currentBid: 124, reserve: 100, bids: 11, ends: '06h 22m', status: 'live', seller: '0xc416…37ad', bidder: '0xa6b9…421e' },
  { id: 76, nftId: 4, currentBid: 72, reserve: 80, bids: 6, ends: '18h 07m', status: 'live', seller: '0x71b4…2e91', bidder: '0xf704…1bf8' },
  { id: 75, nftId: 17, currentBid: 198, reserve: 160, bids: 14, ends: '1d 03h', status: 'live', seller: '0x0a93…81f4', bidder: '0x7d1e…993c' },
  { id: 74, nftId: 9, currentBid: 94, reserve: 75, bids: 9, ends: 'Settled', status: 'settled', seller: '0xd092…75a2', bidder: '0x403c…ee29' },
  { id: 73, nftId: 21, currentBid: 148, reserve: 130, bids: 12, ends: 'Settled', status: 'settled', seller: '0x6880…1ad4', bidder: '0x16a8…c809' },
]

export const loans: Loan[] = [
  { id: 44, onchainId: 1, nftId: 3, principal: 180, interest: 18, duration: 14, deadline: '08h 34m', status: 'open', borrower: '0x71b4…2e91' },
  { id: 43, nftId: 13, principal: 95, interest: 8, duration: 7, deadline: '1d 04h', status: 'open', borrower: '0x32d6…7ca1' },
  { id: 42, nftId: 3, principal: 240, interest: 29, duration: 21, deadline: '2d 11h', status: 'open', borrower: '0xc416…37ad' },
  { id: 41, nftId: 20, principal: 120, interest: 11, duration: 10, deadline: '9 days left', status: 'funded', borrower: '0x19e4…a720' },
  { id: 40, nftId: 6, principal: 315, interest: 38, duration: 30, deadline: '16 days left', status: 'funded', borrower: '0x97a1…bc14' },
  { id: 39, nftId: 16, principal: 150, interest: 15, duration: 14, deadline: 'Repaid', status: 'repaid', borrower: '0x08d7…44a9' },
]

export const activity = [
  { event: '12 tickets purchased', user: '0x92c1…630b', time: '2 min ago', amount: '48 USDC' },
  { event: '5 tickets purchased', user: '0xa6b9…421e', time: '8 min ago', amount: '20 USDC' },
  { event: '18 tickets purchased', user: '0x403c…ee29', time: '24 min ago', amount: '72 USDC' },
  { event: 'Raffle created', user: '0x71b4…2e91', time: '2 days ago', amount: '—' },
]

export const bidHistory = [
  { event: 'Bid placed', user: '0x92c1…630b', time: '6 min ago', amount: '286 USDC' },
  { event: 'Bid placed', user: '0x16a8…c809', time: '21 min ago', amount: '265 USDC' },
  { event: 'Bid placed', user: '0x92c1…630b', time: '1 hr ago', amount: '242 USDC' },
  { event: 'Auction created', user: '0x3df2…e102', time: '3 days ago', amount: '200 USDC' },
]
