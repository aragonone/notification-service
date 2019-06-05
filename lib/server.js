'use strict'

import Hapi from '@hapi/hapi'
import hapiAuthJWT from 'hapi-auth-jwt2'
import routes from './routes'
import { validate } from './auth'

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

  server.route(routes)

  await server.start()
  console.log('Server running on %s', server.info.uri)
}

process.on('unhandledRejection', err => {
  console.log(err)
  // eslint-disable-next-line no-process-exit
  process.exit(1)
})

init()
