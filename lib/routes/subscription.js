import Joi from '@hapi/joi'
import { AUTH_SCOPES } from '../constants'
import { getApmUrl } from '../utils'
import db from '../service/database'
import web3 from '../service/web3'
import Boom from '@hapi/boom'
import axios from 'axios'

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
    handler: createSubscription,
    options: {
      auth: AUTH_SCOPES.API,
      validate: {
        payload: {
          // name of the app/APM repository
          appName: Joi.string().required(),
          eventName: Joi.string().required(),
          contractAddress: Joi.string().required(),
        },
      },
    },
  },
  {
    method: 'DELETE',
    path: '/subscription/{subscriptionId}',
    handler: deleteSubscription,
    options: {
      auth: AUTH_SCOPES.API,
      validate: {
        params: {
          subscriptionId: Joi.number().required(),
        },
      },
    },
  },
]

async function createSubscription(request, h) {
  const { userId } = request.auth.credentials
  const { appName, eventName, contractAddress } = request.payload
  try {
    const latestBlock = await getLatestBlock()
    const abi = await getAbi(appName)

    const subscription = await db('subscriptions')
      .insert({
        user_id: userId,
        app_name: appName,
        contract_address: contractAddress,
        event_name: eventName,
        from_block: latestBlock,
        abi: JSON.stringify(abi),
      })
      .returning('subscription_id')

    return h
      .response({
        subscription_id: subscription[0],
      })
      .code(201)
  } catch (error) {
    request.log('error', `Failed to create subscription: ${error.message}`)
    return Boom.badImplementation()
  }
}

async function deleteSubscription(request, h) {
  const { userId } = request.auth.credentials
  const { subscriptionId } = request.params

  try {
    const deleteCount = await db('subscriptions')
      .where({
        // userId is added to ensure only rows owned by user can be deleted
        user_id: userId,
        subscription_id: subscriptionId,
      })
      .delete()

    return h.response(deleteCount).code(200)
  } catch (error) {
    request.log('error', `Failed to create subscription: ${error.message}`)
    return Boom.badImplementation()
  }
}

async function getLatestBlock() {
  try {
    return await web3.eth.getBlockNumber()
  } catch (error) {
    throw new Error(`Error getting blockNumber from web3: ${error.message}`)
  }
}

async function getAbi(app) {
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

export default routes
