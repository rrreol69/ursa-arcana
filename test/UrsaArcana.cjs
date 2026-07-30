const { expect } = require('chai')
const { ethers } = require('hardhat')
const { time } = require('@nomicfoundation/hardhat-network-helpers')

const usdc = value => ethers.parseUnits(String(value), 6)

async function fixture() {
  const [admin, creator, buyer, bidder, lender] = await ethers.getSigners()
  const token = await ethers.deployContract('MockUSDC')
  const nft = await ethers.deployContract('UrsaArcanaNFT', ['https://example.com/', admin.address])
  const raffle = await ethers.deployContract('UrsaRaffle', [await token.getAddress(), admin.address])
  const auction = await ethers.deployContract('UrsaAuction', [await token.getAddress(), admin.address])
  const lending = await ethers.deployContract('UrsaLending', [await token.getAddress(), admin.address])
  const nftAddress = await nft.getAddress()

  await Promise.all([
    raffle.setCollectionAllowed(nftAddress, true),
    auction.setCollectionAllowed(nftAddress, true),
    lending.setCollectionAllowed(nftAddress, true),
    token.mint(buyer.address, usdc(10_000)),
    token.mint(bidder.address, usdc(10_000)),
    token.mint(lender.address, usdc(10_000)),
    token.mint(creator.address, usdc(10_000)),
  ])
  await nft.adminMint(creator.address, 6)
  return { admin, creator, buyer, bidder, lender, token, nft, raffle, auction, lending }
}

