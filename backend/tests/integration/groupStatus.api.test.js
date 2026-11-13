const { describe, it, after, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, asTraveller } = require('../helpers/http');
const { db, closeDb } = require('../helpers/db');

// X2: the live trip status on My groups. Uses its own app-created group (G-1001+), deleted afterwards
// (saved options and the booking cascade with it).
let groupId;
const TWIN = 'RM-KYO-001-A';
const mine = async (who) => (await asTraveller(who).get('/api/groups/mine')).body.find((g) => g.group_id === groupId);

describe('Live trip status (X2)', () => {
  before(async () => {
    const res = await asTraveller('T-001').post('/api/groups').send({
      name: 'X2 status test', city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    groupId = res.body.group_id;
    await db('groups').where({ group_id: groupId }).update({ member_ids: ['T-001', 'T-002'] });
  });
  after(async () => { await db('groups').where({ group_id: groupId }).del(); await closeDb(); });

  it('lobby → hotel shortlisted → booked, for every member, and the public page agrees', async () => {
    const start = await mine('T-001');
    assert.equal(start.stage, 'LOBBY_OPEN');
    assert.deepEqual(start.hotel_status, { shortlisted: 0, booked: false });
    assert.equal(start.booking, null);

    assert.equal((await asTraveller('T-002').post(`/api/groups/${groupId}/saved-options`).send({ room_id: TWIN })).status, 201);
    const shortlisted = await mine('T-001');
    assert.equal(shortlisted.stage, 'HOTEL_SHORTLISTED');
    assert.deepEqual(shortlisted.hotel_status, { shortlisted: 1, booked: false });

    const booked = await asTraveller('T-001').post(`/api/groups/${groupId}/booking`).send({ room_id: TWIN });
    assert.equal(booked.status, 201, JSON.stringify(booked.body));
    for (const who of ['T-001', 'T-002']) {
      const g = await mine(who);
      assert.equal(g.stage, 'BOOKED', who);
      assert.deepEqual(g.booking, {
        booking_id: booked.body.booking_id, hotel_id: 'HTL-KYO-001', hotel_name: 'Gion Corner Hotel', room_name: 'Twin Room',
        rooms_count: 1, nights: 5, total_inr: 23800, per_member_inr: 11900, booked_at: g.booking.booked_at,
      });
      assert.ok(g.booking.booked_at);
    }

    const page = await api().get(`/api/groups/${groupId}`);
    assert.equal(page.body.stage, 'BOOKED');
    assert.deepEqual(page.body.hotel_status, { shortlisted: 1, booked: true });
    assert.equal(page.body.booking, undefined);
  });

  it('seeded groups without hotel activity keep the lobby stages', async () => {
    const g = (await asTraveller('T-003').get('/api/groups/mine')).body.find((x) => x.group_id === 'G-02');
    assert.ok(['LOBBY_OPEN', 'LOBBY_FULL'].includes(g.stage));
    assert.equal(g.booking, null);
  });
});
