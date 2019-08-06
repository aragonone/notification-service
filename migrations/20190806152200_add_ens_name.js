exports.up = function(knex) {
  return knex.schema.table('eventsources', function(table) {
    table.string('ens_name')
  })
}

exports.down = function(knex) {
  return knex.schema.table('eventsources', function(table) {
    table.dropColumn('ens_name')
  })
}
