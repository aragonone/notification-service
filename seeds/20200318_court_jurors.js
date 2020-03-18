exports.seed = function(knex, Promise) {
  // TODO: get filename from param
  /*
  [
    {
      user: {
        email: 'juror1@aragon.one'
      },
      address: {
        address: '0xcafe1a77e...'
      }
    },
    ...
  ]
   */
  const courtJurors = require('jurors')
  const users = []
  for (const juror of courtJurors) {
    juror.user.validated = true
    users.push(juror.user)
  }

  // Inserts users
  return knex('users').insert(users)
    .then(function() {
      return knex('users').select('user_id', 'email')
        .then(function(rows) {
          const addresses = []
          for (const juror of courtJurors) {
            juror.address.user_id = rows.find(row => row.email = juror.user.email).user_id
            addresses.push(juror.address)
          }

          // Inserts addresses
          return knex('addresses').insert(addresses)
        })
    })
}
