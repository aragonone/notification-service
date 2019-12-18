import Joi from '@hapi/joi'
import Boom from '@hapi/boom'

const court = {
  name: 'ns/court',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['ns/web3', 'ns/database', 'ns/mail'])

    server.route(routes)
  },
}

export default court

const routes = [
  {
    method: 'POST',
    path: '/create',
    handler: createHandler,
    options: {
      tags: ['api'],
      auth: false,
      validate: {
        failAction: (request, h, err) => {
          // show validation errors to user https://github.com/hapijs/hapi/issues/3706
          throw err
        },
        payload: {
          network: Joi.string().required(),
          address: Joi.string().required(),
          email: Joi.string()
            .email()
            .required(),
        },
      },
    },
  },
]

/**
 * Registration handler
 */
async function createHandler(request, h) {
  const { db } = request.server.app
  const { email, address, network } = request.payload

  try {
    await db('court_users')
      .insert({ network, email, address })
      .returning('user_id')
      .then(([id]) => id)

    return h.response().code(200)
  } catch (error) {
    return Boom.badImplementation(error.message)
  }
}
