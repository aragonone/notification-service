'use strict'

import { ARAGON_FROM_ADDRESS, EMAIL_ALIASES } from '../constants'
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

const sendMagicLink = server => async ({ email, dao, network, token }) => {
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  const actionUrl = new URL(
    `https://${network}.aragon.org/#/${dao}/?preferences=/notifications/verify/${token}`
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

  const emailOptions = {
    From: ARAGON_FROM_ADDRESS,
    To: email,
    Subject: `${eventName} on ${appName} from Aragon Notifications Service`,
    HtmlBody: `
    The following event happened on ${network} at block: ${block}: <br />
    ${eventName} at ${blockTime}<br />
    App contract address: ${contractAddress}<br />
    Transaction: <a href="${etherscanUrl}">${transactionHash}</a>
    <br />
    Event values:
    <pre>
    ${JSON.stringify(returnValues, null, 2)}
    </pre>
    `,
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