describe('Ursa Arcana contracts', function () {
  it('enforces NFT max-per-wallet and pause', async function () {
    const { buyer, nft } = await fixture()
    await nft.connect(buyer).mint(10)
    await expect(nft.connect(buyer).mint(1)).to.be.revertedWithCustomError(nft, 'WalletLimitReached')
    await nft.pause()
    await expect(nft.connect(buyer).mint(1)).to.be.revertedWithCustomError(nft, 'EnforcedPause')
  })

  it('charges paid collection mint price in ERC-20 USDC', async function () {
    const [admin, buyer, treasury] = await ethers.getSigners()
    const token = await ethers.deployContract('MockUSDC')
    const paid = await ethers.deployContract('UrsaArcanaPaidNFT', [
      'Ursa Arcana: Blue Hour',
      'URSA-BLUE',
      'https://example.com/blue-hour/',
      await token.getAddress(),
      usdc(1),
      treasury.address,
      admin.address,
    ])

    await token.mint(buyer.address, usdc(10))
    await token.connect(buyer).approve(await paid.getAddress(), usdc(2))
    await paid.connect(buyer).mint(2)

    expect(await paid.mintPrice()).to.equal(usdc(1))
    expect(await paid.totalSupply()).to.equal(2)
    expect(await paid.mintedBy(buyer.address)).to.equal(2)
    expect(await token.balanceOf(buyer.address)).to.equal(usdc(8))
    expect(await token.balanceOf(treasury.address)).to.equal(usdc(2))
    expect(await paid.ownerOf(1)).to.equal(buyer.address)
  })

  it('escrows raffle prize, reveals a winner, and pays proceeds once', async function () {
    const { creator, buyer, token, nft, raffle } = await fixture()
    const raffleAddress = await raffle.getAddress()
    const secret = ethers.id('ursa-secret')
    const endAt = (await time.latest()) + 3600
    const commitment = ethers.keccak256(secret)

    await nft.connect(creator).approve(raffleAddress, 1)
    await raffle.connect(creator).createRaffle(await nft.getAddress(), 1, usdc(1), 3, endAt, commitment)
    await token.connect(buyer).approve(raffleAddress, usdc(3))
    await raffle.connect(buyer).buyTickets(1, 3)
    await raffle.connect(creator).revealWinner(1, secret)
    await raffle.connect(buyer).claimPrize(1)
    await raffle.connect(creator).claimProceeds(1)

    expect(await nft.ownerOf(1)).to.equal(buyer.address)
    expect(await token.balanceOf(creator.address)).to.equal(usdc(10_003))
    await expect(raffle.connect(creator).claimProceeds(1)).to.be.revertedWithCustomError(raffle, 'NothingToClaim')
  })

  it('refunds raffle entrants when creator misses reveal', async function () {
    const { creator, buyer, token, nft, raffle } = await fixture()
    const secret = ethers.id('missed-secret')
    const endAt = (await time.latest()) + 120
    const commitment = ethers.keccak256(secret)
    await nft.connect(creator).approve(await raffle.getAddress(), 1)
    await raffle.connect(creator).createRaffle(await nft.getAddress(), 1, usdc(2), 10, endAt, commitment)
    await token.connect(buyer).approve(await raffle.getAddress(), usdc(4))
    await raffle.connect(buyer).buyTickets(1, 2)
    await time.increaseTo(endAt + 86_401)
    await raffle.connect(buyer).cancelUnrevealed(1)
    await raffle.connect(buyer).claimRefund(1)
    await raffle.connect(creator).claimPrize(1)
    expect(await token.balanceOf(buyer.address)).to.equal(usdc(10_000))
    expect(await nft.ownerOf(1)).to.equal(creator.address)
  })

  it('tracks outbid balances and settles an English auction', async function () {
    const { creator, buyer, bidder, token, nft, auction } = await fixture()
    const now = await time.latest()
    const startAt = now + 10
    const auctionAddress = await auction.getAddress()
    await nft.connect(creator).approve(auctionAddress, 2)
    await auction.connect(creator).createAuction(await nft.getAddress(), 2, startAt, startAt + 3600, usdc(2), 500)
    await token.connect(buyer).approve(auctionAddress, usdc(2))
    await token.connect(bidder).approve(auctionAddress, usdc(2.1))
    await time.increaseTo(startAt)
    await token.connect(creator).approve(auctionAddress, usdc(2))
    await expect(auction.connect(creator).placeBid(1, usdc(2))).to.be.revertedWithCustomError(auction, 'InvalidState')
    await auction.connect(buyer).placeBid(1, usdc(2))
    await auction.connect(bidder).placeBid(1, usdc(2.1))
    expect(await auction.withdrawableBids(1, buyer.address)).to.equal(usdc(2))
    await time.increaseTo(startAt + 3601)
    await auction.settleAuction(1)
    await auction.connect(bidder).claimNFT(1)
    await auction.connect(creator).claimProceeds(1)
    await auction.connect(buyer).withdrawBid(1)
    expect(await nft.ownerOf(2)).to.equal(bidder.address)
    expect(await token.balanceOf(buyer.address)).to.equal(usdc(10_000))
  })

  it('returns collateral after repayment and transfers it after default', async function () {
    const { creator, lender, token, nft, lending } = await fixture()
    const lendingAddress = await lending.getAddress()
    const deadline = (await time.latest()) + 3600

    await nft.connect(creator).approve(lendingAddress, 3)
    await lending.connect(creator).createLoanRequest(await nft.getAddress(), 3, usdc(3), usdc(0.3), deadline, 7 * 86_400)
    await token.connect(lender).approve(lendingAddress, usdc(3))
    await lending.connect(lender).fundLoan(1)
    expect(await token.balanceOf(creator.address)).to.equal(usdc(10_003))
    expect(await token.balanceOf(lender.address)).to.equal(usdc(9_997))
    expect(await token.balanceOf(lendingAddress)).to.equal(0)
    await token.connect(creator).approve(lendingAddress, usdc(3.3))
    await lending.connect(creator).repayLoan(1)
    expect(await token.balanceOf(creator.address)).to.equal(usdc(9_999.7))
    expect(await token.balanceOf(lender.address)).to.equal(usdc(9_997))
    expect(await token.balanceOf(lendingAddress)).to.equal(usdc(3.3))
    await lending.connect(lender).claimLenderRepayment(1)
    expect(await token.balanceOf(lender.address)).to.equal(usdc(10_000.3))
    expect(await token.balanceOf(lendingAddress)).to.equal(0)
    await lending.connect(creator).claimBorrowerCollateral(1)
    expect(await nft.ownerOf(3)).to.equal(creator.address)

    await nft.connect(creator).approve(lendingAddress, 4)
    await lending.connect(creator).createLoanRequest(await nft.getAddress(), 4, usdc(2), usdc(0.2), deadline, 100)
    await token.connect(lender).approve(lendingAddress, usdc(2))
    await lending.connect(lender).fundLoan(2)
    await time.increase(101)
    await lending.connect(lender).claimDefaultCollateral(2)
    expect(await nft.ownerOf(4)).to.equal(lender.address)
  })

  it('enforces the 5 USDC cap across utility settings', async function () {
    const { creator, nft, raffle, auction, lending } = await fixture()
    const now = await time.latest()
    const secret = ethers.id('cap-secret')
    const commitment = ethers.keccak256(secret)

    await nft.connect(creator).approve(await raffle.getAddress(), 1)
    await expect(raffle.connect(creator).createRaffle(await nft.getAddress(), 1, usdc(5.01), 10, now + 3600, commitment)).to.be.revertedWithCustomError(raffle, 'InvalidParameters')

    await raffle.connect(creator).createRaffle(await nft.getAddress(), 1, usdc(1), 10, now + 3600, commitment)
    await expect(raffle.connect(creator).buyTickets(1, 6)).to.be.revertedWithCustomError(raffle, 'InvalidParameters')

    await nft.connect(creator).approve(await auction.getAddress(), 2)
    await expect(auction.connect(creator).createAuction(await nft.getAddress(), 2, now + 10, now + 3600, usdc(5.01), 500)).to.be.revertedWithCustomError(auction, 'InvalidParameters')

    await nft.connect(creator).approve(await lending.getAddress(), 3)
    await expect(lending.connect(creator).createLoanRequest(await nft.getAddress(), 3, usdc(4.8), usdc(0.3), now + 3600, 86_400)).to.be.revertedWithCustomError(lending, 'InvalidParameters')
  })
})
