const fs = require('node:fs');
const path = require('node:path');
const { dataDir } = require('../src/config');

exports.up = async function up(knex) {
  await knex.raw('LOCK TABLE travellers IN SHARE ROW EXCLUSIVE MODE');
  const load = name => JSON.parse(fs.readFileSync(path.join(dataDir, 'data/problem-3', `${name}.json`), 'utf8'));
  await knex('interests').insert(load('interests')).onConflict('interest').ignore();
  await knex('travellers').insert(load('travellers')).onConflict('traveller_id').ignore();
  await knex.raw(`SELECT setval('traveller_id_seq', GREATEST(
    (SELECT last_value FROM traveller_id_seq),
    COALESCE((SELECT MAX(substring(traveller_id FROM '^T-([0-9]+)$')::bigint) FROM travellers), 24)
  ), true)`);
};

// Seed records may now be referenced by app-created groups. Preserve them on rollback.
exports.down = async function down() {};
