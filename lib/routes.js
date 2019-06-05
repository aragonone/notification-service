'use strict'

import Joi from '@hapi/joi'
import { sendConfirmationEmail } from './mailer'
import { TOKEN_EXPIRATION_PERIOD } from './constants'
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
      // TODO: save to DB and add userID to token

      const userToken = jwt.sign({ email }, process.env.JWT_KEY, {
        algorithm: 'HS256',
        expiresIn: TOKEN_EXPIRATION_PERIOD,
      })

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
    path: '/account',
    handler: (request, h) => {
      // Valid decoded token in `request.auth.credentials`
      const { email } = request.auth.credentials
      return `Hello ${email}`
    },
    options: {
      auth: 'jwt',
    },
  },
]

export default routes
