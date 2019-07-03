export const ARAGON_FROM_ADDRESS = 'notification@aragon.one'

export const MAGICLINK_EXPIRATION_PERIOD = '12h'
export const API_TOKEN_EXPIRATION_PERIOD = '30d'

export const AUTH_SCOPES = {
  API: 'API',
  MAGICLINK: 'MAGICLINK',
}

export const NETWORK_MAINNET = 'mainnet'
export const NETWORK_RINKEBY = 'rinkeby'

export const ALLOWED_NETWORKS = [NETWORK_MAINNET, NETWORK_RINKEBY]

export const EMAIL_ALIASES = {
  MAGICLINK: 'magiclink',
}

export const NOTIFICATION_SCAN_INTERVAL = 1000 * 10

const MINUTE_MS = 1000 * 60
export const NOTIFICATION_SCAN_REPOLL_INTERVAL = MINUTE_MS * 5

export const POSTGRES_UNIQUE_VIOLATION = '23505'
