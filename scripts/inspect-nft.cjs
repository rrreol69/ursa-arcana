const { ethers } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()
  const nft = await ethers.getContractAt('UrsaArcanaNFT', process.env.NEXT_PUBLIC_URSA_NFT_ADDRESS)
  const supply = Number(await nft.totalSupply())
  console.log(`Deployer: ${deployer.address}`)
  console.log(`Supply: ${supply}`)
  for (let tokenId = 1; tokenId <= supply; tokenId += 1) {
    console.log(`Token ${tokenId}: owner=${await nft.ownerOf(tokenId)} approved=${await nft.getApproved(tokenId)}`)
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
