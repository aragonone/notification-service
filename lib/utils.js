export function getApmUrl({ app = '', network = 'mainnet' } = {}) {
  if (network !== 'mainnet' && network !== 'rinkeby') {
    throw new Error(`Invalid network: ${network}`)
  }
  // To get all versions:
  // `https://${app}.${network}.aragonpm.com?json=true

  return `https://${app}.${network}.aragonpm.com/artifact.json`
}