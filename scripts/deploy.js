
const hre = require("hardhat");

async function main() {
  
  const TestChallenge = await hre.ethers.getContractFactory("TestChallenge");
  const testChallenge = await TestChallenge.deploy(
   

    // insert params

  );
    await testChallenge.deployed();

  console.log(`testChallenge Contract deployed at address: ${testChallenge.address}`);
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
