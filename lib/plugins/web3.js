import Web3 from 'web3'

// A plugin to configure the two jwt auth strategies
const auth = {
  name: 'web3',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['@promster/hapi'])
    if (!process.env.ETH_NODE) {
      throw new Error('ETH_NODE env var is required')
    }

    const web3ErrorCounter = new server.Prometheus.Counter({
      name: 'web3_error_total',
      help: 'The number of web3 eth errors',
    })

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
        web3ErrorCounter.inc()
        server.log(['web3', 'error'], error)
      }
    }
  },
}

export default auth
