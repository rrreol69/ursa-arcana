// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {UrsaEscrow} from "./UrsaEscrow.sol";

contract UrsaRaffle is UrsaEscrow {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_TICKETS = 500;
    uint256 public constant MAX_PURCHASE = 20;
    uint256 public constant REVEAL_WINDOW = 1 days;
    uint256 public constant MAX_TICKET_PRICE = 5_000_000;

    enum State { Active, Revealed, Refunding, Closed }

    struct Raffle {
        address creator;
        address nftContract;
        uint256 tokenId;
        uint256 ticketPrice;
        uint256 maxTickets;
        uint256 ticketsSold;
        uint64 endAt;
        uint64 revealDeadline;
        bytes32 commitment;
        address winner;
        State state;
        bool prizeClaimed;
        bool proceedsClaimed;
    }

    uint256 public raffleCount;
    mapping(uint256 => Raffle) public raffles;
    mapping(uint256 => address[]) private ticketOwners;
    mapping(uint256 => mapping(address => uint256)) public ticketsByOwner;

    error InvalidRaffle();
    error InvalidParameters();
    error InvalidState();
    error NotCreator();
    error NotWinner();
    error NothingToClaim();
    error RevealNotReady();
    error InvalidSecret();

    event RaffleCreated(uint256 indexed raffleId, address indexed creator, address indexed nftContract, uint256 tokenId);
    event TicketsPurchased(uint256 indexed raffleId, address indexed buyer, uint256 quantity, uint256 cost);
    event WinnerRevealed(uint256 indexed raffleId, address indexed winner, uint256 winningIndex);
    event RaffleRefunding(uint256 indexed raffleId);
    event PrizeClaimed(uint256 indexed raffleId, address indexed recipient);
    event ProceedsClaimed(uint256 indexed raffleId, address indexed creator, uint256 amount);
    event RefundClaimed(uint256 indexed raffleId, address indexed participant, uint256 amount);

    constructor(IERC20 usdc_, address admin) UrsaEscrow(usdc_, admin) {}

    function createRaffle(
        address nftContract,
        uint256 tokenId,
        uint256 ticketPrice,
        uint256 maxTickets,
        uint64 endAt,
        bytes32 secretHash
    ) external whenNotPaused nonReentrant onlyAllowed(nftContract) returns (uint256 raffleId) {
        if (ticketPrice == 0 || ticketPrice > MAX_TICKET_PRICE || maxTickets == 0 || maxTickets > MAX_TICKETS || endAt <= block.timestamp || secretHash == bytes32(0)) {
            revert InvalidParameters();
        }

        raffleId = ++raffleCount;
        raffles[raffleId] = Raffle({
            creator: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            ticketPrice: ticketPrice,
            maxTickets: maxTickets,
            ticketsSold: 0,
            endAt: endAt,
            revealDeadline: endAt + uint64(REVEAL_WINDOW),
            commitment: keccak256(abi.encodePacked(secretHash, msg.sender, raffleId)),
            winner: address(0),
            state: State.Active,
            prizeClaimed: false,
            proceedsClaimed: false
        });

        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);
        emit RaffleCreated(raffleId, msg.sender, nftContract, tokenId);
    }

    function buyTickets(uint256 raffleId, uint256 quantity) external whenNotPaused nonReentrant {
        Raffle storage raffle = _raffle(raffleId);
        if (raffle.state != State.Active || block.timestamp >= raffle.endAt) revert InvalidState();
        if (quantity == 0 || quantity > MAX_PURCHASE || raffle.ticketsSold + quantity > raffle.maxTickets) revert InvalidParameters();

        uint256 cost = raffle.ticketPrice * quantity;
        if (cost > MAX_TICKET_PRICE) revert InvalidParameters();
        usdc.safeTransferFrom(msg.sender, address(this), cost);
        raffle.ticketsSold += quantity;
        ticketsByOwner[raffleId][msg.sender] += quantity;
        for (uint256 i; i < quantity; ++i) ticketOwners[raffleId].push(msg.sender);

        emit TicketsPurchased(raffleId, msg.sender, quantity, cost);
    }

    function revealWinner(uint256 raffleId, bytes32 secret) external whenNotPaused {
        Raffle storage raffle = _raffle(raffleId);
        if (msg.sender != raffle.creator) revert NotCreator();
        if (raffle.state != State.Active || (block.timestamp < raffle.endAt && raffle.ticketsSold < raffle.maxTickets)) revert RevealNotReady();
        if (block.timestamp > raffle.revealDeadline || raffle.ticketsSold == 0) revert InvalidState();
        if (keccak256(abi.encodePacked(keccak256(abi.encodePacked(secret)), raffle.creator, raffleId)) != raffle.commitment) revert InvalidSecret();

        uint256 winningIndex = uint256(keccak256(abi.encodePacked(secret, raffleId, raffle.nftContract, raffle.tokenId, raffle.ticketsSold))) % raffle.ticketsSold;
        raffle.winner = ticketOwners[raffleId][winningIndex];
        raffle.state = State.Revealed;
        emit WinnerRevealed(raffleId, raffle.winner, winningIndex);
    }

    function cancelUnrevealed(uint256 raffleId) external whenNotPaused nonReentrant {
        Raffle storage raffle = _raffle(raffleId);
        if (raffle.state != State.Active) revert InvalidState();

        if (raffle.ticketsSold == 0 && block.timestamp >= raffle.endAt) {
            raffle.state = State.Closed;
            raffle.prizeClaimed = true;
            IERC721(raffle.nftContract).safeTransferFrom(address(this), raffle.creator, raffle.tokenId);
            emit PrizeClaimed(raffleId, raffle.creator);
            return;
        }
        if (block.timestamp <= raffle.revealDeadline) revert InvalidState();
        raffle.state = State.Refunding;
        emit RaffleRefunding(raffleId);
    }

    function claimPrize(uint256 raffleId) external whenNotPaused nonReentrant {
        Raffle storage raffle = _raffle(raffleId);
        if (raffle.state == State.Revealed) {
            if (msg.sender != raffle.winner) revert NotWinner();
        } else if (raffle.state == State.Refunding) {
            if (msg.sender != raffle.creator) revert NotCreator();
        } else {
            revert InvalidState();
        }
        if (raffle.prizeClaimed) revert NothingToClaim();

        raffle.prizeClaimed = true;
        address recipient = raffle.state == State.Revealed ? raffle.winner : raffle.creator;
        IERC721(raffle.nftContract).safeTransferFrom(address(this), recipient, raffle.tokenId);
        emit PrizeClaimed(raffleId, recipient);
    }

    function claimProceeds(uint256 raffleId) external whenNotPaused nonReentrant {
        Raffle storage raffle = _raffle(raffleId);
        if (msg.sender != raffle.creator) revert NotCreator();
        if (raffle.state != State.Revealed || raffle.proceedsClaimed) revert NothingToClaim();

        raffle.proceedsClaimed = true;
        uint256 amount = raffle.ticketPrice * raffle.ticketsSold;
        usdc.safeTransfer(raffle.creator, amount);
        emit ProceedsClaimed(raffleId, raffle.creator, amount);
    }

    function claimRefund(uint256 raffleId) external whenNotPaused nonReentrant {
        Raffle storage raffle = _raffle(raffleId);
        if (raffle.state != State.Refunding) revert InvalidState();
        uint256 quantity = ticketsByOwner[raffleId][msg.sender];
        if (quantity == 0) revert NothingToClaim();

        ticketsByOwner[raffleId][msg.sender] = 0;
        uint256 amount = raffle.ticketPrice * quantity;
        usdc.safeTransfer(msg.sender, amount);
        emit RefundClaimed(raffleId, msg.sender, amount);
    }

    function ticketOwnerAt(uint256 raffleId, uint256 index) external view returns (address) {
        return ticketOwners[raffleId][index];
    }

    function _raffle(uint256 raffleId) private view returns (Raffle storage raffle) {
        raffle = raffles[raffleId];
        if (raffle.creator == address(0)) revert InvalidRaffle();
    }
}
