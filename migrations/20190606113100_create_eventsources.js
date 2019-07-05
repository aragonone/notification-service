exports.up = function(knex, Promise) {
  return knex.schema.createTable('eventsources', function(table) {
    table
      .increments('eventsource_id')
      .unsigned()
      .primary()

    table.timestamp('created_at').defaultTo(knex.fn.now())
    table
      .boolean('enabled')
      .notNullable()
      .defaultTo(true)

    table.string('contract_address').notNullable()
    table.jsonb('abi')
    // Use event name instead of hash. With abi, the event hash can be derived
    table.string('event_name').notNullable()
    // The app name is not critical, but useful. The source of truth is the contract_address
    table.string('app_name').notNullable()
    table.string('network').notNullable()
    table.bigInteger('from_block').notNullable()
    table.timestamp('last_poll')

    table.unique(['contract_address', 'event_name', 'network'])
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('eventsources')
}
