import knex from 'knex'

// A plugin to configure the two jwt auth strategies
const auth = {
  name: 'ns/database',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['ns/metrics'])

    const db = knex({
      client: 'pg',
      connection: process.env.PG_CONNECTION_STRING,
      debug: process.env.DEBUG_KNEX.toLowerCase() === 'true',
    })

    await db.migrate.latest()

    server.app.db = db
  },
}

export default auth
