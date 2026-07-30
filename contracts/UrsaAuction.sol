// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {UrsaEscrow} from "./UrsaEscrow.sol";

contract UrsaAuction is UrsaEscrow {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant EXTENSION_WINDOW = 10 minutes;
    uint256 public constant MAX_EXTENSION = 1 hours;
    uint256 public constant MAX_USDC_AMOUNT = 5_000_000;

    enum State { Pending, Active, Settled, Cancelled }

    struct Auction {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 reservePrice;
        uint256 highestBid;
        address highestBidder;
        uint64 startAt;
        uint64 endAt;
        uint64 originalEndAt;
        uint16 minIncrementBps;
        State state;
        bool sold;
        bool nftClaimed;
        bool proceedsClaimed;
    }

    uint256 public auctionCount;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public withdrawableBids;

    error InvalidAuction();
    error InvalidParameters();
    error InvalidState();
    error NotSeller();
    error NotWinner();
    error BidTooLow();
    error NothingToClaim();

    event AuctionCreated(uint256 indexed auctionId, address indexed seller, address indexed nftContract, uint256 tokenId);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount, uint256 endAt);
    event AuctionSettled(uint256 indexed auctionId, bool sold, address winner, uint256 amount);
    event AuctionCancelled(uint256 indexed auctionId);
    event BidWithdrawn(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event NFTClaimed(uint256 indexed auctionId, address indexed recipient);
    event ProceedsClaimed(uint256 indexed auctionId, address indexed seller, uint256 amount);

    constructor(IERC20 usdc_, address admin) UrsaEscrow(usdc_, admin) {}

    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint64 startAt,
        uint64 endAt,
        uint256 reservePrice,
        uint16 minIncrementBps
    ) external whenNotPaused nonReentrant onlyAllowed(nftContract) returns (uint256 auctionId) {
        if (startAt < block.timestamp || endAt <= startAt || reservePrice > MAX_USDC_AMOUNT || minIncrementBps < 100 || minIncrementBps > BPS) revert InvalidParameters();

        auctionId = ++auctionCount;
        auctions[auctionId] = Auction({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            reservePrice: reservePrice,
            highestBid: 0,
            highestBidder: address(0),
            startAt: startAt,
            endAt: endAt,
            originalEndAt: endAt,
            minIncrementBps: minIncrementBps,
            state: startAt == block.timestamp ? State.Active : State.Pending,
            sold: false,
            nftClaimed: false,
            proceedsClaimed: false
        });

        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);
        emit AuctionCreated(auctionId, msg.sender, nftContract, tokenId);
    }

    function placeBid(uint256 auctionId, uint256 amount) external whenNotPaused nonReentrant {
        Auction storage auction = _auction(auctionId);
        if (block.timestamp < auction.startAt || block.timestamp >= auction.endAt || auction.state == State.Settled || auction.state == State.Cancelled) revert InvalidState();
        if (msg.sender == auction.seller) revert InvalidState();
        if (auction.state == State.Pending) auction.state = State.Active;

        uint256 minimum = auction.highestBid == 0
            ? 1
            : auction.highestBid + ((auction.highestBid * auction.minIncrementBps + BPS - 1) / BPS);
        if (amount < minimum || amount > MAX_USDC_AMOUNT) revert BidTooLow();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        if (auction.highestBidder != address(0)) {
            withdrawableBids[auctionId][auction.highestBidder] += auction.highestBid;
        }
        auction.highestBid = amount;
        auction.highestBidder = msg.sender;

        if (auction.endAt - block.timestamp <= EXTENSION_WINDOW) {
            uint256 extended = uint256(auction.endAt) + EXTENSION_WINDOW;
            uint256 cap = uint256(auction.originalEndAt) + MAX_EXTENSION;
            auction.endAt = uint64(extended > cap ? cap : extended);
        }
        emit BidPlaced(auctionId, msg.sender, amount, auction.endAt);
    }

    function withdrawBid(uint256 auctionId) external whenNotPaused nonReentrant {
        uint256 amount = withdrawableBids[auctionId][msg.sender];
        if (amount == 0) revert NothingToClaim();
        withdrawableBids[auctionId][msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit BidWithdrawn(auctionId, msg.sender, amount);
    }

    function cancelAuction(uint256 auctionId) external whenNotPaused nonReentrant {
        Auction storage auction = _auction(auctionId);
        if (msg.sender != auction.seller) revert NotSeller();
        if (auction.state == State.Settled || auction.state == State.Cancelled || auction.highestBidder != address(0)) revert InvalidState();
        auction.state = State.Cancelled;
        auction.nftClaimed = true;
        IERC721(auction.nftContract).safeTransferFrom(address(this), auction.seller, auction.tokenId);
        emit AuctionCancelled(auctionId);
    }

    function settleAuction(uint256 auctionId) external whenNotPaused {
        Auction storage auction = _auction(auctionId);
        if (block.timestamp < auction.endAt || auction.state == State.Settled || auction.state == State.Cancelled) revert InvalidState();
        auction.state = State.Settled;
        auction.sold = auction.highestBidder != address(0) && auction.highestBid >= auction.reservePrice;
        if (!auction.sold && auction.highestBidder != address(0)) {
            withdrawableBids[auctionId][auction.highestBidder] += auction.highestBid;
        }
        emit AuctionSettled(auctionId, auction.sold, auction.highestBidder, auction.highestBid);
    }

    function claimNFT(uint256 auctionId) external whenNotPaused nonReentrant {
        Auction storage auction = _auction(auctionId);
        if (auction.state != State.Settled || auction.nftClaimed) revert NothingToClaim();
        address recipient;
        if (auction.sold) {
            if (msg.sender != auction.highestBidder) revert NotWinner();
            recipient = auction.highestBidder;
        } else {
            if (msg.sender != auction.seller) revert NotSeller();
            recipient = auction.seller;
        }
        auction.nftClaimed = true;
        IERC721(auction.nftContract).safeTransferFrom(address(this), recipient, auction.tokenId);
        emit NFTClaimed(auctionId, recipient);
    }

    function claimProceeds(uint256 auctionId) external whenNotPaused nonReentrant {
        Auction storage auction = _auction(auctionId);
        if (msg.sender != auction.seller) revert NotSeller();
        if (auction.state != State.Settled || !auction.sold || auction.proceedsClaimed) revert NothingToClaim();
        auction.proceedsClaimed = true;
        usdc.safeTransfer(auction.seller, auction.highestBid);
        emit ProceedsClaimed(auctionId, auction.seller, auction.highestBid);
    }

    function _auction(uint256 auctionId) private view returns (Auction storage auction) {
        auction = auctions[auctionId];
        if (auction.seller == address(0)) revert InvalidAuction();
    }
}
