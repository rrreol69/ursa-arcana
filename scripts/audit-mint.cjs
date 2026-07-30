const { ethers } = require('hardhat')

async function main() {
  const nft = await ethers.getContractAt('UrsaArcanaNFT', process.env.NEXT_PUBLIC_URSA_NFT_ADDRESS)
  const supply = Number(await nft.totalSupply())
  console.log(`Contract: ${await nft.getAddress()}`)
  console.log(`Supply: ${supply}/${await nft.MAX_SUPPLY()}`)
  console.log(`Paused: ${await nft.paused()}`)

  const owners = new Map()
  for (let tokenId = 1; tokenId <= supply; tokenId += 1) {
    const owner = await nft.ownerOf(tokenId)
    owners.set(owner, [...(owners.get(owner) || []), tokenId])
  }

  for (const [owner, tokenIds] of owners) {
    console.log(`${owner}: tokens=[${tokenIds.join(',')}] mintedBy=${await nft.mintedBy(owner)}`)
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
