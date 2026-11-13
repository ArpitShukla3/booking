// Creates the test database if it is missing and runs all migrations on it
// (schema + data-pack seed). Runs automatically before `npm run test:integration`.
process.env.NODE_ENV = 'test';

const { Client } = require('pg');
const knex = require('knex');
const config = require('../../src/config');
const knexConfig = require('../../knexfile');

async function ensureDatabase() {
  const { database, ...conn } = config.db;
  const admin = new Client({ ...conn, database: 'postgres' });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
      console.log(`[test-db] created database ${database}`);
    }
  } finally {
    await admin.end();
  }
}

async function main() {
  await ensureDatabase();
  const db = knex(knexConfig);
  try {
    const [batch, ran] = await db.migrate.latest();
    console.log(`[test-db] ${config.db.database}: ${ran.length ? `batch ${batch}, ran ${ran.length} migration(s)` : 'already up to date'}`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error('[test-db] setup failed. Is Postgres running? (npm run db:up)\n', err.message || err);
  process.exit(1);
});
