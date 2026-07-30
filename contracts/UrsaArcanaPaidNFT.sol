// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Pausable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract UrsaArcanaPaidNFT is ERC721Pausable, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant MAX_SUPPLY = 24;
    uint256 public constant MAX_PER_WALLET = 10;

    IERC20 public immutable usdc;
    uint256 public mintPrice;
    uint256 public totalSupply;
    address public treasury;
    string private baseTokenURI;
    mapping(address => uint256) public mintedBy;

    error InvalidQuantity();
    error InvalidPrice();
    error MaxSupplyReached();
    error WalletLimitReached();
    error ZeroAddress();

    event Minted(address indexed minter, uint256 quantity, uint256 amount);
    event MintPriceUpdated(uint256 price);
    event TreasuryUpdated(address indexed treasury);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory initialBaseURI,
        IERC20 usdc_,
        uint256 mintPrice_,
        address treasury_,
        address admin
    ) ERC721(name_, symbol_) {
        if (address(usdc_) == address(0) || treasury_ == address(0) || admin == address(0)) revert ZeroAddress();
        if (mintPrice_ == 0) revert InvalidPrice();
        usdc = usdc_;
        mintPrice = mintPrice_;
        treasury = treasury_;
        baseTokenURI = initialBaseURI;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function mint(uint256 quantity) external whenNotPaused nonReentrant {
        if (quantity == 0) revert InvalidQuantity();
        if (totalSupply + quantity > MAX_SUPPLY) revert MaxSupplyReached();
        if (mintedBy[msg.sender] + quantity > MAX_PER_WALLET) revert WalletLimitReached();

        uint256 amount = mintPrice * quantity;
        mintedBy[msg.sender] += quantity;
        usdc.safeTransferFrom(msg.sender, treasury, amount);
        _mintQuantity(msg.sender, quantity);
        emit Minted(msg.sender, quantity, amount);
    }

    function adminMint(address to, uint256 quantity) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (quantity == 0) revert InvalidQuantity();
        if (totalSupply + quantity > MAX_SUPPLY) revert MaxSupplyReached();
        _mintQuantity(to, quantity);
    }

    function setBaseURI(string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseTokenURI = uri;
    }

    function setMintPrice(uint256 price) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (price == 0) revert InvalidPrice();
        mintPrice = price;
        emit MintPriceUpdated(price);
    }

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _mintQuantity(address to, uint256 quantity) private {
        for (uint256 i; i < quantity; ++i) {
            uint256 tokenId = ++totalSupply;
            _safeMint(to, tokenId);
        }
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
