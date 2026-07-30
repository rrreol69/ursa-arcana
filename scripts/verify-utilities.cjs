const { ethers } = require('hardhat')

async function main() {
  const collections = [
    ['Genesis', process.env.NEXT_PUBLIC_URSA_NFT_ADDRESS],
    ['Legacy', process.env.NEXT_PUBLIC_LEGACY_NFT_ADDRESS],
    ['Blue Hour', process.env.NEXT_PUBLIC_URSA_BLUE_HOUR_ADDRESS],
    ['Deep Current', process.env.NEXT_PUBLIC_URSA_DEEP_CURRENT_ADDRESS],
    ['Night Ledger', process.env.NEXT_PUBLIC_URSA_NIGHT_LEDGER_ADDRESS],
  ].filter(([, address]) => address)
  const raffle = await ethers.getContractAt('UrsaRaffle', process.env.NEXT_PUBLIC_RAFFLE_ADDRESS)
  const auction = await ethers.getContractAt('UrsaAuction', process.env.NEXT_PUBLIC_AUCTION_ADDRESS)
  const lending = await ethers.getContractAt('UrsaLending', process.env.NEXT_PUBLIC_LENDING_ADDRESS)

  console.log(`Raffle: cap=${ethers.formatUnits(await raffle.MAX_TICKET_PRICE(), 6)} USDC count=${await raffle.raffleCount()}`)
  console.log(`Auction: cap=${ethers.formatUnits(await auction.MAX_USDC_AMOUNT(), 6)} USDC count=${await auction.auctionCount()}`)
  console.log(`Lending: cap=${ethers.formatUnits(await lending.MAX_REPAYMENT(), 6)} USDC count=${await lending.loanCount()}`)
  for (const [name, address] of collections) {
    const paid = !['Genesis', 'Legacy'].includes(name)
    const nft = await ethers.getContractAt(paid ? 'UrsaArcanaPaidNFT' : 'UrsaArcanaNFT', address)
    const mintPrice = paid ? `${ethers.formatUnits(await nft.mintPrice(), 6)} USDC` : 'free'
    console.log(`${name} ${address}: raffle=${await raffle.allowedCollections(address)} auction=${await auction.allowedCollections(address)} lending=${await lending.allowedCollections(address)} supply=${await nft.totalSupply()}/${await nft.MAX_SUPPLY()} mintPrice=${mintPrice}`)
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
