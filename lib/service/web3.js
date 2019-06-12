import Web3 from 'web3'

if (!process.env.ETH_NODE) {
  throw new Error('ETH_NODE env var is required')
}

const web3 = new Web3(
  new Web3.providers.WebsocketProvider(process.env.ETH_NODE),
  null,
  {}
)

export async function getLatestBlock() {
  try {
    return await web3.eth.getBlockNumber()
  } catch (error) {
    throw new Error(`Error getting blockNumber from web3: ${error.message}`)
  }
}

export default web3
