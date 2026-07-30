// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Pausable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";

contract UrsaArcanaNFT is ERC721Pausable, AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant MAX_SUPPLY = 24;
    uint256 public constant MAX_PER_WALLET = 10;

    uint256 public totalSupply;
    string private baseTokenURI;
    mapping(address => uint256) public mintedBy;

    error InvalidQuantity();
    error MaxSupplyReached();
    error WalletLimitReached();

    constructor(string memory initialBaseURI, address admin) ERC721("Ursa Arcana", "URSA") {
        baseTokenURI = initialBaseURI;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function mint(uint256 quantity) external whenNotPaused {
        if (quantity == 0) revert InvalidQuantity();
        if (totalSupply + quantity > MAX_SUPPLY) revert MaxSupplyReached();
        if (mintedBy[msg.sender] + quantity > MAX_PER_WALLET) revert WalletLimitReached();

        mintedBy[msg.sender] += quantity;
        _mintQuantity(msg.sender, quantity);
    }

    function adminMint(address to, uint256 quantity) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (quantity == 0) revert InvalidQuantity();
        if (totalSupply + quantity > MAX_SUPPLY) revert MaxSupplyReached();
        _mintQuantity(to, quantity);
    }

    function setBaseURI(string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseTokenURI = uri;
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
