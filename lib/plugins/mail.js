'use strict'

import {
  ALLOWED_HOSTNAMES,
  ARAGON_FROM_ADDRESS,
  EMAIL_ALIASES,
} from '../constants'
const postmark = require('postmark')

/**
 * Plugin to define global metrics
 */
const mailPlugin = {
  name: 'ns/mail',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['ns/metrics'])

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

function sendMagicLink(server) {
  return async ({ refererHost, email, dao, network, token }) => {
    let actionUrl

    if (refererHost && ALLOWED_HOSTNAMES.includes(refererHost)) {
      // Route user back to the same origin
      actionUrl = new URL(
        `https://${refererHost}/#/${dao}/?preferences=/notifications/verify/${token}`
      ).toString()
    } else {
      // eslint-disable-next-line node/no-unsupported-features/node-builtins
      actionUrl = new URL(
        `https://${network}.aragon.org/#/${dao}/?preferences=/notifications/verify/${token}`
      ).toString()
    }

    const emailOptions = {
      From: ARAGON_FROM_ADDRESS,
      To: email,
      TemplateAlias: EMAIL_ALIASES.MAGICLINK,
      TemplateModel: { actionUrl, token },
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
}

function sendNotificationEmail(server) {
  return async ({
    email,
    appName,
    ensName,
    eventName,
    blockTime,
    contractAddress,
    block,
    returnValues,
    transactionHash,
    network,
  } = {}) => {
    const etherscanUrl = `https://${
      network === 'mainnet' ? '' : 'rinkeby.'
    }etherscan.io/tx/${transactionHash}`

    const managementUrl = `https://${network}.aragon.org/#/${ensName}/?preferences=/notifications`

    const emailOptions = {
      From: ARAGON_FROM_ADDRESS,
      To: email,
      TemplateAlias: EMAIL_ALIASES.NOTIFICATION,
      TemplateModel: {
        appName,
        block,
        blockTime,
        contractAddress,
        eventName,
        eventValues: JSON.stringify(returnValues, null, 2),
        etherscanUrl,
        managementUrl,
        network,
        transactionHash,
      },
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
}
