exports.up = function(knex, Promise) {
  return knex.schema.createTable('users', function(table) {
    table
      .increments('user_id')
      .unsigned()
      .primary()

    table.timestamps(true, true) // default to now
    table
      .string('email')
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
