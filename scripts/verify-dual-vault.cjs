const { ethers } = require('hardhat')

async function main() {
  const wallet = process.argv.find(argument => /^0x[0-9a-fA-F]{40}$/.test(argument)) || '0xDA73349520Dde2Ef7acF923C1581D7e91Fa96493'
  for (const [label, address] of [
    ['Current', process.env.NEXT_PUBLIC_URSA_NFT_ADDRESS],
    ['Legacy', process.env.NEXT_PUBLIC_LEGACY_NFT_ADDRESS],
  ]) {
    const nft = await ethers.getContractAt('UrsaArcanaNFT', address)
    const supply = Number(await nft.totalSupply())
    const owned = []
    for (let tokenId = 1; tokenId <= supply; tokenId += 1) {
      if ((await nft.ownerOf(tokenId)).toLowerCase() === wallet.toLowerCase()) owned.push(tokenId)
    }
    console.log(`${label} ${address}: supply=${supply}, owned=[${owned.join(',')}]`)
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
