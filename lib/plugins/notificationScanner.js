'use strict'

import Scheduler from '../service/scheduler'
import { sendNotificationEmail } from '../service/mail'
import web3, { getLatestBlock } from '../service/web3'
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
    const notifications = new Scheduler(
      scanNotifications(server),
      NOTIFICATION_SCAN_INTERVAL
    )
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
  const { db } = server.app

  const scansCounter = new server.Prometheus.Counter({
    name: 'notification_scanner_db_scans_total',
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

  return async () => {
    scansCounter.inc()
    console.log('--- notificationsTask | Start')
    // select count(contract_address),min(from_block), contract_address, event_name from subscriptions group by contract_address, event_name
    // select contract_address,min(from_block), contract_address, event_name from subscriptions group by contract_address, event_name

    const fiveMinsAgo = new Date(Date.now() - 1000 * 60 * 5)

    // select count(contract_address),min(from_block),contract_address from subscriptions where last_poll is null or "last_poll" <= '2019-06-27T14:48:40.717Z' group by contract_address order by 1 desc
    const contractsToScan = await db('subscriptions')
      .count('contract_address')
      .min({ fromBlock: 'from_block' })
      .select('contract_address as contractAddress', 'subscriptions.abi')
      .whereNull('last_poll')
      .orWhere('last_poll', '<=', fiveMinsAgo.toISOString())
      .groupBy('contract_address', 'abi ')
      .orderBy('count', 'desc')

    const subscriptionsPerContract = {}

    for (const contract of contractsToScan) {
      subscriptionsPerContract[contract.contractAddress] = await db(
        'subscriptions'
      )
        .select(
          'subscriptions.contract_address as contractAddress',
          'subscriptions.event_name as eventName',
          'subscriptions.user_id as userId',
          'subscriptions.from_block as fromBlock',
          'subscriptions.subscription_id as subscriptionId',
          'users.email'
        )
        .whereRaw(
          'contract_address = ? AND (last_poll is null OR last_poll <= ?)',
          [contract.contractAddress, fiveMinsAgo.toISOString()]
        )
        // .whereNull('last_poll')
        // .orWhere('last_poll', '<=')
        .join('users', 'users.user_id', '=', 'subscriptions.user_id')
        .orderBy('last_poll')
    }
    return

    const latestBlockPromise = getLatestBlock()

    const [subscriptions, latestBlock] = await Promise.all([
      subscriptionsPromise,
      latestBlockPromise,
    ])

    const eventPromises = subscriptions.map(subscription => {
      const {
        abi,
        contractAddress,
        eventName,
        fromBlock,
        subscriptionId,
        email,
      } = subscription

      const contract = new web3.eth.Contract(abi, contractAddress)
      pastLogsCounter.inc()
      return contract
        .getPastEvents(eventName, { fromBlock, toBlock: latestBlock })
        .then(events => {
          // console.log(`${contractAddress} -> ${eventName}`, events)

          if (events.length > 0) {
            // eslint-disable-next-line promise/no-nesting
            sendNotificationEmail(email, events)
              .then(() => mailSentCounter.inc())
              .catch(error => {
                mailErrorCounter.inc()
                server.log('error', error)
              })
          }

          // return db('subscriptions')
          //   .where({ subscription_id: subscriptionId })
          //   .update({
          //     last_poll: new Date().toISOString(),
          //     from_block: latestBlock,
          //   })
        })
    })

    await Promise.all(eventPromises)
  }
}
