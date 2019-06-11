import Joi from '@hapi/joi'
import { AUTH_SCOPES } from '../constants'
import db from '../service/database'
import web3 from '../service/web3'
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
    handler: async (request, h) => {
      // Valid decoded token in `request.auth.credentials`
      const { userId } = request.auth.credentials
      const { eventHash, contractAddress } = request.payload
      let blockNumber
      try {
        blockNumber = await web3.eth.getBlockNumber()
      } catch (error) {
        // TODO: add web3 error count prometheus metrics
        request.log(
          ['error', 'web3'],
          `Error getting blockNumber: ${error.message}`
        )
        return Boom.badImplementation()
      }

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
