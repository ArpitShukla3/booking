const fs = require('node:fs');
const path = require('node:path');
const db = require('./client');
const { dataDir } = require('../../config');
const PROFILE_COLUMNS = ['traveller_id', 'name', 'age', 'gender', 'home_city', 'home_airport', 'interests', 'gender_preference'];

function findById(travellerId, trx = db) { return trx('travellers').select(PROFILE_COLUMNS).where({ traveller_id: travellerId }).first(); }
async function insert(profile, trx = db) { const [row] = await trx('travellers').insert(profile).returning(PROFILE_COLUMNS); return row; }
async function findInterestIds(ids, trx = db) { if (!ids.length) return []; return (await trx('interests').whereIn('interest', ids).select('interest')).map(row => row.interest); }
function listInterests(trx = db) { return trx('interests').select('interest', 'label', 'category').orderBy('category').orderBy('label'); }

/** Idempotent maintenance entrypoint: inserts missing source records, never updates profiles. */
async function seedMissingTravellers(trx) {
  if (!trx) return db.transaction(seedMissingTravellers);
  await trx.raw('LOCK TABLE travellers IN SHARE ROW EXCLUSIVE MODE');
  const load = name => JSON.parse(fs.readFileSync(path.join(dataDir, 'data/problem-3', `${name}.json`), 'utf8'));
  await trx('interests').insert(load('interests')).onConflict('interest').ignore();
  await trx('travellers').insert(load('travellers')).onConflict('traveller_id').ignore();
  await trx.raw(`SELECT setval('traveller_id_seq', GREATEST(
    (SELECT last_value FROM traveller_id_seq),
    COALESCE((SELECT MAX(substring(traveller_id FROM '^T-([0-9]+)$')::bigint) FROM travellers), 24)
  ), true)`);
}
module.exports = { findById, insert, findInterestIds, listInterests, seedMissingTravellers };
