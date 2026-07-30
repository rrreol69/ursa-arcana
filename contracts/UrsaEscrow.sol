// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract UrsaEscrow is AccessControl, Pausable, ReentrancyGuard, ERC721Holder {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    IERC20 public immutable usdc;
    mapping(address => bool) public allowedCollections;

    error CollectionNotAllowed();
    error ZeroAddress();

    event CollectionAllowed(address indexed collection, bool allowed);

    constructor(IERC20 usdc_, address admin) {
        if (address(usdc_) == address(0) || admin == address(0)) revert ZeroAddress();
        usdc = usdc_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    modifier onlyAllowed(address collection) {
        if (!allowedCollections[collection]) revert CollectionNotAllowed();
        _;
    }

    function setCollectionAllowed(address collection, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (collection == address(0)) revert ZeroAddress();
        allowedCollections[collection] = allowed;
        emit CollectionAllowed(collection, allowed);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
