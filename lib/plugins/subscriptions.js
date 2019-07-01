import Joi from '@hapi/joi'
import { AUTH_SCOPES, NETWORK_MAINNET, ALLOWED_NETWORKS } from '../constants'
import Boom from '@hapi/boom'

const subscriptions = {
  name: 'subscriptions',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['web3', 'database', 'apm'])

    server.route(routes)
  },
}

export default subscriptions

const routes = [
  {
    method: 'GET',
    path: '/subscriptions',
    handler: getSubscriptions,
    options: { auth: AUTH_SCOPES.API },
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
          // TODO: event hash and contractAddress should be enough
          // TODO: remove appName and derive from contract
          appName: Joi.string().required(),
          eventName: Joi.string().required(),
          contractAddress: Joi.string().required(),
          network: Joi.any().valid(...ALLOWED_NETWORKS),
        },
      },
    },
  },
  {
    method: 'DELETE',
    path: '/subscriptions/{subscriptionId}',
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

async function getSubscriptions(request, h) {
  const { db } = request.server.app
  const { userId } = request.auth.credentials

  try {
    const userSubscriptions = await db('subscriptions')
      .select(
        'eventsources.contract_address as contractAddress',
        'eventsources.event_name as eventName',
        'eventsources.network as network',
        'subscriptions.subscription_id as subscriptionId',
        'subscriptions.created_at as createdAt'
      )
      .join(
        'eventsources',
        'eventsources.eventsource_id',
        '=',
        'subscriptions.eventsource_id'
      )
      .where({ user_id: userId })
    return h.response(userSubscriptions)
  } catch (error) {
    request.log('error', `Failed getting subscriptions: ${error.message}`)
    return Boom.badImplementation()
  }
}

async function createSubscription(request, h) {
  const { db } = request.server.app
  const { userId } = request.auth.credentials
  const { eventName, contractAddress, appName } = request.payload
  const network = request.payload.network || NETWORK_MAINNET
  let trx
  try {
    // get latest block and abi for the app
    const [latestBlock, abi] = await Promise.all([
      request.server.app.getLatestBlock(),
      request.server.app.getAbiFromApmServe(appName),
    ])

    const [eventsource] = await db('eventsources')
      .select('eventsource_id')
      .where({
        contract_address: contractAddress,
        event_name: eventName,
        network,
      })

    let eventsourceId
    if (eventsource) {
      // event source exists. Just persist subscription
      eventsourceId = eventsource.eventsource_id

      const subscriptionId = await db('subscriptions')
        .insert(
          {
            eventsource_id: eventsourceId,
            user_id: userId,
            join_block: latestBlock,
          },
          'subscription_id'
        )
        .then(([id]) => id)
      return h.response({ subscriptionId: subscriptionId }).code(201)
    }

    // eventsource doesn't exists. Create eventsource and subscription
    trx = await db.transaction()

    eventsourceId = await trx('eventsources')
      .insert({
        contract_address: contractAddress,
        app_name: appName,
        event_name: eventName,
        network,
        abi: JSON.stringify(abi),
        from_block: latestBlock,
      })
      .returning('eventsource_id')
      .then(([id]) => id)

    const subscriptionId = await trx('subscriptions')
      .insert({
        eventsource_id: eventsourceId,
        user_id: userId,
        join_block: latestBlock,
      })
      .returning('subscription_id')
      .then(([id]) => id)

    await trx.commit()

    return h.response({ subscriptionId: subscriptionId }).code(201)
  } catch (error) {
    trx && trx.rollback()
    request.log('error', error)
    throw Boom.badImplementation()
  }
}

async function deleteSubscription(request, h) {
  const { db } = request.server.app
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
