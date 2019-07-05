/**
 * Plugin to define global metrics
 */
const metricsPlugin = {
  name: 'metrics',
  version: '1.0.0',
  register: async function(server, options) {
    server.dependency(['@promster/hapi'])

    // Object for use by different plugins that want to set global metrics
    server.app.metrics = {
      web3ErrorCounter: new server.Prometheus.Counter({
        name: 'web3_error_total',
        help: 'The number of web3 eth errors',
      }),
      dbErrorCounter: new server.Prometheus.Counter({
        name: 'db_error_total',
        help: 'The number of database errors',
      }),
    }
  },
}

export default metricsPlugin
