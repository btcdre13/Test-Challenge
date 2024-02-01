const { expect } = require('chai');
const { ethers } = require("hardhat");
const hre = require("hardhat");

describe('TestChallenge Contract ERC20 Version', function () {
  let TestChallenge;
  let testChallenge;
  let seller;
  let buyer;
  let arbitrator;
  let Token;
  let token;
  let Token2;
  let token2;

  beforeEach(async function () {
    [owner, seller, buyer, arbitrator] = await ethers.getSigners();

    Token = await ethers.getContractFactory("TestToken");
    token = await Token.deploy(owner.address);

    await token.connect(owner).transfer(buyer.address, 1000);

    Token2 = await ethers.getContractFactory("MockToken");
    token2 = await Token2.deploy(owner.address);

    await token2.connect(owner).transfer(buyer.address, 1000);

    TestChallenge = await ethers.getContractFactory("TestChallenge");
    testChallenge = await TestChallenge.deploy(
      seller.address,
      buyer.address,
      "0x0000000000000000000000000000000000000000",
      100,
      token.target
    );
  });

  it('Should initialize the contract properly', async function () {
    expect(await testChallenge.currentState()).to.equal(0); 
    expect(await testChallenge.seller()).to.equal(await seller.address);
    expect(await testChallenge.buyer()).to.equal(await buyer.address);
    expect(await testChallenge.arbitrator()).to.equal("0x0000000000000000000000000000000000000000");
    expect(await testChallenge.price()).to.equal(100);
    expect(await testChallenge.token()).to.equal(token.target);
  });

  it("should let the buyer deposit tokens and change state to AWAITING_DELIVERY", async function() {
    await token.connect(buyer).approve(testChallenge.target, 100000);
    await testChallenge.connect(buyer).depositERC20();
    expect(await token.balanceOf(testChallenge.target)).to.equal(100);
    expect(await testChallenge.currentState()).to.equal(1);
  });

  it("should emit the correct events upon successful deposit", async function () {
    await token.connect(buyer).approve(testChallenge.target, 100000);
    await testChallenge.connect(buyer).depositERC20();

    const depositEvent = (await testChallenge.queryFilter(testChallenge.filters.Deposit()))[0];
    expect(depositEvent.args[0]).to.equal(buyer.address);
    expect(depositEvent.args[1]).to.equal(100);

    const stateEvent = (await testChallenge.queryFilter(testChallenge.filters.StateChanged()))[0];
    expect(stateEvent.args[0]).to.equal(1);
  });

  it("should revert if the buyer tries to deposit Tokens during an incorrect state", async function() {
    await token.connect(buyer).approve(testChallenge.target, 100000);
    await testChallenge.connect(buyer).depositERC20();
    await testChallenge.connect(seller).markAsDelivered();
    await expect(testChallenge.connect(buyer).depositERC20()).to.be.revertedWithCustomError(testChallenge, "IncorrectPhase");
  })

  it("should revert if the buyer tries to deposit ETH", async function () {
    await expect(testChallenge.connect(buyer).depositETH({value: 1})).to.be.revertedWithCustomError(testChallenge, "AwaitingERC20");
  });

  it("should not recognize another erc20 token", async function () {
    await token2.connect(buyer).approve(testChallenge.target, 1000);
    await expect(testChallenge.connect(buyer).depositERC20()).to.be.reverted;
  });

  it("should execute the withdrawal correctly", async function () {
    await token.connect(buyer).approve(testChallenge.target, 1000);
    await testChallenge.connect(buyer).depositERC20();
    await testChallenge.connect(seller).markAsDelivered();
    await testChallenge.connect(buyer).confirmDelivery();
    await testChallenge.connect(seller).claimFunds();
    expect(await token.balanceOf(seller)).to.equal(100);
    expect(await token.balanceOf(testChallenge.target)).to.equal(0);
  });

  it("should not let anyone call a dispute if there is no arbitrator set", async function () {
    await token.connect(buyer).approve(testChallenge.target, 1000);
    await testChallenge.connect(buyer).depositERC20();
    await expect(testChallenge.connect(buyer).callDispute()).to.be.revertedWithCustomError(testChallenge, "IncorrectPhase");
  });

 


})