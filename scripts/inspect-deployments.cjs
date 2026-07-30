const { ethers } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()
  const latest = await ethers.provider.getTransactionCount(deployer.address, 'latest')
  const pending = await ethers.provider.getTransactionCount(deployer.address, 'pending')
  console.log(`Deployer: ${deployer.address}`)
  console.log(`Nonce: latest=${latest} pending=${pending}`)

  for (let nonce = Math.max(0, latest - 8); nonce < pending + 1; nonce += 1) {
    const address = ethers.getCreateAddress({ from: deployer.address, nonce })
    const code = await ethers.provider.getCode(address)
    console.log(`nonce=${nonce} address=${address} codeBytes=${(code.length - 2) / 2}`)
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
