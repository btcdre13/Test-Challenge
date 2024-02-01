const { expect } = require('chai');
const { ethers } = require("hardhat");
const hre = require("hardhat");

describe('TestChallenge Contract', function () {
  let TestChallenge;
  let testChallenge;
  let seller;
  let buyer;
  let arbitrator;
  let token;
 

  beforeEach(async function () {
    [seller, buyer, arbitrator] = await hre.ethers.getSigners();

    token = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    TestChallenge = await ethers.getContractFactory('TestChallenge');
  
    testChallenge = await TestChallenge.deploy(
        seller.address,
        buyer.address,
        arbitrator.address,
        100,
        token
    );

  });

  it('Should initialize the contract properly', async function () {
    expect(await testChallenge.currentState()).to.equal(0); 
    expect(await testChallenge.seller()).to.equal(await seller.address);
    expect(await testChallenge.buyer()).to.equal(await buyer.address);
    expect(await testChallenge.arbitrator()).to.equal(await arbitrator.address);
    expect(await testChallenge.price()).to.equal(100);
    expect(await testChallenge.token()).to.equal("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
  });

  it('Should let the buyer deposit ETH and change state to AWAITING_DELIVERY', async function () {
    const buyerAddress = await buyer.getAddress();
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    expect(await testChallenge.currentState()).to.equal(1); 

    const depositEvent = (await testChallenge.queryFilter(testChallenge.filters.Deposit()))[0];
    expect(depositEvent.args[0]).to.equal(buyerAddress);
    expect(depositEvent.args[1]).to.equal(value);
  });

  it("should let the seller change the state to Delivered", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(seller).markAsDelivered();
    expect(await testChallenge.currentState()).to.equal(2);
  });

  it("should not let anyone else change the state to Delivered", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await expect(testChallenge.connect(buyer).markAsDelivered()).to.be.revertedWithCustomError(testChallenge, "NotAuthorized");
  })

  it("should let the buyer confirm the delivery", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(seller).markAsDelivered();
    await testChallenge.connect(buyer).confirmDelivery();
    expect(await testChallenge.currentState()).to.equal(4);
  });

  it("should not let anyone else confirm the delivery", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(seller).markAsDelivered();
    await expect(testChallenge.connect(seller).confirmDelivery()).to.be.revertedWithCustomError(testChallenge, "NotAuthorized");
  })

  it("should let the seller withdraw the funds", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(seller).markAsDelivered();
    await testChallenge.connect(buyer).confirmDelivery();
    expect(await testChallenge.connect(seller).claimFunds()).to.be.ok;
  });

  it("should choose the correct recipient in malicious claim attempts", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(seller).callDispute();
    await testChallenge.connect(arbitrator).abortDeal();
    await testChallenge.connect(seller).claimFunds();

    const WithdrawEvent = (await testChallenge.queryFilter(testChallenge.filters.Withdraw()))[0];
    expect(WithdrawEvent.args[0]).to.equal(buyer.address);
    expect(WithdrawEvent.args[1]).to.equal(value);
  })

  it("should transfer the funds to the correct recipient in malicious claim attempts", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(seller).markAsDelivered();
    await testChallenge.connect(buyer).confirmDelivery();
   const balance = await ethers.provider.getBalance(seller.address);
   await testChallenge.connect(buyer).claimFunds();
   expect (await ethers.provider.getBalance(seller.address)).to.be.greaterThan(balance);
  })

  it("should update the state to complete after withdrawal", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(seller).markAsDelivered();
    await testChallenge.connect(buyer).confirmDelivery();
    await testChallenge.connect(seller).claimFunds();
    expect(await testChallenge.currentState()).to.equal(6);
  })

  it("should let the buyer call a dispute", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(buyer).callDispute();
    expect(await testChallenge.currentState()).to.equal(3);
  });

  it("should let the seller call a dispute", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(seller).callDispute();
    expect(await testChallenge.currentState()).to.equal(3);
  })

  it("should let the arbitrator unlock the funds", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(seller).callDispute();
    await testChallenge.connect(arbitrator).unlockFunds();
    expect(await testChallenge.currentState()).to.equal(4);
  });

  it("should be set to complete", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(seller).callDispute();
    await testChallenge.connect(arbitrator).unlockFunds();
    await testChallenge.connect(seller).claimFunds();
    expect(await testChallenge.currentState()).to.equal(6);

    const WithdrawEvent = (await testChallenge.queryFilter(testChallenge.filters.Withdraw()))[0];
    expect(WithdrawEvent.args[0]).to.equal(seller.address);
    expect(WithdrawEvent.args[1]).to.equal(value);
  })

  it("should let the arbitrator abort the deal", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await testChallenge.connect(seller).callDispute();
    await testChallenge.connect(arbitrator).abortDeal();
    expect(await testChallenge.currentState()).to.equal(5);
  });

  it("should revert if functions are called while the contract is in a different state", async function () {
    const value = 100; 

    await testChallenge.connect(buyer).depositETH({value: value});
    await expect(testChallenge.connect(seller).claimFunds()).to.be.revertedWithCustomError(testChallenge, "IncorrectPhase");
  })
  /// @notice due to time restrictions I did not write any tests to cover the case of using ERC20 tokens as payment
});