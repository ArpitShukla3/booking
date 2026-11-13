// SQL for group_photos (X4). The files themselves are handled by helpers/storage/photos.helper.js.
const db = require('./client');

const COLUMNS = ['p.photo_id', 'p.group_id', 'p.uploader_id', 'p.object_key', 'p.mime_type', 'p.size_bytes',
  'p.width', 'p.height', 'p.caption', 'p.created_at', 't.name as uploader_name'];

const base = (trx) => trx({ p: 'group_photos' }).join({ t: 'travellers' }, 't.traveller_id', 'p.uploader_id').select(COLUMNS);

/** Reserves the next photo ID (P-1001…) so the storage key can be built before the row exists. */
async function nextPhotoId(trx = db) {
  const { rows } = await trx.raw("SELECT 'P-' || nextval('group_photo_id_seq')::text AS id");
  return rows[0].id;
}

/** Newest first. */
function listByGroup(groupId, trx = db) {
  return base(trx).where('p.group_id', groupId).orderBy([{ column: 'p.created_at', order: 'desc' }, { column: 'p.photo_id', order: 'desc' }]);
}

function findInGroup(groupId, photoId, trx = db) {
  return base(trx).where({ 'p.group_id': groupId, 'p.photo_id': photoId }).first();
}

async function countByGroup(groupId, trx = db) {
  const row = await trx('group_photos').where({ group_id: groupId }).count('* as n').first();
  return Number(row.n);
}

async function insertMany(rows, trx = db) {
  if (!rows.length) return;
  await trx('group_photos').insert(rows);
}

/** Number of rows removed (0 or 1). */
function remove(photoId, trx = db) {
  return trx('group_photos').where({ photo_id: photoId }).del();
}

module.exports = { nextPhotoId, listByGroup, findInGroup, countByGroup, insertMany, remove };
