exports.up = function(knex, Promise) {
  return knex.schema.createTable('subscriptions', function(table) {
    table
      .increments('subscription_id')
      .unsigned()
      .primary()

    table
      .integer('user_id')
      .unsigned()
      .index()
      .notNullable()
    table
      .foreign('user_id')
      .references('user_id')
      .inTable('users')

    table.timestamps(true, true) // default to now
    table.string('event_hash').notNullable()
    table.string('contract_address').notNullable()
    table.bigInteger('from_block').notNullable()
    table.bigInteger('processed_block')
    table.timestamp('last_poll')
    table.jsonb('contract_abi')
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('subscriptions')
}
