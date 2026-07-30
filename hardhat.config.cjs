require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config()

const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []

module.exports = {
  solidity: {
    version: '0.8.28',
    settings: { optimizer: { enabled: true, runs: 300 }, viaIR: true },
  },
  networks: {
    arcTestnet: {
      url: process.env.ARC_RPC_URL || 'https://rpc.drpc.testnet.arc.network',
      chainId: 5_042_002,
      accounts,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
}
