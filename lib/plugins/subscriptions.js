import Joi from '@hapi/joi'
import {
  AUTH_SCOPES,
  NETWORK_MAINNET,
  ALLOWED_NETWORKS,
  POSTGRES_UNIQUE_VIOLATION,
} from '../constants'
import Boom from '@hapi/boom'

const subscriptions = {
  name: 'ns/subscriptions',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['ns/web3', 'ns/database'])

    server.route(routes)
  },
}

export default subscriptions

const routes = [
  {
    method: 'GET',
    path: '/subscriptions',
    handler: getSubscriptions,
    options: {
      tags: ['api'],
      auth: AUTH_SCOPES.API,
      validate: {
        failAction: (request, h, err) => {
          // show validation errors to user https://github.com/hapijs/hapi/issues/3706
          throw err
        },
        query: {
          network: Joi.any()
            .valid(...ALLOWED_NETWORKS)
            .optional(),
          kernelAddress: Joi.string().optional(),
          ensName: Joi.string()
            .optional()
            .notes(['The ENS name of the organisation']),
          contractAddress: Joi.string().optional(),
          appName: Joi.string().optional(),
        },
      },
    },
  },
  {
    method: 'POST',
    path: '/subscriptions',
    handler: createSubscription,
    options: {
      tags: ['api'],
      auth: AUTH_SCOPES.API,
      validate: {
        failAction: (request, h, err) => {
          // show validation errors to user https://github.com/hapijs/hapi/issues/3706
          throw err
        },
        payload: {
          abi: Joi.array().required(),
          // name of the app/APM repository as metadata.
          appName: Joi.string()
            .regex(/^.+\.eth$/)
            .required(),
          eventName: Joi.string().required(),
          ensName: Joi.string()
            .required()
            .notes(['The ENS name of the organisation']),
          contractAddress: Joi.string().required(),
          network: Joi.any().valid(...ALLOWED_NETWORKS),
        },
      },
    },
  },
  {
    method: 'DELETE',
    path: '/subscriptions/{subscriptionId}',
    handler: deleteSingleSubscription,
    options: {
      tags: ['api'],
      auth: AUTH_SCOPES.API,
      validate: {
        params: {
          subscriptionId: Joi.number().required(),
        },
      },
    },
  },
  {
    method: 'DELETE',
    path: '/subscriptions',
    handler: deleteSubscriptions,
    options: {
      tags: ['api'],
      auth: AUTH_SCOPES.API,
      validate: {
        payload: {
          subscriptions: Joi.array()
            .items(Joi.number())
            .required(),
        },
      },
    },
  },
]

async function getSubscriptions(request, h) {
  const { db } = request.server.app
  const { userId } = request.auth.credentials
  const {
    ensName,
    network,
    contractAddress,
    kernelAddress,
    appName,
  } = request.query
  try {
    const userSubscriptions = await db('subscriptions')
      .select(
        'eventsources.contract_address as contractAddress',
        'eventsources.kernel_address as kernelAddress',
        'eventsources.event_name as eventName',
        'eventsources.ens_name as ensName',
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
      .where(builder => {
        builder.where('subscriptions.user_id', userId)
        network && builder.andWhere('eventsources.network', network)
        contractAddress &&
          builder.andWhere('eventsources.contract_address', contractAddress)
        appName && builder.andWhere('eventsources.app_name', appName)
        kernelAddress &&
          builder.andWhere('eventsources.kernel_address', kernelAddress)
        ensName && builder.andWhere('eventsources.ens_name', ensName)

        return builder
      })
    return h.response(userSubscriptions)
  } catch (error) {
    request.log('error', `Failed getting subscriptions: ${error.message}`)
    return Boom.badImplementation()
  }
}

async function createSubscription(request, h) {
  const {
    db,
    web3: { getKernelForApp, getWeb3 },
  } = request.server.app
  const { userId } = request.auth.credentials
  const { eventName, contractAddress, appName, abi, ensName } = request.payload
  const network = request.payload.network || NETWORK_MAINNET

  try {
    const latestBlock = await request.server.app.web3.getLatestBlock(network)

    const [eventsource] = await db('eventsources')
      .select('eventsource_id')
      .where({
        contract_address: contractAddress,
        event_name: eventName,
        network,
      })

    if (eventsource) {
      // event source exists. Just persist subscription
      const eventsourceId = eventsource.eventsource_id
      const subscriptionId = await insertSubscription({
        db,
        eventsourceId,
        userId,
        latestBlock,
      })

      return h.response({ subscriptionId: subscriptionId }).code(201)
    }

    const web3 = getWeb3(network)

    // eventsource doesn't exists. Create eventsource and subscription in a transaction

    // get kernel for the app contract and verify it matches the resolved ENS address
    const [kernelAddress, resolvedENSAddress] = await Promise.all([
      getKernelForApp({ contractAddress, network }),
      web3.eth.ens.getAddress(ensName),
    ])

    if (!kernelAddress)
      return Boom.badRequest('No kernel found for contractAddress')

    // Only verify ENS names for mainnet because in rinkeby we use a custom registry that web3 doesn't support
    if (network === NETWORK_MAINNET && resolvedENSAddress !== kernelAddress)
      return Boom.badRequest('ENS name does not reolve to a valid kernel')

    const subscriptionId = await db.transaction(async trx => {
      const eventsourceId = await trx('eventsources')
        .insert({
          contract_address: contractAddress,
          kernel_address: kernelAddress,
          app_name: appName,
          event_name: eventName,
          ens_name: ensName,
          network,
          abi: JSON.stringify(abi),
          from_block: latestBlock,
        })
        .returning('eventsource_id')
        .then(([id]) => id)

      return insertSubscription({
        db: trx,
        eventsourceId,
        userId,
        latestBlock,
      })
    })
    // transcation was success and automatically committed
    return h.response({ subscriptionId: subscriptionId }).code(201)
  } catch (error) {
    // If the transaction failed it will rolled back automatically
    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      // 23505 is postgres's internal code for `unique_violation`.
      throw Boom.conflict('Subscription already exists')
    }
    request.log('error', error)
    throw Boom.badImplementation()
  }
}

const insertSubscription = async ({
  db,
  eventsourceId,
  userId,
  latestBlock,
}) => {
  return db('subscriptions')
    .insert({
      eventsource_id: eventsourceId,
      user_id: userId,
      join_block: latestBlock,
    })
    .returning('subscription_id')
    .then(([id]) => id)
}

async function deleteSingleSubscription(request, h) {
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
    request.log('error', `Failed to delete subscription: ${error.message}`)
    return Boom.badImplementation()
  }
}

async function deleteSubscriptions(request, h) {
  const { db } = request.server.app
  const { userId } = request.auth.credentials
  const { subscriptions } = request.payload

  try {
    const deleteCount = await db('subscriptions')
      .where(builder =>
        // userId is added to ensure only rows owned by user can be deleted
        builder
          .where('user_id', userId)
          .whereIn('subscription_id', subscriptions)
      )
      .delete()

    return h.response(deleteCount).code(200)
  } catch (error) {
    request.log('error', `Failed to delete subscriptions: ${error.message}`)
    return Boom.badImplementation()
  }
}
