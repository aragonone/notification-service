'use strict'

import Hapi from '@hapi/hapi'
import Good from '@hapi/good'
import hapiAuthJWT from 'hapi-auth-jwt2'
import routes from './routes'
import { validateMagiclink, validateAPIToken } from './service/auth'
import { runDBMigrations } from './service/database'
import { AUTH_SCOPES } from './constants'
import notificationScanner from './plugins/notificationScanner'
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
  await server.register({
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
  })

  await server.register(hapiAuthJWT)

  const jwtAuthOptions = {
    key: process.env.JWT_KEY,
    verifyOptions: { algorithms: ['HS256'] },
  }
  // short lived token in the magiclink sent by email
  server.auth.strategy(AUTH_SCOPES.MAGICLINK, 'jwt', {
    ...jwtAuthOptions,
    validate: validateMagiclink,
  })

  // long lived token pesisted in the user browser
  server.auth.strategy(AUTH_SCOPES.API, 'jwt', {
    ...jwtAuthOptions,
    validate: validateAPIToken,
  })

  // Require by default API token unless otherwise configured
  server.auth.default(AUTH_SCOPES.API)

  // Plugin for prometheus metrics
  await server.register(createPrometheusPlugin())

  await runDBMigrations()

  // Apply all http routes
  server.route(routes)

  await server.register(notificationScanner)

  await server.start()
  signalIsUp()
  console.log('Server running on %s', server.info.uri)

  await createMetricsServer({ port: process.env.METRICS_PORT })
  console.log(`@promster/server started on port ${process.env.METRICS_PORT}.`)
}

process.on('unhandledRejection', err => {
  console.log(err)
  // eslint-disable-next-line no-process-exit
  process.exit(1)
})

init()

export default server
