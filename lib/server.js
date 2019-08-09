'use strict'

import Hapi from '@hapi/hapi'
import Good from '@hapi/good'
import Inert from '@hapi/inert'
import Vision from '@hapi/vision'
import HapiSwagger from 'hapi-swagger'
import hapiAuthJWT from 'hapi-auth-jwt2'
import routes from './routes'
import notificationScanner from './plugins/notificationScanner'
import notificationMailer from './plugins/notificationMailer'
import auth from './plugins/auth'
import database from './plugins/database'
import mail from './plugins/mail'
import metrics from './plugins/metrics'
import subscriptions from './plugins/subscriptions'
import account from './plugins/account'
import web3 from './plugins/web3'

import {
  createPlugin as createPrometheusPlugin,
  signalIsUp,
} from '@promster/hapi'
import { createServer as createMetricsServer } from '@promster/server'

const server = Hapi.server({
  port: process.env.PORT,
  host: process.env.HOST,
  routes: {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? ['*.aragon.org', '*.now.sh'] : ['*'],
      headers: ['authorization', 'Content-Type'], // allow the client to send these
      exposedHeaders: ['authorization'], // give cross origins access to response authorization header
      credentials: true, // Access-Control-Allow-Credentials - allow passing authorization header cross origin
    },
  },
})

const init = async () => {
  await server.register([
    {
      plugin: Good,
      options: {
        ops: {
          interval: 5000,
        },
        reporters: {
          console: [
            {
              module: '@hapi/good-squeeze',
              name: 'Squeeze',
              args: [
                {
                  log: '*',
                  response: { exclude: 'health' },
                  request: '*',
                },
              ],
            },
            {
              module: '@hapi/good-console',
            },
            'stdout',
          ],
        },
      },
    },
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: {
        info: {
          title: 'Notification Service API Documentation',
        },
      },
    },
    hapiAuthJWT, // add the jwt auth scheme
    createPrometheusPlugin(),
    metrics,
    auth, // add the auth strategies
    database,
    web3,
    mail,
    subscriptions,
    account,
    notificationScanner,
    notificationMailer,
  ])

  // Apply all http routes
  server.route(routes)

  await server.start()
  signalIsUp()
  server.log('server', `Server running on ${server.info.uri}`)

  await createMetricsServer({ port: process.env.METRICS_PORT })
  server.log(
    'server',
    `prometheus metrics server running on port ${process.env.METRICS_PORT}.`
  )
}

process.on('unhandledRejection', err => {
  console.log(err)
  // eslint-disable-next-line no-process-exit
  process.exit(1)
})

init()

export default server
