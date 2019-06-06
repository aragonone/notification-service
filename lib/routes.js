'use strict'

import Joi from '@hapi/joi'
import { loginHandler } from './handlers/account'

const routes = [
  {
    method: 'GET',
    path: '/healthz',
    handler: (request, h) => h.response().code(200),
  },
  {
    method: 'POST',
    path: '/login',
    handler: loginHandler,
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
    path: '/account',
    handler: (request, h) => {
      // Valid decoded token in `request.auth.credentials`
      const { email } = request.auth.credentials
      // TODO: update verify field in DB and generate a long lived access token
      return `Hello ${email}`
    },
    options: {
      auth: 'jwt',
    },
  },
]

export default routes
