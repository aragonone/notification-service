import Joi from '@hapi/joi'
import jwt from 'jsonwebtoken'
import {
  AUTH_SCOPES,
  MAGICLINK_EXPIRATION_PERIOD,
  API_TOKEN_EXPIRATION_PERIOD,
} from '../constants'
import Boom from '@hapi/boom'

const account = {
  name: 'account',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['web3', 'database'])

    server.route(routes)
  },
}

export default account

const routes = [
  {
    method: 'POST',
    path: '/login',
    handler: loginHandler,
    options: {
      auth: false,
      validate: {
        payload: {
          dao: Joi.string(),
          email: Joi.string()
            .email()
            .required(),
        },
      },
    },
  },
  {
    // Endpoint to verify the email and magiclink and to generate a long lived token
    method: 'POST',
    path: '/verify',
    handler: verifyHandler,
    options: {
      auth: AUTH_SCOPES.MAGICLINK,
    },
  },
]

/**
 * Login/Registration handler
 * Generates a short lived verification token and sends an email
 */
async function loginHandler(request, h) {
  const { db, sendMagicLink } = request.server.app
  // TODO: change `dao` to callback url and pass url from client (remove CLIENT_URL)
  const { email, dao } = request.payload
  try {
    const rows = await db('users')
      .select('email')
      .where({ email })

    if (rows.length === 0) {
      // user doesn't exist - persist first
      await db('users').insert({ email, verified: false })
    }
    // generate token and send email
    // TODO: Perhaps magic link tokens should be stateful one use
    const token = generateMagicLinkToken(email)
    await sendMagicLink(email, dao, token)
    return h.response().code(200)
  } catch (error) {
    return Boom.badImplementation(error.message)
  }
}

async function verifyHandler(request, h) {
  const { db } = request.server.app
  const { email } = request.auth.credentials
  try {
    await db('users')
      .where({ email })
      .update({ verified: true })
  } catch (error) {
    return Boom.badImplementation(error.message)
  }
  // Add more info to token and make
  const token = generateApiToken(email)
  return h
    .response()
    .code(200)
    .header('Authorization', token)
}

function generateMagicLinkToken(email) {
  const jwtPayload = { email, scope: AUTH_SCOPES.MAGICLINK }
  return jwt.sign(jwtPayload, process.env.JWT_KEY, {
    algorithm: 'HS256',
    expiresIn: MAGICLINK_EXPIRATION_PERIOD,
  })
}

function generateApiToken(email) {
  const jwtPayload = { email, scope: AUTH_SCOPES.API }

  return jwt.sign(jwtPayload, process.env.JWT_KEY, {
    algorithm: 'HS256',
    expiresIn: API_TOKEN_EXPIRATION_PERIOD,
  })
}
