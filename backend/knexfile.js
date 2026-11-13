const path = require('path');
const { types } = require('pg');
const config = require('./src/config');

// Return DATE columns as 'YYYY-MM-DD' strings instead of JS Dates,
// so dates never shift with the server's timezone.
types.setTypeParser(1082, (value) => value);

module.exports = {
  client: 'pg',
  connection: config.db,
  pool: { min: 0, max: 10 },
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    tableName: 'knex_migrations',
  },
};
