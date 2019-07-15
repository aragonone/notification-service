/* eslint-disable no-unused-vars */
'use strict'

import Scheduler from '../service/scheduler'
import {
  NOTIFICATION_SCAN_INTERVAL,
  NOTIFICATION_SCAN_REPOLL_INTERVAL,
  NETWORK_MAINNET,
  NETWORK_RINKEBY,
} from '../constants'

const notificationScanner = {
  name: 'ns/notification-scanner',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['ns/metrics', 'ns/database', 'ns/web3'])
    const notificationScannerFn = scanNotifications(server)

    // eslint-disable-next-line no-unused-vars
    const notifications = new Scheduler(
      notificationScannerFn,
      NOTIFICATION_SCAN_INTERVAL
    )

    if (process.env.NODE_ENV !== 'production') {
      server.route({
        method: 'GET',
        path: '/scanner',
        handler: (request, h) =>
          notificationScannerFn() && h.response().code(200),
        options: { auth: false },
      })
    }
  },
}

export default notificationScanner

/**
 * Notification scanner function to be called routinely
 * by the scheduler
 *
 * Closure is used to make the server object accesible for logging
 * and instrumentation with metrics
 *
 * @param {*} server
 */
const scanNotifications = server => {
  const { db, getWeb3 } = server.app

  const scansCounter = new server.Prometheus.Counter({
    name: 'notification_scanner_runs_total',
    help: 'The number of scans for subscriptions',
  })

  const notificationsCounter = new server.Prometheus.Counter({
    name: 'notification_scanner_notifications_created_total',
    help: 'The number of notifications created',
  })

  const contractsToScanGauge = new server.Prometheus.Gauge({
    name: 'notification_scanner_scanned_contracts',
    help: 'The number of unique contracts scanned',
  })

  const pastLogsCounter = new server.Prometheus.Counter({
    name: 'notification_scanner_get_past_logs_total',
    help: 'The number of calls to getPastLogs',
  })

  const web3ErrorHandler = (error, network) => {
    server.app.metrics.web3ErrorCounter.labels(network).inc()
    server.log(['error', 'web3'], error)
  }

  const dbErrorHandler = error => {
    server.app.metrics.dbErrorCounter.inc()
    server.log(['error', 'db'], error)
  }

  const getSubscriptionsForContract = contractAddress => {
    return db('eventsources')
      .select(
        'eventsources.eventsource_id as eventsourceId',
        'eventsources.contract_address as contractAddress',
        'eventsources.event_name as eventName',
        'subscriptions.join_block as joinBlock',
        'subscriptions.subscription_id as subscriptionId'
      )
      .join(
        'subscriptions',
        'eventsources.eventsource_id',
        'subscriptions.eventsource_id'
      )
      .where('eventsources.contract_address', contractAddress)
  }

  const getContractsToScan = ({ repollTime } = {}) => {
    return db('eventsources')
      .count('event_name')
      .min({ fromBlock: 'from_block' })
      .select('abi', 'contract_address as contractAddress', 'network')
      .whereRaw('enabled is true AND (last_poll is null OR last_poll <= ?)', [
        repollTime.toISOString(),
      ])
      .groupBy('contract_address', 'abi', 'network')
      .orderBy('count', 'desc')
  }

  /**
   * Takes events returned from web3.getPastEvents, matches them with subscriptions
   * to create notifications rows in the database
   *
   * @param {Object} options.db  a knex db or transaction instance
   * @param {Object} options.events  events as returned from web3.getPastLogs
   */
  const createNotificationsForSubscriptions = async ({
    network,
    db,
    events,
    subscriptions,
  }) => {
    const eventsWithSubs = events
      .map(event => {
        const matchedSubscriptions = subscriptions.filter(
          subscription =>
            event.blockNumber > Number(subscription.joinBlock) &&
            subscription.eventName === event.event
        )
        return [event, matchedSubscriptions]
      })
      .filter(([event, matchedSubscriptions]) => {
        return matchedSubscriptions.length > 0
      })

    const decoratedEventsWithSubs = await Promise.all(
      eventsWithSubs.map(async ([event, matchedSubscriptions]) => {
        const web3 = getWeb3(network)
        let timestamp
        try {
          const blockInfo = await web3.eth.getBlock(event.blockNumber)
          timestamp = blockInfo.timestamp
        } catch (error) {
          web3ErrorHandler(error, network)
          throw error
        }
        return [{ ...event, timestamp }, matchedSubscriptions]
      })
    )

    return Promise.all(
      decoratedEventsWithSubs.flatMap(([event, matchedSubscriptions]) => {
        return matchedSubscriptions.map(subscription =>
          db('notifications').insert({
            subscription_id: subscription.subscriptionId,
            return_values: JSON.stringify(event.returnValues),
            transaction_hash: event.transactionHash,
            block: event.blockNumber,
            block_time: new Date(event.timestamp * 1000).toISOString(),
          })
        )
      })
    )
  }

  /**
   * Update eventsources' last_poll and from_block after a scanning a contract's events
   *
   * @param {Object} options.db  a knex db or transaction instance
   * @param {string} options.contractAddress  contract address of event sources to update
   */
  const updateEventsources = ({
    db,
    network,
    contractAddress,
    blockNumber,
  }) => {
    if (!network || !contractAddress || !blockNumber) {
      throw new Error('network, contractAddress and blockNumber required')
    }
    return db('eventsources')
      .where({ contract_address: contractAddress, network })
      .update({
        last_poll: new Date().toISOString(),
        from_block: blockNumber,
      })
  }

  /**
   * Main notification scanner function
   */
  return async () => {
    scansCounter.inc()
    const repollTime = new Date(Date.now() - NOTIFICATION_SCAN_REPOLL_INTERVAL) // A timestamp some minutes ago

    const latestBlock = {}
    try {
      latestBlock[NETWORK_MAINNET] = await server.app.getLatestBlock(
        NETWORK_MAINNET
      )
      latestBlock[NETWORK_RINKEBY] = await server.app.getLatestBlock(
        NETWORK_RINKEBY
      )
    } catch (error) {
      // logging/counter updated in getLatestBlock
      return // exit the scanner
    }

    let contractsToScan
    try {
      contractsToScan = await getContractsToScan({ repollTime })
    } catch (error) {
      dbErrorHandler(error)
      return // exit the scanner
    }

    contractsToScanGauge.set(contractsToScan.length) // Update the gague

    for (const contract of contractsToScan) {
      const { abi, contractAddress, fromBlock, network } = contract

      let subscriptions
      try {
        subscriptions = await getSubscriptionsForContract(contractAddress)
      } catch (error) {
        dbErrorHandler(error)
        return
      }

      if (subscriptions.length === 0) {
        // Skip eventsources with no matched subscriptions
        continue
      }
      const web3 = getWeb3(network)
      const web3Contract = new web3.eth.Contract(abi, contractAddress)
      let events
      try {
        // TODO: if the contract's event_name count is 1, we can filter with the actual event instead of doing it client side `allEvent`
        pastLogsCounter.inc()
        events = await web3Contract.getPastEvents('allEvents', {
          fromBlock,
          toBlock: latestBlock[network],
        })
      } catch (error) {
        web3ErrorHandler(error, network)
        continue
      }

      if (events.length === 0) {
        try {
          await updateEventsources({
            db,
            network,
            contractAddress,
            blockNumber: latestBlock[network],
          })
        } catch (error) {
          dbErrorHandler(error)
          return
        }
        // Continue to next contract
        continue
      }

      if (events.length > 0) {
        // Found events, create notifications and update event source
        try {
          let notifications
          const result = await db.transaction(async trx => {
            notifications = await createNotificationsForSubscriptions({
              network,
              db: trx,
              events,
              subscriptions,
            })
            await updateEventsources({
              db: trx,
              network,
              contractAddress,
              blockNumber: latestBlock[network],
            })
          })
          notificationsCounter.inc(notifications.count)
          // transcation was success and automatically committed
        } catch (error) {
          // transaction failed and was rolled back automatically
          dbErrorHandler(error)
        }
      }
    }
  }
}
