const { ethers } = require('hardhat')

const collections = [
  { key: 'BLUE_HOUR', name: 'Ursa Arcana: Blue Hour', symbol: 'URSA-BLUE', price: '1', baseEnv: 'NFT_BASE_URI_BLUE_HOUR' },
  { key: 'DEEP_CURRENT', name: 'Ursa Arcana: Deep Current', symbol: 'URSA-DEEP', price: '2', baseEnv: 'NFT_BASE_URI_DEEP_CURRENT' },
  { key: 'NIGHT_LEDGER', name: 'Ursa Arcana: Night Ledger', symbol: 'URSA-NIGHT', price: '3', baseEnv: 'NFT_BASE_URI_NIGHT_LEDGER' },
]

async function main() {
  const [deployer] = await ethers.getSigners()
  if (!deployer) throw new Error('DEPLOYER_PRIVATE_KEY is not configured.')

  const usdc = process.env.USDC_ADDRESS || '0x3600000000000000000000000000000000000000'
  const treasury = process.env.NFT_TREASURY || deployer.address
  const defaultBase = process.env.NFT_BASE_URI || 'https://your-domain.example/metadata/'
  const utilityAddresses = [process.env.NEXT_PUBLIC_RAFFLE_ADDRESS, process.env.NEXT_PUBLIC_AUCTION_ADDRESS, process.env.NEXT_PUBLIC_LENDING_ADDRESS].filter(Boolean)
  const deployed = {}

  for (const collection of collections) {
    const baseURI = process.env[collection.baseEnv] || `${defaultBase.replace(/\/?$/, '/')}${collection.key.toLowerCase()}/`
    const nft = await ethers.deployContract('UrsaArcanaPaidNFT', [collection.name, collection.symbol, baseURI, usdc, ethers.parseUnits(collection.price, 6), treasury, deployer.address])
    await nft.waitForDeployment()
    const address = await nft.getAddress()
    deployed[`NEXT_PUBLIC_URSA_${collection.key}_ADDRESS`] = address
    console.log(`${collection.key}: ${address}`)
    console.log(`Base URI: ${baseURI}`)

    for (const utilityAddress of utilityAddresses) {
      const utility = await ethers.getContractAt(['function setCollectionAllowed(address collection, bool allowed)'], utilityAddress, deployer)
      await (await utility.setCollectionAllowed(address, true)).wait()
      console.log(`Allowlisted on ${utilityAddress}`)
    }
  }

  console.log(JSON.stringify(deployed, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
