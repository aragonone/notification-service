/* eslint-disable no-unused-vars */
'use strict'

import Scheduler from '../service/scheduler'
import { sendNotificationEmail } from '../service/mail'
import {
  NOTIFICATION_SCAN_INTERVAL,
  NOTIFICATION_SCAN_REPOLL_INTERVAL,
} from '../constants'

const notificationScanner = {
  name: 'notificationScanner',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['@promster/hapi', 'database', 'metrics'])
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
  const { db, web3 } = server.app

  const scansCounter = new server.Prometheus.Counter({
    name: 'notification_scanner_runs_total',
    help: 'The number of scans for subscriptions',
  })

  const contractsToScanGauge = new server.Prometheus.Gauge({
    name: 'notification_scanner_scanned_contracts',
    help: 'The number of unique contracts scanned',
  })

  const pastLogsCounter = new server.Prometheus.Counter({
    name: 'notification_scanner_get_past_logs_total',
    help: 'The number of calls to getPastLogs',
  })

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
      .select('abi', 'contract_address as contractAddress')
      .whereRaw('enabled is true AND (last_poll is null OR last_poll <= ?)', [
        repollTime.toISOString(),
      ])
      .groupBy('contract_address', 'abi')
      .orderBy('count', 'desc')
  }

  /**
   * Takes events returned from web3.getPastEvents, matches them with subscriptions
   * to create notifications rows in the database
   *
   * @param {Object} options.db  a knex db or transaction instance
   * @param {Object} options.events  events as returned from web3.getPastLogs
   */
  const createNotificationsForSubscriptions = ({
    db,
    events,
    subscriptions,
  }) => {
    const promises = events.flatMap(event => {
      return subscriptions
        .filter(
          subscription =>
            event.blockNumber > Number(subscription.joinBlock) &&
            subscription.eventName === event.event
        )
        .map(subscription =>
          db('notifications').insert({
            subscription_id: subscription.subscriptionId,
            return_values: JSON.stringify(event.returnValues),
            transaction_hash: event.transactionHash,
            block: event.blockNumber,
          })
        )
    })

    return Promise.all(promises)
  }

  /**
   * Update eventsources' last_poll and from_block after a scanning a contract's events
   *
   * @param {Object} options.db  a knex db or transaction instance
   * @param {string} options.contractAddress  contract address of event sources to update
   */
  const updateEventsources = ({ db, contractAddress, blockNumber }) => {
    return db('eventsources')
      .where({ contract_address: contractAddress })
      .update({
        last_poll: new Date().toISOString(),
        from_block: blockNumber,
      })
  }

  const web3ErrorHandler = error => {
    server.app.metrics.web3ErrorCounter.inc()
    server.log(['error', 'web3'], error)
  }

  const dbErrorHandler = error => {
    server.app.metrics.dbErrorCounter.inc()
    server.log(['error', 'db'], error)
  }

  /**
   * Main notification scanner function
   */
  return async () => {
    scansCounter.inc()
    const repollTime = new Date(Date.now() - NOTIFICATION_SCAN_REPOLL_INTERVAL) // A timestamp some minutes ago

    let latestBlock
    try {
      latestBlock = await server.app.getLatestBlock()
    } catch (error) {
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
      const { abi, contractAddress, fromBlock } = contract

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

      const web3Contract = new web3.eth.Contract(abi, contractAddress)
      let events
      try {
        // TODO: if the contract's event_name count is 1, we can filter with the actual event instead of doing it client side `allEvent`
        pastLogsCounter.inc()
        events = await web3Contract.getPastEvents('allEvents', {
          fromBlock,
          toBlock: latestBlock,
        })
      } catch (error) {
        web3ErrorHandler(error)
        continue
      }

      if (events.length === 0) {
        try {
          await updateEventsources({ db, contractAddress, latestBlock })
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
          const result = await db.transaction(async trx => {
            await createNotificationsForSubscriptions({
              db: trx,
              events,
              subscriptions,
            })
            await updateEventsources({
              db: trx,
              blockNumber: latestBlock,
              contractAddress,
            })
          })
          // transcation was success and automatically committed
        } catch (error) {
          // transaction failed and was rolled back automatically
          server.log(['error', 'db'], error)
        }
      }
    }
  }
}
