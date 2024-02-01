### testChallenge

# Prerequisites
Node.js version >= 18.18.0

# Environment configuration
npm install

# Deployment
in order to deploy this contract please create a .env file and provide the necessary datapoints 

run the following command

npx hardhat run scripts/deploy.js --network goerli

to deploy on any other blockchains simply change the name of the network in the hardhat.config file and paste the rpc url in the env file then run

npx hardhat run scripts/deploy.js --network <desired network>

# Testing
to run tests run
npx hardhat test

to determine coverage run
npx hardhat coverage
a report will be printed to ./coverage folder


# Verification
After successfully deploying the contract you can verify it on the corresponding block explorer by running

npx hardhat verify --network <network> <contract address> <constructor parameters>
