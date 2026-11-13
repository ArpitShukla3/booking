const db = require('./client');

/** Returns true when Postgres answers a trivial query. Throws if it is unreachable. */
async function ping(trx = db) {
  await trx.raw('select 1');
  return true;
}

/** Closes the connection pool (used on shutdown). */
function close() {
  return db.destroy();
}

module.exports = { ping, close };
