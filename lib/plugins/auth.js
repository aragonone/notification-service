import Joi from '@hapi/joi'
import { AUTH_SCOPES } from '../constants'

// A plugin to configure the two jwt auth strategies
const auth = {
  name: 'auth',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['database', 'metrics'])

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

const magicLinkTokenSchema = {
  email: Joi.string()
    .email()
    .required(),
  scope: Joi.string()
    .valid(AUTH_SCOPES.MAGICLINK)
    .required(),
  iat: Joi.any(),
  exp: Joi.any(),
}

const apiTokenSchema = {
  email: Joi.string()
    .email()
    .required(),
  scope: Joi.string()
    .valid(AUTH_SCOPES.API)
    .required(),
  iat: Joi.any(),
  exp: Joi.any(),
}

const validateMagiclink = async (decoded, request, h) => {
  const { db } = request.server.app
  const { email } = decoded
  const { error } = Joi.validate(decoded, magicLinkTokenSchema)

  if (error) {
    request.log(['error', 'auth'], `Magiclink token error: ${error.message}`)
    return { isValid: false }
  }

  let users
  try {
    users = await db('users')
      .select('email')
      .where({ email })

    if (users.length === 1) {
      return { isValid: true }
    }
  } catch (error) {
    request.server.app.metrics.dbErrorCounter.inc()
    request.log(['error', 'auth', 'db'], error)
  }

  return { isValid: false }
}

const validateAPIToken = async (decoded, request, h) => {
  const { db } = request.server.app
  const { email } = decoded
  const { error } = Joi.validate(decoded, apiTokenSchema)

  if (error) {
    request.log(['error', 'auth'], `Magiclink token error: ${error.message}`)
    return { isValid: false }
  }

  let users
  try {
    users = await db('users')
      .select('email', 'user_id')
      // ensure that the user is verified
      .where({ email, verified: true })

    if (users.length === 1) {
      const [{ user_id: userId }] = users
      // Add user_id from DB to credentials object accessbile in route handlers
      return {
        isValid: true,
        credentials: {
          ...decoded,
          userId,
        },
      }
    }
  } catch (error) {
    request.server.app.metrics.dbErrorCounter.inc()
    request.log(['error', 'auth', 'db'], error)
    return { isValid: false, errorMessage: 'DB Error' }
  }

  return { isValid: false, errorMessage: 'User not found' }
}
