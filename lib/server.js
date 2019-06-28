'use strict'

import Hapi from '@hapi/hapi'
import Good from '@hapi/good'
import hapiAuthJWT from 'hapi-auth-jwt2'
import routes from './routes'
import { runDBMigrations } from './service/database'
import notificationScanner from './plugins/notificationScanner'
import database from './plugins/database'
import auth from './plugins/auth'
import {
  createPlugin as createPrometheusPlugin,
  signalIsUp,
} from '@promster/hapi'
import { createServer as createMetricsServer } from '@promster/server'

const server = Hapi.server({
  port: process.env.PORT,
  host: process.env.HOST,
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
              args: [{ log: '*', response: '*', request: '*' }],
            },
            {
              module: '@hapi/good-console',
            },
            'stdout',
          ],
        },
      },
    },
    hapiAuthJWT, // add the jwt auth scheme
    createPrometheusPlugin(),
    auth, // add the auth strategies
    database,
  ])

  // Apply all http routes
  server.route(routes)

  await server.register(notificationScanner)

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
