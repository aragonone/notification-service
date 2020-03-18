exports.up = function(knex, Promise) {
  return knex.schema.createTable('addresses', function(table) {
    table
      .increments('address_id')
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

    table
      .string('address')
      .unique()
      .notNullable()
      .index()
  })
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('addresses')
};
