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

const SECOND_MS = 1000
const MINUTE_MS = SECOND_MS * 60
export const NOTIFICATION_SCAN_INTERVAL = SECOND_MS * 10

export const NOTIFICATION_SCAN_REPOLL_INTERVAL = MINUTE_MS * 2

export const POSTGRES_UNIQUE_VIOLATION = '23505'

export const JWT_ALGORITHM = 'HS256'

export const ENS_REGISTRIES = {
  mainnet: '0x314159265dd8dbb310642f98f50c066173c1259b',
  rinkeby: '0x98df287b6c145399aaa709692c8d308357bc085d',
}
