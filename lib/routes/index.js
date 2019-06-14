import account from './account'
import subscription from './subscription'

const routes = [
  {
    // health endpoint for k8s
    method: 'GET',
    path: '/healthz',
    handler: (request, h) => h.response().code(200),
    options: { auth: false },
  },
  ...account,
  ...subscription,
]

export default routes
