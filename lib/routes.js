'use strict'

import { routes as accountRoutes } from './handlers/account'
import { AUTH_SCOPES } from './constants'

const routes = [
  {
    method: 'GET',
    path: '/healthz',
    handler: (request, h) => h.response().code(200),
  },
  ...accountRoutes,
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
      auth: AUTH_SCOPES.API,
    },
  },
]

export default routes
