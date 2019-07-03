import Web3 from 'web3'

// A plugin to configure the two jwt auth strategies
const auth = {
  name: 'web3',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['@promster/hapi', 'metrics'])

    if (!process.env.ETH_NODE) {
      throw new Error('ETH_NODE env var is required')
    }

    const web3 = new Web3(
      new Web3.providers.WebsocketProvider(process.env.ETH_NODE),
      null,
      {}
    )
    server.app.web3 = web3

    server.app.getLatestBlock = async () => {
      try {
        return await web3.eth.getBlockNumber()
      } catch (error) {
        server.app.metrics.web3ErrorCounter.inc()
        server.log(['web3', 'error'], error)
        throw error
      }
    }
  },
}

export default auth
