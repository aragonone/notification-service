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

  const web3ErrorCounter = new server.Prometheus.Counter({
    name: 'notification_scanner_web3_error_total',
    help: 'The number of web3 eth errors',
  })

  const getLatestBlockWrapped = async () => {
    try {
      return await getLatestBlock()
    } catch (error) {
      web3ErrorCounter.inc()
      server.log(['web3', 'error'], error)
    }
  }

  const getSubscriptionsToScan = ({ contractAddress, repollTime } = {}) => {
    try {
      return db('subscriptions')
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
          [contractAddress, repollTime.toISOString()]
        )
        .join('users', 'users.user_id', '=', 'subscriptions.user_id')
        .orderBy('last_poll')
    } catch (error) {
      web3ErrorCounter.inc()
      server.log(['web3', 'error'], error)
    }
  }

  const getContractsToScan = ({ repollTime } = {}) => {
    return db('subscriptions')
      .count('contract_address')
      .min({ fromBlock: 'from_block' })
      .select('contract_address as contractAddress', 'subscriptions.abi')
      .whereNull('last_poll')
      .orWhere('last_poll', '<=', repollTime.toISOString())
      .groupBy('contract_address', 'abi ')
      .orderBy('count', 'desc')
  }

  return async () => {
    scansCounter.inc()
    const repollTime = new Date(Date.now() - NOTIFICATION_SCAN_REPOLL_INTERVAL) // A timestamp some minutes ago

    // Group all contracts be scanned per contract
    const contractsToScan = await getContractsToScan({ repollTime })
    // console.log(contractsToScan)

    // { contractAddress -> [ { subscription1 }  , { subscription2 } ] }
    // const subscriptionsPerContract = {}

    const subscriptionPromises = contractsToScan.map(({ contractAddress }) =>
      getSubscriptionsToScan({ contractAddress, repollTime })
    )

    // get latest block to delimit getLogs and to update subscription
    const latestBlock = await getLatestBlockWrapped()

    const subscriptions = await Promise.all(subscriptionPromises)

    // const eventPromises = contractsToScan.map(contract => {
    //   const { abi, contractAddress, fromBlock } = contract

    //   const web3Contract = new web3.eth.Contract(abi, contractAddress)
    //   pastLogsCounter.inc()
    //   return web3Contract
    //     .getPastEvents(null, { fromBlock, toBlock: latestBlock })
    //     .then(events => {
    //       // console.log(`${contractAddress} -> ${eventName}`, events)

    //       if (events.length > 0) {
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
