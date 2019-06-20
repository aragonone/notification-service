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
    table.string('app_name').notNullable()
    table.string('network').notNullable()
    table.string('event_name').notNullable()
    // Use event name instead of hash. With abi, the event hash can be derived
    // table.string('event_hash')
    table.string('contract_address').notNullable()
    table.bigInteger('from_block').notNullable()
    table.timestamp('last_poll')
    table.jsonb('abi')

    // Ensure subscriptions are unique per user per contract per event
    table.unique(['user_id', 'contract_address', 'event_name'])
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('subscriptions')
}
