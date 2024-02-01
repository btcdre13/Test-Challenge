/* deployment of the testChallenge contract using ETH as payment, for ERC20 tokens just
  substitute the last parameter with the tokenaddress of your choice */

  async function main() {
  
    const TestChallenge = await ethers.getContractFactory("TestChallenge");
    const testChallenge = await TestChallenge.deploy("0x330e49d664dB0Bf478B843Dd1da9ad6f07867E3f",
                                                    "0x330e49d664dB0Bf478B843Dd1da9ad6f07867E3f",
                                                    "0x330e49d664dB0Bf478B843Dd1da9ad6f07867E3f",
                                                    10,
                                                    "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    );
      
  
    console.log(`testChallenge Contract deployed at address: ${testChallenge.target}`);
  }
  
  
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  