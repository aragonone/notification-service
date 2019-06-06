import knex from 'knex'

export default knex({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
  debug: process.env.node_env !== 'production',
})
