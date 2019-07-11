'use strict'

import { ARAGON_FROM_ADDRESS, EMAIL_ALIASES } from '../constants'
const postmark = require('postmark')

/**
 * Plugin to define global metrics
 */
const mailPlugin = {
  name: 'mail',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['@promster/hapi', 'metrics'])

    if (!process.env.CLIENT_URL) {
      throw new Error('CLIENT_URL env var is required')
    }
    if (!process.env.POSTMARK_SERVER_API_TOKEN) {
      throw new Error('POSTMARK_SERVER_API_TOKEN env var is required')
    }

    const postmarkClient = new postmark.ServerClient(
      process.env.POSTMARK_SERVER_API_TOKEN
    )

    Object.assign(server.app, {
      postmarkClient: postmarkClient,
      sendMagicLink: sendMagicLink(server),
      sendNotificationEmail: sendNotificationEmail(server),
    })

    Object.assign(server.app.metrics, {
      postmarkErrorCounter: new server.Prometheus.Counter({
        name: 'postmark_error_total',
        help: 'The number of postmark errors',
      }),
      postmarkSentCounter: new server.Prometheus.Counter({
        name: 'postmark_sent_total',
        help: 'The number of postmark mails sent',
      }),
    })
  },
}

export default mailPlugin

const sendMagicLink = server => async (email, dao, token) => {
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  // TODO: change CLIENT_URL to callbackURL (to support both rinkeby and mainnet)
  const actionUrl = new URL(
    `${process.env.CLIENT_URL}/#/${dao}?p=/notifications/verify/${token}`
  ).toString()

  const emailOptions = {
    From: ARAGON_FROM_ADDRESS,
    To: email,
    TemplateAlias: EMAIL_ALIASES.MAGICLINK,
    TemplateModel: { actionUrl },
  }

  if (process.env.NODE_ENV !== 'production') {
    server.log(['debug', 'mail'], emailOptions)
    return
  }
  try {
    await server.app.postmarkClient.sendEmailWithTemplate(emailOptions)
    server.app.metrics.postmarkSentCounter.inc()
  } catch (e) {
    server.app.metrics.postmarkErrorCounter.inc()
    server.log(['mail', 'error'], e)
    throw e
  }
}

const sendNotificationEmail = server => async ({
  email,
  appName,
  eventName,
  contractAddress,
  block,
  returnValues,
  transactionHash,
  network,
} = {}) => {
  const emailOptions = {
    From: ARAGON_FROM_ADDRESS,
    To: email,
    Subject: `Event: ${eventName} on ${appName} from Aragon Notifications Service`,
    HtmlBody: `The following events happened:`,
  }

  if (process.env.NODE_ENV !== 'production') {
    server.log(['debug', 'mail'], emailOptions)
    return
  }

  try {
    await server.app.postmarkClient.sendEmail(emailOptions)
    server.app.metrics.postmarkSentCounter.inc()
  } catch (e) {
    server.app.metrics.postmarkErrorCounter.inc()
    server.log(['mail', 'error'], e)
    throw e
  }
}
