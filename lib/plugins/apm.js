import axios from 'axios'
import apmFactory from '@aragon/apm'
import AppProxyBase from '@aragon/os/abi/AppProxyBase.json'
import { NETWORK_MAINNET, ALLOWED_NETWORKS } from '../constants'

const apmPlugin = {
  name: 'apm',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['web3'])
    const web3 = server.app.getWeb3(NETWORK_MAINNET)

    server.app.getAbiFromApmServe = getAbiFromApmServe
    server.app.getAbi = getAbi(web3)
  },
}

export default apmPlugin

function getApmUrl({ app, network } = {}) {
  if (ALLOWED_NETWORKS.indexOf(network) === -1) {
    throw new Error(`Invalid network: ${network}`)
  }
  // To get all versions:
  // `https://${app}.${network}.aragonpm.com?json=true

  return `https://${app}.${network}.aragonpm.com/artifact.json`
}

// Steps to fetch an ABI
// 1. ETH call: Proxycontract -> get ENS node | [ENSNode] -> resolver
// 2. Resolve ENS node to get resolver - ETH call for ENS
// 3. Eth call to resolver for the repo address (contract which holds all versions of the repo)
// appID = namehash('voting.aragonpm.eth')
// Proxycontract = {
//   appId: namehash('voting.aragonpm.eth'),
//   implementation: '0x123',
// }
const getAbi = web3 => async contractAddress => {
  const apm = apmFactory(web3, {
    ipfs: { gateway: process.env.IPFS_NODE },
    ensRegistryAddress: process.env.ENS_REGISTRY,
  })
  const appContract = new web3.eth.Contract(AppProxyBase.abi, contractAddress)

  const appId = await appContract.methods.appId().call()
  const implementation = await appContract.methods.implementation().call()

  // TypeError: Cannot read property 'subscription' of undefined
  // at WebsocketProvider.onMessage (/Users/danielnorman/workspace/notification-service/node_modules/web3-providers/dist/web3-providers.cjs.js:298:59)
  const appInfo = await apm.getLatestVersionForContract(appId, implementation)

  return appInfo.abi
}

/**
 *
 * @param {string} appName app name without
 */
export async function getAbiFromApmServe(appName) {
  const apmUrl = getApmUrl({ app: appName, network: NETWORK_MAINNET })
  try {
    const response = await axios.get(apmUrl)
    return response.data.abi
  } catch (error) {
    throw new Error(
      `Error getting ABI for ${appName} from ${apmUrl}: ${error.message}`
    )
  }
}
