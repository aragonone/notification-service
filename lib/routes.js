'use strict'

import Joi from '@hapi/joi'
import { sendConfirmationEmail } from './mailer'
import { TOKEN_EXPIRATION_HOURS } from './constants'
import jwt from 'jsonwebtoken'

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
      const expiration = new Date()
      expiration.setHours(expiration.getHours() + TOKEN_EXPIRATION_HOURS)

      const userToken = jwt.sign({ email, expiration }, process.env.JWT_KEY)

      sendConfirmationEmail(email, userToken)

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
