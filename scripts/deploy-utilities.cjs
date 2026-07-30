const { ethers } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()
  const usdc = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000'
  const nftAddresses = [
    process.env.NEXT_PUBLIC_URSA_NFT_ADDRESS,
    process.env.NEXT_PUBLIC_LEGACY_NFT_ADDRESS,
    process.env.NEXT_PUBLIC_URSA_BLUE_HOUR_ADDRESS,
    process.env.NEXT_PUBLIC_URSA_DEEP_CURRENT_ADDRESS,
    process.env.NEXT_PUBLIC_URSA_NIGHT_LEDGER_ADDRESS,
  ].filter(Boolean).filter((address, index, all) => all.findIndex(item => item.toLowerCase() === address.toLowerCase()) === index)
  if (!nftAddresses.length) throw new Error('At least one NFT collection address is required.')

  const raffle = await ethers.deployContract('UrsaRaffle', [usdc, deployer.address])
  await raffle.waitForDeployment()
  const auction = await ethers.deployContract('UrsaAuction', [usdc, deployer.address])
  await auction.waitForDeployment()
  const lending = await ethers.deployContract('UrsaLending', [usdc, deployer.address])
  await lending.waitForDeployment()

  const raffleAddress = await raffle.getAddress()
  const auctionAddress = await auction.getAddress()
  const lendingAddress = await lending.getAddress()
  for (const nftAddress of nftAddresses) {
    await (await raffle.setCollectionAllowed(nftAddress, true)).wait()
    await (await auction.setCollectionAllowed(nftAddress, true)).wait()
    await (await lending.setCollectionAllowed(nftAddress, true)).wait()
    console.log(`Allowlisted NFT collection: ${nftAddress}`)
  }

  console.log(JSON.stringify({
    NEXT_PUBLIC_RAFFLE_ADDRESS: raffleAddress,
    NEXT_PUBLIC_AUCTION_ADDRESS: auctionAddress,
    NEXT_PUBLIC_LENDING_ADDRESS: lendingAddress,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
