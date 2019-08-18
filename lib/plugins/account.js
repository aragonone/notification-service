import Joi from '@hapi/joi'
import jwt from 'jsonwebtoken'
import {
  AUTH_SCOPES,
  MAGICLINK_EXPIRATION_PERIOD,
  API_TOKEN_EXPIRATION_PERIOD,
  JWT_ALGORITHM,
} from '../constants'
import Boom from '@hapi/boom'

const account = {
  name: 'ns/account',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['ns/web3', 'ns/database', 'ns/mail'])

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
      tags: ['api'],
      auth: false,
      validate: {
        failAction: (request, h, err) => {
          // show validation errors to user https://github.com/hapijs/hapi/issues/3706
          throw err
        },
        payload: {
          dao: Joi.string().required(),
          network: Joi.string().required(),
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
      tags: ['api'],
      auth: AUTH_SCOPES.MAGICLINK,
    },
  },
  {
    // Endpoint get a user account
    method: 'GET',
    path: '/account',
    handler: getAccountHandler,
    options: {
      tags: ['api'],
      auth: AUTH_SCOPES.API,
    },
  },
  {
    // Endpoint delete a user account
    method: 'DELETE',
    path: '/account',
    handler: deleteAccountHandler,
    options: {
      tags: ['api'],
      auth: AUTH_SCOPES.API,
    },
  },
]

/**
 * Login/Registration handler
 * Generates a short lived verification token and sends an email
 */
async function loginHandler(request, h) {
  const { db, sendMagicLink } = request.server.app
  const { email, dao, network } = request.payload
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
    await sendMagicLink({ email, dao, token, network })
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

async function deleteAccountHandler(request, h) {
  const { userId } = request.auth.credentials
  const { db } = request.server.app

  try {
    const deleteCount = await db('users')
      .where({
        user_id: userId,
      })
      .delete()

    return h.response(deleteCount).code(200)
  } catch (error) {
    request.log('error', `Failed to delete user: ${error.message}`)
    return Boom.badImplementation()
  }
}

async function getAccountHandler(request, h) {
  const { userId } = request.auth.credentials
  const { db } = request.server.app

  try {
    const user = await db('users')
      .select('user_id as userId', 'email')
      .where({
        user_id: userId,
      })

    return h.response(user).code(200)
  } catch (error) {
    request.log('error', `Failed to get user: ${error.message}`)
    return Boom.badImplementation()
  }
}

function generateMagicLinkToken(email) {
  const jwtPayload = { email, scope: AUTH_SCOPES.MAGICLINK }
  return jwt.sign(jwtPayload, process.env.JWT_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: MAGICLINK_EXPIRATION_PERIOD,
  })
}

function generateApiToken(email) {
  const jwtPayload = { email, scope: AUTH_SCOPES.API }

  return jwt.sign(jwtPayload, process.env.JWT_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: API_TOKEN_EXPIRATION_PERIOD,
  })
}
