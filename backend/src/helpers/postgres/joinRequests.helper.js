// SQL for the `join_requests` table (Track B, M5). Dates come back as YYYY-MM-DD strings.
const db = require('./client');

const COLUMNS = ['request_id', 'group_id', 'seeker_id', 'status', 'created_at', 'decided_at'];
const SEEKER_COLUMNS = ['t.name', 't.age', 't.gender', 't.home_city', 't.home_airport', 't.interests', 't.gender_preference'];
const GROUP_COLUMNS = [
  'g.name as group_name', 'g.city as group_city', 'd.country_name as group_country_name',
  db.raw("to_char(g.check_in, 'YYYY-MM-DD') as group_check_in"),
  db.raw("to_char(g.check_out, 'YYYY-MM-DD') as group_check_out"),
  'g.max_size as group_max_size', 'g.member_ids as group_member_ids', 'g.owner_id as group_owner_id',
  'o.name as group_owner_name',
];

/** Pending first, newest first inside each status. */
const ORDER = [{ column: db.raw("(r.status = 'PENDING')"), order: 'desc' }, { column: 'r.created_at', order: 'desc' }];

const withSeeker = (q) => q.join({ t: 'travellers' }, 't.traveller_id', 'r.seeker_id').select(SEEKER_COLUMNS);
const withGroup = (q) => q
  .join({ g: 'groups' }, 'g.group_id', 'r.group_id')
  .join({ d: 'destinations' }, 'd.city', 'g.city')
  .join({ o: 'travellers' }, 'o.traveller_id', 'g.owner_id')
  .select(GROUP_COLUMNS);
const base = (trx) => trx({ r: 'join_requests' }).select(COLUMNS.map((c) => `r.${c}`));

/** Inserts a PENDING request. Returns the row, or undefined if (group, seeker) already exists. */
async function insert(row, trx = db) {
  const [created] = await trx('join_requests').insert(row).onConflict(['group_id', 'seeker_id']).ignore().returning(COLUMNS);
  return created;
}

function findById(requestId, trx = db) {
  return trx('join_requests').select(COLUMNS).where({ request_id: requestId }).first();
}

/** Same as findById, but locks the row until the transaction ends. */
function findByIdForUpdate(requestId, trx) {
  return trx('join_requests').select(COLUMNS).where({ request_id: requestId }).forUpdate().first();
}

function findByGroupAndSeeker(groupId, seekerId, trx = db) {
  return trx('join_requests').select(COLUMNS).where({ group_id: groupId, seeker_id: seekerId }).first();
}

/** Every request for one group, with the seeker's profile fields. */
function listByGroup(groupId, trx = db) {
  return withSeeker(base(trx)).where('r.group_id', groupId).orderBy(ORDER);
}

/** The seeker's own requests, with the group summary. */
function listBySeeker(seekerId, trx = db) {
  return withGroup(base(trx)).where('r.seeker_id', seekerId).orderBy(ORDER);
}

/** PENDING requests on every group the owner runs, with seeker + group fields. */
function listPendingForOwner(ownerId, trx = db) {
  return withGroup(withSeeker(base(trx)))
    .where({ 'g.owner_id': ownerId, 'r.status': 'PENDING' })
    .orderBy('r.created_at', 'desc');
}

/** { group_id: pendingCount } for the given groups (groups with none are left out). */
async function countPendingByGroups(groupIds, trx = db) {
  if (!groupIds.length) return {};
  const rows = await trx('join_requests').select('group_id').count('* as n')
    .whereIn('group_id', groupIds).andWhere({ status: 'PENDING' }).groupBy('group_id');
  return Object.fromEntries(rows.map((r) => [r.group_id, Number(r.n)]));
}

/** Sets APPROVED / REJECTED and decided_at. Returns the updated row. */
async function updateStatus(requestId, status, trx = db) {
  const [row] = await trx('join_requests').where({ request_id: requestId })
    .update({ status, decided_at: trx.fn.now() }).returning(COLUMNS);
  return row;
}

/**
 * Marks (group, traveller) as REMOVED. Seeded members have no request row, so one is created.
 * Returns the row.
 */
async function markRemoved(groupId, travellerId, trx = db) {
  const [row] = await trx('join_requests')
    .insert({ group_id: groupId, seeker_id: travellerId, status: 'REMOVED', decided_at: trx.fn.now() })
    .onConflict(['group_id', 'seeker_id'])
    .merge(['status', 'decided_at'])
    .returning(COLUMNS);
  return row;
}

module.exports = {
  insert, findById, findByIdForUpdate, findByGroupAndSeeker, listByGroup, listBySeeker,
  listPendingForOwner, countPendingByGroups, updateStatus, markRemoved,
};
