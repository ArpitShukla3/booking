// DB utilities for INTEGRATION tests only (test database, see tests/setup/env.js).
const db = require('../../src/helpers/postgres/client');

/**
 * Empties tables that the APP writes to (join_requests, searches, ...) so each test
 * starts clean. Never pass data-pack tables (travellers, groups, hotels, ...):
 * their seeded rows are expected by other tests.
 * App-created rows in seeded tables (e.g. new travellers T-1001+) are removed by
 * the feature's own cleanup (delete where id >= ...).
 */
async function truncate(...tables) {
  if (tables.length) {
    await db.raw(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
}

/** Call in `after()` of every integration test file, or node:test keeps running. */
function closeDb() {
  return db.destroy();
}

module.exports = { db, truncate, closeDb };
