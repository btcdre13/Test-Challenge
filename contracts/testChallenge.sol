//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

pragma solidity 0.8.20;

/**
 * @title A contract to facilitate the transfer of funds from buyer to seller after successful delivery of the physical product
 * @author Philipp Eder
 * @notice this contract can be reused by anyone at any time
 * @dev no liability assumed for the use of this contract
 */

contract TestChallenge {

    using SafeERC20 for IERC20;

    enum State {
        AWAITING_PAYMENT,
        AWAITING_DELIVERY,
        DELIVERED,
        DISPUTE,
        READY_FOR_CLAIM,
        ABORTED,
        COMPLETE
    }

    State public currentState;
    /// @notice constant stands for the native asset of a blockchain and differentiates between ETH and ERC20 in this contract
    /// @dev serves the purpose of allowing for a zero check against it
    address public constant ETH_CONSTANT = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE; 
    address public immutable seller;
    address public immutable buyer;
    address public immutable arbitrator;
    IERC20 public immutable token;
    uint256 public price;

    event Deposit(address from, uint256 amount);
    event Withdraw(address to, uint256 value);
    event StateChanged(State newState);

    error InvalidAddress();
    error OnlyExactAmount();
    error NotAuthorized();
    error TransferFailed();
    error IncorrectPhase();
    error AwaitingERC20();
    error AwaitingETH();


    /// @dev throws if any other address than the arbitrator calls
    modifier onlyArbitrator() {
        if(msg.sender != arbitrator) revert NotAuthorized();
        _;
    }

    /// @dev throws if any other address than the seller calls
    modifier onlySeller() {
        if(msg.sender != seller) revert NotAuthorized();
        _;
    }

    /// @dev throws if any other address than the buyer calls
    modifier onlyBuyer() {
        if(msg.sender != buyer) revert NotAuthorized();
        _;
    }

    /// @dev throws if any other address than either of the parties calls
    modifier onlyBothParties() {
        if(msg.sender != buyer && msg.sender != seller) revert NotAuthorized();
        _;
    }

/// @dev No 0 check for arbitror to keep it customizable, in the case the parties agree to not have any arbitror
    constructor(
        address _seller,
        address _buyer,
        address _arbitrator,
        uint256 _price,
        address _token
    )  {
        if(_seller == address(0) || _buyer == address(0) || _token == address(0)) revert InvalidAddress();
        currentState = State.AWAITING_PAYMENT;
        seller = _seller;
        buyer = _buyer;
        arbitrator = _arbitrator;
        price = _price;
        token = IERC20(_token); 
    }


     /// @notice including depositETH() avoids possible lockup of funds in the contract
    receive() external payable {
        depositETH(); 
    }

    /// @dev throws if current State is not Awaiting_Payment, if token is not set to ETH constant
    function depositERC20() external {
        if(currentState != State.AWAITING_PAYMENT)
            revert IncorrectPhase();
         if (address(token) == ETH_CONSTANT) revert AwaitingETH();
        token.safeTransferFrom(msg.sender, address(this), price);
        currentState = State.AWAITING_DELIVERY;
        emit Deposit(msg.sender, price);
        emit StateChanged(currentState);
    }
    /// @notice function allows the seller to change State
    function markAsDelivered() external onlySeller {
        if(currentState != State.AWAITING_DELIVERY) revert IncorrectPhase();
        currentState = State.DELIVERED;
        emit StateChanged(currentState);
    }

    /// @notice function allows the buyer to change state
    function confirmDelivery() external onlyBuyer {
        if(currentState != State.DELIVERED) revert IncorrectPhase();
        currentState = State.READY_FOR_CLAIM;
        emit StateChanged(currentState);
    }

    /// @notice function to unlock the funds in case everything is ok, this can only be done by the arbitrator
    function unlockFunds() external onlyArbitrator {
        if(currentState != State.DISPUTE) revert IncorrectPhase();
        currentState = State.READY_FOR_CLAIM;
        emit StateChanged(currentState);
    }

    /// @notice function to abort the deal, can only be done by the arbitrator
    function abortDeal() external onlyArbitrator {
        if(currentState != State.DISPUTE) revert IncorrectPhase();
        currentState = State.ABORTED;
        emit StateChanged(currentState);
    }

      /// @notice function allows either party to claim the funds, depending on the State
      /// @dev this function can be called by either parties even if the state does not correspond to them being eligible for claiming
     ///      however the only outcome for a malicious party would be that they pay the gas fee for the other party, therefore not giving any incentive
    ///       to do so, as the recipient of the funds will be address claimer, which is determined by the contract's state
    function claimFunds() external onlyBothParties {
        address claimer;

        if(currentState == State.ABORTED) claimer = buyer;
        else if (currentState == State.READY_FOR_CLAIM) claimer = seller;
        else revert IncorrectPhase();
        currentState = State.COMPLETE;
        emit StateChanged(currentState);
        if (address(token) == ETH_CONSTANT) {
            uint amount = address(this).balance;
            (bool sent, ) = payable(claimer).call{value: amount}("");
            if(!sent) revert TransferFailed();
            emit Withdraw(claimer, amount);
        } else {
           uint value = token.balanceOf(address(this));
            token.safeTransfer(claimer, value);
            emit Withdraw(claimer, value);
        }
    }

    /// @notice function allows either party to call a dispute
    function callDispute() external onlyBothParties {
        if(currentState == State.AWAITING_PAYMENT || arbitrator == address(0)) revert IncorrectPhase();
        currentState = State.DISPUTE;
        emit StateChanged(currentState);
    }

      /// @notice throws if current State is not Awaiting_Payment, if token is not set to ETH constant or msg.value != price
    function depositETH() public payable {
        if(currentState != State.AWAITING_PAYMENT)
            revert IncorrectPhase();
        if (address(token) != ETH_CONSTANT) revert AwaitingERC20();
        if (msg.value != price) revert OnlyExactAmount();
        currentState = State.AWAITING_DELIVERY;
        emit Deposit(msg.sender, msg.value);
        emit StateChanged(currentState);
    }
}
