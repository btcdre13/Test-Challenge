### testChallenge

# Environment configuration
npm install

# Deployment
in order to deploy this contract please create a .env file and provide the necessary datapoints, make sure to import dotenv in the hardhat.config file 

run the following command

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
