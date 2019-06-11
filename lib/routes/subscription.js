import Joi from '@hapi/joi'
import { AUTH_SCOPES } from '../constants'
import db from '../service/database'
import Boom from '@hapi/boom'

const routes = [
  {
    method: 'GET',
    path: '/subscriptions',
    handler: async (request, h) => {
      const { userId } = request.auth.credentials

      const userSubscriptions = await db('subscriptions')
        .select()
        .where({ user_id: userId })

      console.log('userSubscriptions: ', userSubscriptions)
      // return `Hello ${email} (user_id: ${userId})`
      return h.response(userSubscriptions)
    },
    options: {
      auth: AUTH_SCOPES.API,
    },
  },
  {
    method: 'POST',
    path: '/subscription',
    handler: (request, h) => {
      // Valid decoded token in `request.auth.credentials`
      const { userId } = request.auth.credentials
      const { email } = request.payload

      // TODO: update verify field in DB and generate a long lived access token
      return `Hello ${email}`
    },
    options: {
      auth: AUTH_SCOPES.API,
      validate: {
        payload: {
          eventHash: Joi.string().required(),
          contractAddress: Joi.string().required(),
          // email: Joi.string().email().required(),
        },
      },
    },
  },
]

export default routes
