// SQL for M6 (Track B): hotel stays for a group's city/dates, the shortlist
// (`saved_hotel_options`) and the single booking (`group_bookings`).
// Reads `hotels`, `rooms`, `availability` (catalog, read-only). Pricing rules live in the services.
const db = require('./client');

const HOTEL_COLUMNS = [
  'h.hotel_id', 'h.name as hotel_name', 'h.area', 'h.city', 'h.stars', 'h.rating', 'h.lat', 'h.lng', 'h.image',
  'h.check_in_from', 'h.check_out_until', 'h.family_friendly',
];
const ROOM_COLUMNS = [
  'r.room_id', 'r.room_type', 'r.name as room_name', 'r.max_adults', 'r.max_children',
  'r.price_per_night_amount', 'r.refundable',
];

/**
 * Every room of every hotel in `city`, with how many of the stay's nights have an
 * availability row (`nights_with_data`) and the fewest rooms left on any of them
 * (`min_rooms_left`). Nights are check_in … the day before check_out.
 */
function stays(city, checkIn, checkOut, trx) {
  return trx({ r: 'rooms' })
    .join({ h: 'hotels' }, 'h.hotel_id', 'r.hotel_id')
    .leftJoin({ a: 'availability' }, function nights() {
      this.on('a.room_id', 'r.room_id')
        .andOn('a.date', '>=', trx.raw('?::date', [checkIn]))
        .andOn('a.date', '<', trx.raw('?::date', [checkOut]));
    })
    .where('h.city', city)
    .groupBy([...HOTEL_COLUMNS, ...ROOM_COLUMNS].map((c) => c.split(' as ')[0]))
    .select([...HOTEL_COLUMNS, ...ROOM_COLUMNS])
    .select(trx.raw('count(a.date)::int as nights_with_data'), trx.raw('min(a.rooms_left)::int as min_rooms_left'));
}

function listRoomStays(city, checkIn, checkOut, trx = db) {
  return stays(city, checkIn, checkOut, trx).orderBy([{ column: 'h.hotel_id' }, { column: 'r.room_id' }]);
}

/** One room of the city (undefined if it does not exist there). */
function findRoomStay(roomId, city, checkIn, checkOut, trx = db) {
  return stays(city, checkIn, checkOut, trx).where('r.room_id', roomId).first();
}

/** Shortlist rows of a group with the saver's name, oldest first. */
function listSaved(groupId, trx = db) {
  return trx({ s: 'saved_hotel_options' })
    .join({ t: 'travellers' }, 't.traveller_id', 's.saved_by')
    .where('s.group_id', groupId)
    .orderBy([{ column: 's.created_at' }, { column: 's.id' }])
    .select('s.room_id', 's.saved_by', 't.name as saver_name', 's.created_at');
}

/** Returns the new row, or undefined if this traveller already saved this room for the group. */
async function insertSaved(row, trx = db) {
  const [created] = await trx('saved_hotel_options').insert(row)
    .onConflict(['group_id', 'room_id', 'saved_by']).ignore().returning('*');
  return created;
}

/** Number of rows removed (0 or 1). */
function deleteSaved(groupId, roomId, savedBy, trx = db) {
  return trx('saved_hotel_options').where({ group_id: groupId, room_id: roomId, saved_by: savedBy }).del();
}

/** The group's booking with the booker's name, or undefined. */
function findBooking(groupId, trx = db) {
  return trx({ b: 'group_bookings' })
    .join({ t: 'travellers' }, 't.traveller_id', 'b.booked_by')
    .where('b.group_id', groupId)
    .select('b.*', 't.name as booker_name')
    .first();
}

/** Returns the new row, or undefined if the group already has a booking (unique group_id). */
async function insertBooking(row, trx = db) {
  const [created] = await trx('group_bookings').insert(row).onConflict('group_id').ignore().returning('*');
  return created;
}

/**
 * X2: hotel activity for many groups in two queries (no N+1).
 * Returns { [group_id]: { shortlisted: distinct saved rooms, booking: summary | null } } for groups
 * with any activity; groups without any are left out.
 */
async function hotelStatusByGroups(groupIds, trx = db) {
  if (!groupIds.length) return {};
  const [counts, bookings] = await Promise.all([
    trx('saved_hotel_options').select('group_id').countDistinct({ n: 'room_id' })
      .whereIn('group_id', groupIds).groupBy('group_id'),
    trx({ b: 'group_bookings' })
      .join({ r: 'rooms' }, 'r.room_id', 'b.room_id')
      .join({ h: 'hotels' }, 'h.hotel_id', 'r.hotel_id')
      .whereIn('b.group_id', groupIds)
      .select('b.group_id', 'b.booking_id', 'h.hotel_id', 'h.name as hotel_name', 'r.name as room_name',
        'b.rooms_count', 'b.nights', 'b.total_inr', 'b.per_member_inr', 'b.created_at as booked_at'),
  ]);
  const out = {};
  for (const c of counts) out[c.group_id] = { shortlisted: Number(c.n), booking: null };
  for (const { group_id, ...booking } of bookings) {
    out[group_id] = { shortlisted: out[group_id]?.shortlisted ?? 0, booking };
  }
  return out;
}

module.exports = { hotelStatusByGroups, listRoomStays, findRoomStay, listSaved, insertSaved, deleteSaved, findBooking, insertBooking };
