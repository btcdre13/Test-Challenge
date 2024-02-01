const { expect } = require('chai');
const { ethers } = require("hardhat");
const hre = require("hardhat");

describe('TestChallenge Contract ETH Version', function () {
  let TestChallenge;
  let testChallenge;
  let seller;
  let buyer;
  let arbitrator;
  let token;
  let ERC20;
  let erc20;
 

  beforeEach(async function () {
    [owner, seller, buyer, arbitrator] = await hre.ethers.getSigners();

    token = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    TestChallenge = await ethers.getContractFactory('TestChallenge');
  
    testChallenge = await TestChallenge.deploy(
        seller.address,
        buyer.address,
        arbitrator.address,
        100,
        token
    );
    
    ERC20 = await ethers.getContractFactory("TestToken");
    erc20 = await ERC20.deploy(owner.address);

    await erc20.connect(owner).transfer(buyer.address, 1000);

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
    await testChallenge.connect(buyer).depositETH({value: 100});
    expect(await testChallenge.currentState()).to.equal(1); 

    const depositEvent = (await testChallenge.queryFilter(testChallenge.filters.Deposit()))[0];
    expect(depositEvent.args[0]).to.equal(buyer.address);
    expect(depositEvent.args[1]).to.equal(100);
  });

  it("should emit the correct events upon successful deposit", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});

    const depositEvent = (await testChallenge.queryFilter(testChallenge.filters.Deposit()))[0];
    expect(depositEvent.args[0]).to.equal(buyer.address);
    expect(depositEvent.args[1]).to.equal(100);

    const stateEvent = (await testChallenge.queryFilter(testChallenge.filters.StateChanged()))[0];
    expect(stateEvent.args[0]).to.equal(1);
  });

  it("should revert if the buyer tries to deposit during an incorrect phase", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).markAsDelivered();
    await expect(testChallenge.connect(buyer).depositETH({value: 100})).to.be.revertedWithCustomError(testChallenge, "IncorrectPhase");
  })

  it("should revert if the buyer tries to deposit ERC20 tokens", async function() {
    await erc20.connect(buyer).approve(testChallenge.target, 1000);
    await expect(testChallenge.connect(buyer).depositERC20()).to.be.revertedWithCustomError(testChallenge, "AwaitingETH");
  });

  it("should revert if the amount is not deposited exactly", async function () {
    await expect(testChallenge.connect(buyer).depositETH({value: 150})).to.be.revertedWithCustomError(testChallenge, "OnlyExactAmount");
  })

  it("should let the seller change the state to Delivered", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).markAsDelivered();
    expect(await testChallenge.currentState()).to.equal(2);
  });

  it("should not let anyone else change the state to Delivered", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await expect(testChallenge.connect(buyer).markAsDelivered()).to.be.revertedWithCustomError(testChallenge, "NotAuthorized");
  });

  it("should let the buyer confirm the delivery", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).markAsDelivered();
    await testChallenge.connect(buyer).confirmDelivery();
    expect(await testChallenge.currentState()).to.equal(4);
  });

  it("should not let anyone else confirm the delivery", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).markAsDelivered();
    await expect(testChallenge.connect(seller).confirmDelivery()).to.be.revertedWithCustomError(testChallenge, "NotAuthorized");
  })

  it("should not let anyone call confirmDelivery if the contract is in incorrect state", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await expect(testChallenge.connect(buyer).confirmDelivery()).to.be.revertedWithCustomError(testChallenge, "IncorrectPhase");
  })

  it("should let the seller withdraw the funds", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).markAsDelivered();
    await testChallenge.connect(buyer).confirmDelivery();
    expect(await testChallenge.connect(seller).claimFunds()).to.be.ok;
  });

  it("should choose the correct recipient in malicious claim attempts", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).callDispute();
    await testChallenge.connect(arbitrator).abortDeal();
    await testChallenge.connect(seller).claimFunds();

    const WithdrawEvent = (await testChallenge.queryFilter(testChallenge.filters.Withdraw()))[0];
    expect(WithdrawEvent.args[0]).to.equal(buyer.address);
    expect(WithdrawEvent.args[1]).to.equal(100);
  })

  it("should transfer the funds to the correct recipient in malicious claim attempts", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).markAsDelivered();
    await testChallenge.connect(buyer).confirmDelivery();
   const balance = await ethers.provider.getBalance(seller.address);
   await testChallenge.connect(buyer).claimFunds();
   expect (await ethers.provider.getBalance(seller.address)).to.be.greaterThan(balance);
  });

  it("should not let anyone else call the claimFunds function", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).markAsDelivered();
    await testChallenge.connect(buyer).confirmDelivery();
    await expect(testChallenge.connect(arbitrator).claimFunds()).to.be.revertedWithCustomError(testChallenge, "NotAuthorized");
  })

  it("should update the state to complete after withdrawal", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).markAsDelivered();
    await testChallenge.connect(buyer).confirmDelivery();
    await testChallenge.connect(seller).claimFunds();
    expect(await testChallenge.currentState()).to.equal(6);
  })

  it("should let the buyer call a dispute", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(buyer).callDispute();
    expect(await testChallenge.currentState()).to.equal(3);
  });

  it("should let the seller call a dispute", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).callDispute();
    expect(await testChallenge.currentState()).to.equal(3);
  });

  it("should not let the anyone else call a dispute", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await expect(testChallenge.connect(arbitrator).callDispute()).to.be.revertedWithCustomError(testChallenge, "NotAuthorized");
  });

  it("should not let anyone call a dispute if the contract is in incorrect state", async function () {
    await expect(testChallenge.connect(buyer).callDispute()).to.be.revertedWithCustomError(testChallenge, "IncorrectPhase");
  })

  it("should let the arbitrator unlock the funds", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).callDispute();
    await testChallenge.connect(arbitrator).unlockFunds();
    expect(await testChallenge.currentState()).to.equal(4);
  });

  it("should not let anyone else unlock the funds", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).callDispute();
    await expect(testChallenge.connect(seller).unlockFunds()).to.be.revertedWithCustomError(testChallenge, "NotAuthorized");
  })

  it("should not let the arbitrator unlock the funds in an incorrect state", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await expect(testChallenge.connect(arbitrator).unlockFunds()).to.be.revertedWithCustomError(testChallenge, "IncorrectPhase");
  });

  it("should not let the arbitrator abort the deal if the contract is in an incorrect phase", async function() {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await expect(testChallenge.connect(arbitrator).abortDeal()).to.be.revertedWithCustomError(testChallenge, "IncorrectPhase");
  })

  it("should be set to complete", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).callDispute();
    await testChallenge.connect(arbitrator).unlockFunds();
    await testChallenge.connect(seller).claimFunds();
    expect(await testChallenge.currentState()).to.equal(6);

    const WithdrawEvent = (await testChallenge.queryFilter(testChallenge.filters.Withdraw()))[0];
    expect(WithdrawEvent.args[0]).to.equal(seller.address);
    expect(WithdrawEvent.args[1]).to.equal(100);
  })

  it("should let the arbitrator abort the deal", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).callDispute();
    await testChallenge.connect(arbitrator).abortDeal();
    expect(await testChallenge.currentState()).to.equal(5);
  });

  it("should not let anyone else abort the deal", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await testChallenge.connect(seller).callDispute();
    await expect(testChallenge.connect(seller).abortDeal()).to.be.revertedWithCustomError(testChallenge, "NotAuthorized");

  })

  it("should revert if functions are called while the contract is in a different state", async function () {
    await testChallenge.connect(buyer).depositETH({value: 100});
    await expect(testChallenge.connect(seller).claimFunds()).to.be.revertedWithCustomError(testChallenge, "IncorrectPhase");
  })
  
  it("should revert if markAsDelivered() is called in an incorrect state", async function () {
    await expect(testChallenge.connect(seller).markAsDelivered()).to.be.revertedWithCustomError(testChallenge, "IncorrectPhase");
    
  });
});