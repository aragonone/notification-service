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
    server.dependency(['@promster/hapi', 'database'])
    // eslint-disable-next-line no-unused-vars
    // const notifications = new Scheduler(
    //   scanNotifications(server),
    //   NOTIFICATION_SCAN_INTERVAL
    // )
    const notificationScannerFn = scanNotifications(server)

    server.route({
      method: 'GET',
      path: '/notification',
      handler: (request, h) =>
        notificationScannerFn() && h.response().code(200),
      options: { auth: false },
    })
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

  const pastLogsCounter = new server.Prometheus.Counter({
    name: 'notification_scanner_get_past_logs_total',
    help: 'The number of calls to getPastLogs',
  })

  const mailErrorCounter = new server.Prometheus.Counter({
    name: 'notification_scanner_mail_error_total',
    help: 'The number of errors sending an email',
  })

  const mailSentCounter = new server.Prometheus.Counter({
    name: 'notification_scanner_mail_sent_total',
    help: 'The number of emails sent by notification scanner',
  })

  const web3ErrorCounter = new server.Prometheus.Counter({
    name: 'notification_scanner_web3_error_total',
    help: 'The number of web3 eth errors',
  })

  // const getSubscriptionsForEventsource = ({ eventsourceId } = {}) => {
  //   try {
  //     return db('subscriptions')
  //       .select(
  //         'subscriptions.contract_address as contractAddress',
  //         'subscriptions.event_name as eventName',
  //         'subscriptions.user_id as userId',
  //         'subscriptions.from_block as fromBlock',
  //         'subscriptions.subscription_id as subscriptionId',
  //         'users.email'
  //       )
  //       .whereRaw('contract_address = ?', [
  //         contractAddress,
  //         repollTime.toISOString(),
  //       ])
  //       .join('users', 'users.user_id', '=', 'subscriptions.user_id')
  //       .orderBy('last_poll')
  //   } catch (error) {
  //     server.log(['web3', 'error'], error)
  //   }
  // }

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
            event: JSON.stringify(event.returnValues),
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

  /**
   * Main notification scanner function
   */
  return async () => {
    scansCounter.inc()
    const repollTime = new Date(Date.now() - NOTIFICATION_SCAN_REPOLL_INTERVAL) // A timestamp some minutes ago

    const [latestBlock, contractsToScan] = await Promise.all([
      server.app.getLatestBlock(),
      getContractsToScan({ repollTime }),
    ])

    for (const contract of contractsToScan) {
      const { abi, contractAddress, fromBlock } = contract
      const subscriptions = await getSubscriptionsForContract(contractAddress)

      if (subscriptions.length === 0) {
        // Skip eventsources with no matched subscriptions
        continue
      }

      const web3Contract = new web3.eth.Contract(abi, contractAddress)

      // TODO: if the contract's event_name count is 1, we can filter with the actual event instead of doing it client side `allEvent`
      const events = await web3Contract.getPastEvents('allEvents', {
        fromBlock,
        toBlock: latestBlock,
      })

      if (events.length === 0) {
        await updateEventsources({ db, contractAddress, latestBlock })
        continue
      }

      if (events.length > 0) {
        // Found events, Check

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
            return 'what ever you like to get out'
          })
          // transcation was success and automatically committed
        } catch (err) {
          // transaction failed and was rolled back automatically
          server.log(['error', 'db'], error)
        }
      }
    }

    // get latest block to delimit getLogs and to update subscription

    // const eventPromises = contractsToScan.map(contract => {
    //   const { abi, contractAddress, fromBlock } = contract

    //   const web3Contract = new web3.eth.Contract(abi, contractAddress)
    //   pastLogsCounter.inc()
    // return web3Contract
    //   .getPastEvents(null, { fromBlock, toBlock: latestBlock })
    //   .then(events => {
    //     // console.log(`${contractAddress} -> ${eventName}`, events)

    //     if (events.length > 0) {
    //         // eslint-disable-next-line promise/no-nesting
    //         sendNotificationEmail(email, events)
    //           .then(() => mailSentCounter.inc())
    //           .catch(error => {
    //             mailErrorCounter.inc()
    //             server.log('error', error)
    //           })
    //       }

    //       // return db('subscriptions')
    //       //   .where({ subscription_id: subscriptionId })
    //       //   .update({
    //       //     last_poll: new Date().toISOString(),
    //       //     from_block: latestBlock,
    //       //   })
    //     })
    // })

    // await Promise.all(eventPromises)
  }
}
