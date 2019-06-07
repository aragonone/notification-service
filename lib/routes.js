'use strict'

import Boom from '@hapi/boom'
import Joi from '@hapi/joi'
import jwt from 'jsonwebtoken'
import db from './service/database'
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
    path: '/verify',
    handler: async (request, h) => {
      const { email } = request.auth.credentials
      // TODO: update db set verified
      try {
        await db('users')
          .where({ email })
          .update({ verified: true })
      } catch (error) {
        throw Boom.badImplementation(error.message)
      }
      // Add more info to token and make
      const token = jwt.sign({ email }, process.env.JWT_KEY, {
        algorithm: 'HS256',
        expiresIn: '30d',
      })
      return h.response(200).header('Authorization', token)
    },
    options: {
      auth: 'magicLink',
    },
  },
  {
    method: 'GET',
    path: '/subscriptions',
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
