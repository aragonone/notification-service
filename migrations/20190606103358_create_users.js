exports.up = function(knex, Promise) {
  return knex.schema.createTable('users', function(table) {
    table
      .increments('user_id')
      .unsigned()
      .primary()

    table.timestamp('created_at').defaultTo(knex.fn.now())
    table
      .string('email')
      .unique()
      .notNullable()
      .index()

    table
      .boolean('verified')
      .notNullable()
      .defaultTo(false)
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('users')
}
