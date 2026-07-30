const { ethers } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()
  if (!deployer) throw new Error('DEPLOYER_PRIVATE_KEY is not configured.')

  const balance = await ethers.provider.getBalance(deployer.address)
  const baseURI = process.env.NFT_BASE_URI || 'http://127.0.0.1:4173/metadata/'

  console.log(`Deployer: ${deployer.address}`)
  console.log(`Native balance: ${ethers.formatEther(balance)} USDC`)
  console.log(`Base URI: ${baseURI}`)

  const nft = await ethers.deployContract('UrsaArcanaNFT', [baseURI, deployer.address])
  console.log(`Deployment transaction: ${nft.deploymentTransaction().hash}`)
  await nft.waitForDeployment()

  const address = await nft.getAddress()
  console.log(`NEXT_PUBLIC_URSA_NFT_ADDRESS=${address}`)
  console.log(`ArcScan: https://testnet.arcscan.app/address/${address}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
