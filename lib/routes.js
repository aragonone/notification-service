'use strict'

import Joi from '@hapi/joi'
import { sendConfirmationEmail } from './mailer'

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
      sendConfirmationEmail(email, '')
      return h.response().code(200)
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

export default routes
