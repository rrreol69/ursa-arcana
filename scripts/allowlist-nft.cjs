const { ethers } = require('hardhat')

async function main() {
  const collections = [
    ['Genesis', process.env.NEXT_PUBLIC_URSA_NFT_ADDRESS],
    ['Legacy', process.env.NEXT_PUBLIC_LEGACY_NFT_ADDRESS],
    ['Blue Hour', process.env.NEXT_PUBLIC_URSA_BLUE_HOUR_ADDRESS],
    ['Deep Current', process.env.NEXT_PUBLIC_URSA_DEEP_CURRENT_ADDRESS],
    ['Night Ledger', process.env.NEXT_PUBLIC_URSA_NIGHT_LEDGER_ADDRESS],
  ].filter(([, address]) => address)
  if (!collections.length) throw new Error('At least one NFT collection address is required.')

  for (const [name, address] of [
    ['Raffle', process.env.NEXT_PUBLIC_RAFFLE_ADDRESS],
    ['Auction', process.env.NEXT_PUBLIC_AUCTION_ADDRESS],
    ['Lending', process.env.NEXT_PUBLIC_LENDING_ADDRESS],
  ]) {
    const contract = await ethers.getContractAt(`Ursa${name}`, address)
    for (const [collectionName, nftAddress] of collections) {
      await (await contract.setCollectionAllowed(nftAddress, true)).wait()
      console.log(`${name}: ${collectionName} ${nftAddress} allowlisted=${await contract.allowedCollections(nftAddress)}`)
    }
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
