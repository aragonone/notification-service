'use strict'

const Joi = require('@hapi/joi')

const routes = [
  {
    method: 'GET',
    path: '/',
    handler: (request, h) => {
      return 'hello!'
    },
    options: {
      auth: false,
    },
  },
  {
    method: 'POST',
    path: '/register',
    handler: (request, h) => {
      const { email } = request.payload

      return `register ${email}`
    },
    options: {
      auth: false,
      validate: {
        payload: {
          email: Joi.string()
            .email()
            .required(),
        },
      },
    },
  },
  {
    method: 'GET',
    path: '/acccount',
    handler: (request, h) => {
      return 'Hello World!'
    },
    options: {
      auth: false,
    },
  },
]

module.exports = routes
