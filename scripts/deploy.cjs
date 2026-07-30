const { ethers } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()
  const usdc = process.env.USDC_ADDRESS || '0x3600000000000000000000000000000000000000'
  const baseURI = process.env.NFT_BASE_URI || 'https://ursa-arcana.example/metadata/'

  const nft = await ethers.deployContract('UrsaArcanaNFT', [baseURI, deployer.address])
  const raffle = await ethers.deployContract('UrsaRaffle', [usdc, deployer.address])
  const auction = await ethers.deployContract('UrsaAuction', [usdc, deployer.address])
  const lending = await ethers.deployContract('UrsaLending', [usdc, deployer.address])
  await Promise.all([nft.waitForDeployment(), raffle.waitForDeployment(), auction.waitForDeployment(), lending.waitForDeployment()])

  const nftAddress = await nft.getAddress()
  const allowTransactions = await Promise.all([
    raffle.setCollectionAllowed(nftAddress, true),
    auction.setCollectionAllowed(nftAddress, true),
    lending.setCollectionAllowed(nftAddress, true),
  ])
  await Promise.all(allowTransactions.map(transaction => transaction.wait()))

  await (await nft.adminMint(deployer.address, 3)).wait()
  await (await nft.approve(await raffle.getAddress(), 1)).wait()
  await (await nft.approve(await auction.getAddress(), 2)).wait()
  await (await nft.approve(await lending.getAddress(), 3)).wait()

  const latestBlock = await ethers.provider.getBlock('latest')
  const startAt = latestBlock.timestamp + 90
  const endAt = startAt + (7 * 24 * 60 * 60)
  const secret = ethers.id(`ursa-raffle-${Date.now()}`)
  const commitment = ethers.solidityPackedKeccak256(['bytes32', 'address', 'uint256'], [secret, deployer.address, 1])
  await (await raffle.createRaffle(nftAddress, 1, ethers.parseUnits('4', 6), 220, endAt, commitment)).wait()
  await (await auction.createAuction(nftAddress, 2, startAt, endAt, ethers.parseUnits('200', 6), 500)).wait()
  await (await lending.createLoanRequest(nftAddress, 3, ethers.parseUnits('180', 6), ethers.parseUnits('18', 6), endAt, 14 * 24 * 60 * 60)).wait()

  console.log(JSON.stringify({
    NEXT_PUBLIC_USDC_ADDRESS: usdc,
    NEXT_PUBLIC_URSA_NFT_ADDRESS: nftAddress,
    NEXT_PUBLIC_RAFFLE_ADDRESS: await raffle.getAddress(),
    NEXT_PUBLIC_AUCTION_ADDRESS: await auction.getAddress(),
    NEXT_PUBLIC_LENDING_ADDRESS: await lending.getAddress(),
    RAFFLE_1_SECRET: secret,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
