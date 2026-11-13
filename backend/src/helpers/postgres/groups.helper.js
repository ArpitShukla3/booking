// SQL for the `groups` table (Track B). Dates are returned as YYYY-MM-DD strings, never JS Date.
const db = require('./client');

const GROUP_COLUMNS = [
  'g.group_id', 'g.name', 'g.owner_id', 'g.member_ids', 'g.city', 'd.country_name',
  db.raw("to_char(g.check_in, 'YYYY-MM-DD') as check_in"),
  db.raw("to_char(g.check_out, 'YYYY-MM-DD') as check_out"),
  'g.max_size', 'g.budget_inr', 'g.itinerary', 'g.created_at',
  't.name as owner_name', 't.gender as owner_gender',
];

function baseQuery(trx) {
  return trx({ g: 'groups' })
    .join({ d: 'destinations' }, 'd.city', 'g.city')
    .join({ t: 'travellers' }, 't.traveller_id', 'g.owner_id')
    .select(GROUP_COLUMNS);
}

/** Inserts a group; group_id comes from next_group_id(). Returns the new id. */
async function insert(row, trx = db) {
  const [created] = await trx('groups').insert(row).returning('group_id');
  return created.group_id;
}

function findById(groupId, trx = db) {
  return baseQuery(trx).where('g.group_id', groupId).first();
}

/** Groups the traveller owns or is a member of, soonest trip first. */
function listForTraveller(travellerId, trx = db) {
  return baseQuery(trx)
    .where('g.owner_id', travellerId)
    .orWhereRaw('? = ANY(g.member_ids)', [travellerId])
    .orderBy([{ column: 'g.check_in' }, { column: 'g.created_at', order: 'desc' }]);
}

/**
 * Matching candidates (M4): every group in one city, with the owner's profile fields
 * the 6 rules need. Matching itself happens in services/matching.service.ts.
 */
function listCandidatesByCity(city, trx = db) {
  return baseQuery(trx)
    .select('t.interests as owner_interests', 't.gender_preference as owner_gender_preference')
    .where('g.city', city);
}

module.exports = { insert, findById, listForTraveller, listCandidatesByCity };
