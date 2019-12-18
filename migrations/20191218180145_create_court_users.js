exports.up = function(knex, Promise) {
  return knex.schema.createTable('court_users', function(table) {
    table
      .increments('user_id')
      .unsigned()
      .primary()

    table.timestamp('created_at').defaultTo(knex.fn.now())

    table.string('address').notNullable()
    table.string('network').notNullable()
    table.string('email').notNullable()
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('court_users')
}
