exports.up = function(knex, Promise) {
  return knex.schema.createTable('tokens', function(table) {
    table
      .increments('token_id')
      .unsigned()
      .primary()

    table.timestamp('created_at').defaultTo(knex.fn.now())

    table
      .integer('user_id')
      .unsigned()
      .index()
      .notNullable()
    table
      .foreign('user_id')
      .references('user_id')
      .inTable('users')
      .onDelete('CASCADE')

    // These correlate to AUTH_SCOPES in constants
    table.enu('token_scope', ['MAGICLINK', 'API']).defaultTo('MAGICLINK')

    table
      .boolean('valid')
      .notNullable()
      .defaultTo(true)
  })
}

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('tokens')
}
