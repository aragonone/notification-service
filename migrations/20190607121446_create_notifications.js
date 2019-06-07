exports.up = function(knex, Promise) {
  return knex.schema.createTable('notifications', function(table) {
    table
      .increments('notification_id')
      .unsigned()
      .primary()

    table
      .integer('subscription_id')
      .unsigned()
      .index()
      .notNullable()
    table
      .foreign('subscription_id')
      .references('subscription_id')
      .inTable('subscriptions')

    table.timestamps(true, true) // default to now

    table.text('message')

    table.string('transaction_hash').notNullable()
    table.bigInteger('block').notNullable()
    table
      .boolean('sent')
      .notNullable()
      .defaultTo(false)
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('notifications')
}
