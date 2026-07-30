// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {UrsaEscrow} from "./UrsaEscrow.sol";

contract UrsaLending is UrsaEscrow {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_REPAYMENT = 5_000_000;

    enum State { Requested, Active, Repaid, Cancelled, Defaulted }

    struct Loan {
        address borrower;
        address lender;
        address nftContract;
        uint256 tokenId;
        uint256 principal;
        uint256 interest;
        uint64 fundingDeadline;
        uint64 duration;
        uint64 dueAt;
        State state;
        bool lenderClaimed;
        bool collateralClaimed;
    }

    uint256 public loanCount;
    mapping(uint256 => Loan) public loans;

    error InvalidLoan();
    error InvalidParameters();
    error InvalidState();
    error NotBorrower();
    error NotLender();
    error NothingToClaim();

    event LoanRequested(uint256 indexed loanId, address indexed borrower, address indexed nftContract, uint256 tokenId);
    event LoanCancelled(uint256 indexed loanId);
    event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 principal, uint256 dueAt);
    event LoanRepaid(uint256 indexed loanId, uint256 amount);
    event LenderRepaymentClaimed(uint256 indexed loanId, address indexed lender, uint256 amount);
    event BorrowerCollateralClaimed(uint256 indexed loanId, address indexed borrower);
    event DefaultCollateralClaimed(uint256 indexed loanId, address indexed lender);

    constructor(IERC20 usdc_, address admin) UrsaEscrow(usdc_, admin) {}

    function createLoanRequest(
        address nftContract,
        uint256 tokenId,
        uint256 principal,
        uint256 interest,
        uint64 fundingDeadline,
        uint64 duration
    ) external whenNotPaused nonReentrant onlyAllowed(nftContract) returns (uint256 loanId) {
        if (principal == 0 || principal + interest > MAX_REPAYMENT || fundingDeadline <= block.timestamp || duration == 0) revert InvalidParameters();

        loanId = ++loanCount;
        loans[loanId] = Loan({
            borrower: msg.sender,
            lender: address(0),
            nftContract: nftContract,
            tokenId: tokenId,
            principal: principal,
            interest: interest,
            fundingDeadline: fundingDeadline,
            duration: duration,
            dueAt: 0,
            state: State.Requested,
            lenderClaimed: false,
            collateralClaimed: false
        });

        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);
        emit LoanRequested(loanId, msg.sender, nftContract, tokenId);
    }

    function cancelLoanRequest(uint256 loanId) external whenNotPaused nonReentrant {
        Loan storage loan = _loan(loanId);
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (loan.state != State.Requested) revert InvalidState();
        loan.state = State.Cancelled;
        loan.collateralClaimed = true;
        IERC721(loan.nftContract).safeTransferFrom(address(this), loan.borrower, loan.tokenId);
        emit LoanCancelled(loanId);
    }

    function fundLoan(uint256 loanId) external whenNotPaused nonReentrant {
        Loan storage loan = _loan(loanId);
        if (loan.state != State.Requested || block.timestamp > loan.fundingDeadline || msg.sender == loan.borrower) revert InvalidState();
        loan.lender = msg.sender;
        loan.dueAt = uint64(block.timestamp) + loan.duration;
        loan.state = State.Active;
        usdc.safeTransferFrom(msg.sender, loan.borrower, loan.principal);
        emit LoanFunded(loanId, msg.sender, loan.principal, loan.dueAt);
    }

    function repayLoan(uint256 loanId) external whenNotPaused nonReentrant {
        Loan storage loan = _loan(loanId);
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (loan.state != State.Active || block.timestamp > loan.dueAt) revert InvalidState();
        uint256 amount = loan.principal + loan.interest;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        loan.state = State.Repaid;
        emit LoanRepaid(loanId, amount);
    }

    function claimLenderRepayment(uint256 loanId) external whenNotPaused nonReentrant {
        Loan storage loan = _loan(loanId);
        if (msg.sender != loan.lender) revert NotLender();
        if (loan.state != State.Repaid || loan.lenderClaimed) revert NothingToClaim();
        loan.lenderClaimed = true;
        uint256 amount = loan.principal + loan.interest;
        usdc.safeTransfer(loan.lender, amount);
        emit LenderRepaymentClaimed(loanId, loan.lender, amount);
    }

    function claimBorrowerCollateral(uint256 loanId) external whenNotPaused nonReentrant {
        Loan storage loan = _loan(loanId);
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (loan.state != State.Repaid || loan.collateralClaimed) revert NothingToClaim();
        loan.collateralClaimed = true;
        IERC721(loan.nftContract).safeTransferFrom(address(this), loan.borrower, loan.tokenId);
        emit BorrowerCollateralClaimed(loanId, loan.borrower);
    }

    function claimDefaultCollateral(uint256 loanId) external whenNotPaused nonReentrant {
        Loan storage loan = _loan(loanId);
        if (msg.sender != loan.lender) revert NotLender();
        if (loan.state != State.Active || block.timestamp <= loan.dueAt || loan.collateralClaimed) revert InvalidState();
        loan.state = State.Defaulted;
        loan.collateralClaimed = true;
        IERC721(loan.nftContract).safeTransferFrom(address(this), loan.lender, loan.tokenId);
        emit DefaultCollateralClaimed(loanId, loan.lender);
    }

    function _loan(uint256 loanId) private view returns (Loan storage loan) {
        loan = loans[loanId];
        if (loan.borrower == address(0)) revert InvalidLoan();
    }
}
