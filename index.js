// eslint-disable-next-line no-global-assign
require = require('esm')(module) // Use esm until node ESM support is stable

require('dotenv').config() // Load env vars from .env file

module.exports = require('./server.js')
