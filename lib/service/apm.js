import axios from 'axios'

function getApmUrl({ app = '', network = 'mainnet' } = {}) {
  if (network !== 'mainnet' && network !== 'rinkeby') {
    throw new Error(`Invalid network: ${network}`)
  }
  // To get all versions:
  // `https://${app}.${network}.aragonpm.com?json=true

  return `https://${app}.${network}.aragonpm.com/artifact.json`
}

export async function getAbi(app) {
  const apmUrl = getApmUrl({ app })
  try {
    const response = await axios.get(apmUrl)
    return response.data.abi
  } catch (error) {
    throw new Error(
      `Error getting ABI for ${app} from ${apmUrl}: ${error.message}`
    )
  }
}
