'use strict'

require('dotenv').config()
const Hapi = require('@hapi/hapi')
const routes = require('./lib/routes')

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT,
    host: process.env.HOST,
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
