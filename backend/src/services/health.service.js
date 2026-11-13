const healthHelper = require('../helpers/postgres/health.helper');

/** Reports API + database status. Never throws: a DB failure is part of the result. */
async function getStatus() {
  try {
    await healthHelper.ping();
    return { ok: true, status: 'ok', db: 'up' };
  } catch (err) {
    return { ok: false, status: 'error', db: 'down', message: err.message || err.code || 'Database unreachable' };
  }
}

module.exports = { getStatus };
