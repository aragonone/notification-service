import knex from 'knex'

const db = knex({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
  debug: process.env.DEBUG_KNEX.toLowerCase() === 'true',
})

/**
 * Run db migrations
 *
 * @returns {Promise} resolves when all migrations have been run
 */
export async function runDBMigrations() {
  return db.migrate.latest()
}

export default db
