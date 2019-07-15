/* eslint-disable no-unused-vars */
'use strict'

import Scheduler from '../service/scheduler'
import {
  NOTIFICATION_SCAN_INTERVAL,
  NOTIFICATION_SCAN_REPOLL_INTERVAL,
} from '../constants'

const notificationMailer = {
  name: 'notificationMailer',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['@promster/hapi', 'database', 'metrics'])
    const notificationMailerFn = sendNotifications(server)

    // eslint-disable-next-line no-unused-vars
    const notifications = new Scheduler(
      notificationMailerFn,
      NOTIFICATION_SCAN_INTERVAL
    )

    if (process.env.NODE_ENV !== 'production') {
      // Endpoint to manually trigger a scan
      server.route({
        method: 'GET',
        path: '/mailer',
        handler: (request, h) =>
          notificationMailerFn() && h.response().code(200),
        options: { auth: false },
      })
    }
  },
}

/**
 * Notification mailer - Scans the DB for queued notification and sends the emails
 *
 * called routinely by the scheduler
 *
 * Closure is used to make the server object accesible for logging
 * and instrumentation with metrics
 *
 * @param {*} server
 */
const sendNotifications = server => {
  const { db } = server.app

  const mailerCounter = new server.Prometheus.Counter({
    name: 'notification_mailer_runs_total',
    help: 'The number of runs of the notification mailer',
  })

  const sentNotificationsCounter = new server.Prometheus.Counter({
    name: 'notificatios_emails_sent_total',
    help: 'The number notification emails sent',
  })

  const setNotificationAsSent = notificationId => {
    if (!notificationId) return
    return db('notifications')
      .where({ notification_id: notificationId })
      .update({ sent: true })
  }

  const getNotificationToSend = () =>
    db('notifications')
      .select(
        'notifications.notification_id as notificationId',
        'notifications.block',
        'notifications.return_values as returnValues',
        'notifications.transaction_hash as transactionHash',
        'users.email',
        'eventsources.network',
        'eventsources.contract_address as contractAddress',
        'eventsources.event_name as eventName',
        'eventsources.app_name as appName'
      )
      .join(
        'subscriptions',
        'notifications.subscription_id',
        'subscriptions.subscription_id'
      )
      .join('users', 'subscriptions.user_id', 'users.user_id')
      .join(
        'eventsources',
        'subscriptions.eventsource_id',
        'eventsources.eventsource_id'
      )
      .where('notifications.sent', false) // get unsent notifications
      .orderBy('notifications.created_at', 'asc') // process older notifications first

  const dbErrorHandler = error => {
    server.app.metrics.dbErrorCounter.inc()
    server.log(['error', 'db'], error)
  }
  //  Main function
  return async () => {
    mailerCounter.inc()

    let notificationsToSend
    try {
      notificationsToSend = await getNotificationToSend()
    } catch (error) {
      dbErrorHandler(error)
      return
    }

    for (const notification of notificationsToSend) {
      try {
        await server.app.sendNotificationEmail(notification)
        sentNotificationsCounter.inc()
      } catch (error) {
        // Move on and try the next notification. If there's a problem with postmark, the postmarkError counter should spike
        continue
      }
      try {
        await setNotificationAsSent(notification.notificationId)
      } catch (error) {
        dbErrorHandler(error)
        // Do not attempt to send more emails if we have DB problems, to avoid sending duplicates if `sent` isn't updated in DB
        return
      }
    }
  }
}

export default notificationMailer
