// SQL for the `searches` table (Track A, M3). Dates come back as YYYY-MM-DD strings.
const db = require('./client');

const COLUMNS = [
  's.search_id', 's.traveller_id', 's.home_city', 's.city', 'd.country_name',
  db.raw("to_char(s.check_in, 'YYYY-MM-DD') as check_in"),
  db.raw("to_char(s.check_out, 'YYYY-MM-DD') as check_out"),
  's.budget_inr', 's.interests', 's.gender', 's.gender_preference', 's.created_at',
];

const baseQuery = (trx) => trx({ s: 'searches' }).join({ d: 'destinations' }, 'd.city', 's.city').select(COLUMNS);

/** Inserts a search; search_id comes from the sequence default. Returns the new id. */
async function insert(row, trx = db) {
  const [created] = await trx('searches').insert(row).returning('search_id');
  return created.search_id;
}

function findById(searchId, trx = db) {
  return baseQuery(trx).where('s.search_id', searchId).first();
}

/** Most recent searches first. */
function listByTraveller(travellerId, limit = 10, trx = db) {
  return baseQuery(trx).where('s.traveller_id', travellerId).orderBy('s.created_at', 'desc').limit(limit);
}

module.exports = { insert, findById, listByTraveller };
