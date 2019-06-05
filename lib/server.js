'use strict'

import Hapi from '@hapi/hapi'
import hapiAuthJWT from 'hapi-auth-jwt2'
import routes from './routes'
import { validate } from './auth'
import {
  createPlugin as createPrometheusPlugin,
  signalIsUp,
} from '@promster/hapi'
import { createServer as createMetricsServer } from '@promster/server'

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT,
    host: process.env.HOST,
  })

  await server.register(hapiAuthJWT)
  server.auth.strategy('jwt', 'jwt', {
    key: process.env.JWT_KEY,
    validate,
  })

  await server.register(createPrometheusPlugin())

  server.route(routes)

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
