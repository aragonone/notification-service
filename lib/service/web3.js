import Web3 from 'web3'

if (!process.env.ETH_NODE) {
  throw new Error('ETH_NODE env var is required')
}

const web3 = new Web3(
  new Web3.providers.WebsocketProvider(process.env.ETH_NODE),
  null,
  {}
)

export default web3
