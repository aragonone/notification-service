import { validateMagiclink, validateAPIToken } from '../service/auth'
import { AUTH_SCOPES } from '../constants'

// A plugin to configure the two jwt auth strategies
const auth = {
  name: 'auth',
  version: '1.0.0',
  register: async function(server, options) {
    const jwtAuthOptions = {
      key: process.env.JWT_KEY,
      verifyOptions: { algorithms: ['HS256'] },
    }
    // short lived token in the magiclink sent by email
    server.auth.strategy(AUTH_SCOPES.MAGICLINK, 'jwt', {
      ...jwtAuthOptions,
      validate: validateMagiclink,
    })

    // long lived token pesisted in the user browser
    server.auth.strategy(AUTH_SCOPES.API, 'jwt', {
      ...jwtAuthOptions,
      validate: validateAPIToken,
    })

    // Require by default API token unless otherwise configured
    server.auth.default(AUTH_SCOPES.API)
  },
}

export default auth
