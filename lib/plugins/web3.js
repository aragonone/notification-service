import Web3 from 'web3'
import { NETWORK_MAINNET, NETWORK_RINKEBY } from '../constants'

// A plugin to configure the two jwt auth strategies
const auth = {
  name: 'ns/web3',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['ns/metrics'])

    if (!process.env.ETH_NODE_MAINNET) {
      throw new Error('ETH_NODE_MAINNET env var is required')
    }

    if (!process.env.ETH_NODE_RINKEBY) {
      throw new Error('ETH_NODE_RINKEBY env var is required')
    }

    const web3Mainnet = new Web3(process.env.ETH_NODE_MAINNET)
    const web3Rinkeby = new Web3(process.env.ETH_NODE_RINKEBY)

    const getWeb3 = network =>
      network === NETWORK_MAINNET
        ? web3Mainnet
        : network === NETWORK_RINKEBY
        ? web3Rinkeby
        : null

    server.app.getWeb3 = getWeb3

    server.app.getLatestBlock = async network => {
      if (!network) throw new Error('network is required')

      const web3 = getWeb3(network)
      try {
        return await web3.eth.getBlockNumber()
      } catch (error) {
        server.app.metrics.web3ErrorCounter.labels(network).inc()
        server.log(['web3', 'error'], error)
        throw error
      }
    }
  },
}

export default auth
