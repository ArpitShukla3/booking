const { describe, it, after, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, asTraveller } = require('../helpers/http');
const { db, truncate, closeDb } = require('../helpers/db');

// The worked example needs G-01 with Sarah AND Priya, so set the members and put them back afterwards.
let originalG01;
const setMembers = (ids) => db('groups').where({ group_id: 'G-01' }).update({ member_ids: ids });
const reset = async () => { await truncate('saved_hotel_options', 'group_bookings'); await setMembers(['T-001', 'T-002']); };
const TWIN = 'RM-KYO-001-A';

describe('Common Group Page API (M6)', () => {
  before(async () => { originalG01 = (await db('groups').where({ group_id: 'G-01' }).first()).member_ids; });
  beforeEach(reset);
  after(async () => { await truncate('saved_hotel_options', 'group_bookings'); await setMembers(originalG01); await closeDb(); });

  it('G-01 + Priya: Gion Corner Twin = 1 room × 5 nights × ₹4,760 = ₹23,800, ₹11,900 each', async () => {
    const res = await asTraveller('T-002').get('/api/groups/G-01/hotels');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.nights, 5);
    assert.equal(res.body.members_count, 2);
    assert.ok(res.body.hotels.length > 0);
    assert.ok(res.body.hotels.every((h) => h.city === 'Kyoto'));
    const gion = res.body.hotels.find((h) => h.hotel_id === 'HTL-KYO-001');
    const twin = gion.options.find((o) => o.room_id === TWIN);
    assert.deepEqual(
      { rooms: twin.rooms_needed, nights: twin.nights, total: twin.total_inr, each: twin.per_member_inr, available: twin.available },
      { rooms: 1, nights: 5, total: 23800, each: 11900, available: true },
    );
  });

  it('an option where any night is short is not available (checked against the DB)', async () => {
    const res = await asTraveller('T-001').get('/api/groups/G-01/hotels');
    const options = res.body.hotels.flatMap((h) => h.options);
    for (const o of options) {
      const { min } = await db('availability').min('rooms_left as min')
        .where('room_id', o.room_id).andWhere('date', '>=', '2027-04-10').andWhere('date', '<', '2027-04-15').first();
      assert.equal(o.available, min !== null && min >= o.rooms_needed, `${o.room_id}: min ${min}, needs ${o.rooms_needed}`);
    }
    assert.ok(options.some((o) => !o.available), 'the data has at least one unavailable option for these dates');
  });

  it('401 without X-Traveller-Id, 403 for a non-member, 404 for an unknown group', async () => {
    assert.equal((await api().get('/api/groups/G-01/hotels')).status, 401);
    const outsider = await asTraveller('T-009').get('/api/groups/G-01/hotels');
    assert.equal(outsider.status, 403);
    assert.match(outsider.body.error.message, /members/i);
    assert.equal((await asTraveller('T-009').get('/api/groups/G-01/saved-options')).status, 403);
    assert.equal((await asTraveller('T-009').post('/api/groups/G-01/booking').send({ room_id: TWIN })).status, 403);
    assert.equal((await asTraveller('T-001').get('/api/groups/G-404/hotels')).status, 404);
  });

  it('save → shortlist shows who saved it and the alignment; duplicates 409; remove own', async () => {
    const first = await asTraveller('T-001').post('/api/groups/G-01/saved-options').send({ room_id: TWIN });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const second = await asTraveller('T-002').post('/api/groups/G-01/saved-options').send({ room_id: TWIN });
    assert.equal(second.status, 201);
    assert.equal((await asTraveller('T-002').post('/api/groups/G-01/saved-options').send({ room_id: TWIN })).status, 409);

    const list = await asTraveller('T-002').get('/api/groups/G-01/saved-options');
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].alignment, 2);
    assert.deepEqual(list.body[0].saved_by.map((s) => s.traveller_id).sort(), ['T-001', 'T-002']);
    assert.equal(list.body[0].per_member_inr, 11900);
    assert.equal(list.body[0].hotel.name, 'Gion Corner Hotel');

    const removed = await asTraveller('T-002').delete(`/api/groups/G-01/saved-options/${TWIN}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body[0].alignment, 1);
    assert.equal((await asTraveller('T-002').delete(`/api/groups/G-01/saved-options/${TWIN}`)).status, 404);
  });

  it('400 with fields when room_id is missing', async () => {
    const res = await asTraveller('T-001').post('/api/groups/G-01/saved-options').send({});
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.room_id);
  });

  it('book once → locked; a second booking and further saves are refused (409); persisted', async () => {
    assert.deepEqual((await asTraveller('T-001').get('/api/groups/G-01/booking')).body, { booking: null });

    const booked = await asTraveller('T-002').post('/api/groups/G-01/booking').send({ room_id: TWIN });
    assert.equal(booked.status, 201, JSON.stringify(booked.body));
    assert.match(booked.body.booking_id, /^BK-\d{4,}$/);
    assert.equal(booked.body.total_inr, 23800);
    assert.equal(booked.body.per_member_inr, 11900);
    assert.equal(booked.body.members_count, 2);
    assert.equal(booked.body.booked_by.name, 'Priya Shah');
    assert.equal(booked.body.hotel.name, 'Gion Corner Hotel');

    const again = await asTraveller('T-001').post('/api/groups/G-01/booking').send({ room_id: 'RM-KYO-001-B' });
    assert.equal(again.status, 409);
    assert.equal((await asTraveller('T-001').post('/api/groups/G-01/saved-options').send({ room_id: TWIN })).status, 409);

    const { n } = await db('group_bookings').where({ group_id: 'G-01' }).count('* as n').first();
    assert.equal(Number(n), 1);
    const read = await asTraveller('T-001').get('/api/groups/G-01/booking');
    assert.equal(read.body.booking.booking_id, booked.body.booking_id);
  });

  it('booking an unavailable option is refused (409)', async () => {
    const res = await asTraveller('T-001').get('/api/groups/G-01/hotels');
    const unavailable = res.body.hotels.flatMap((h) => h.options).find((o) => !o.available);
    const booked = await asTraveller('T-001').post('/api/groups/G-01/booking').send({ room_id: unavailable.room_id });
    assert.equal(booked.status, 409);
  });
});
