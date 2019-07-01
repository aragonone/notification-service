import account from './account'

const routes = [
  {
    // default endpoint
    method: 'GET',
    path: '/',
    handler: (request, h) => h.response({ up: true }).code(200),
    options: { auth: false },
  },
  {
    // health endpoint for k8s
    method: 'GET',
    path: '/healthz',
    handler: (request, h) => h.response().code(200),
    options: { auth: false },
  },
  ...account,
]

export default routes
