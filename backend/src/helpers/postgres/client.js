// The single Knex (Postgres) instance for the app.
// Only files inside src/helpers/postgres/ may import this.
const knex = require('knex');
const knexConfig = require('../../../knexfile');

module.exports = knex(knexConfig);
