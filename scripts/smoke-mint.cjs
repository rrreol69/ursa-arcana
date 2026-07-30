const { ethers } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()
  const address = process.env.NEXT_PUBLIC_URSA_NFT_ADDRESS
  if (!address) throw new Error('NEXT_PUBLIC_URSA_NFT_ADDRESS is not configured.')

  const nft = await ethers.getContractAt('UrsaArcanaNFT', address, deployer)
  const transaction = await nft.mint(1)
  console.log(`Mint transaction: ${transaction.hash}`)
  await transaction.wait()

  const totalSupply = await nft.totalSupply()
  const owner = await nft.ownerOf(totalSupply)
  const tokenURI = await nft.tokenURI(totalSupply)
  console.log(`Token ID: ${totalSupply}`)
  console.log(`Owner: ${owner}`)
  console.log(`Token URI: ${tokenURI}`)
  console.log(`ArcScan: https://testnet.arcscan.app/tx/${transaction.hash}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
