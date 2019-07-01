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

    table
      .integer('eventsource_id')
      .unsigned()
      .index()
      .notNullable()
    table
      .foreign('eventsource_id')
      .references('eventsource_id')
      .inTable('eventsources')

    table.timestamp('created_at').defaultTo(knex.fn.now())
    // The head block when the subscription was created
    table.bigInteger('join_block').notNullable()

    // Ensure subscriptions are unique per user per contract per event
    table.unique(['user_id', 'subscription_id', 'eventsource_id'])
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('subscriptions')
}
