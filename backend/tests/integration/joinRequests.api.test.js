const { describe, it, after, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, asTraveller } = require('../helpers/http');
const { db, truncate, closeDb } = require('../helpers/db');

// Approvals change the seeded G-01 member list, so snapshot it and put it back.
let originalG01;
const restoreG01 = () => db('groups').where({ group_id: 'G-01' }).update({ member_ids: originalG01 });
const reset = async () => { await truncate('join_requests', 'group_bookings'); await restoreG01(); };

describe('Join requests API (M5)', () => {
  before(async () => { originalG01 = (await db('groups').where({ group_id: 'G-01' }).first()).member_ids; });
  beforeEach(reset);
  after(async () => { await reset(); await closeDb(); });

  it('Scenario B: Priya → Interested on G-01, Sarah sees the badge, approves → 2/3', async () => {
    const sent = await asTraveller('T-002').post('/api/groups/G-01/join-requests');
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    assert.match(sent.body.request_id, /^R-\d{4,}$/);
    assert.equal(sent.body.status, 'PENDING');

    const mine = await asTraveller('T-001').get('/api/groups/mine');
    assert.equal(mine.body.find((g) => g.group_id === 'G-01').pending_requests, 1);

    const incoming = await asTraveller('T-001').get('/api/join-requests/incoming');
    assert.equal(incoming.status, 200);
    assert.equal(incoming.body.length, 1);
    assert.equal(incoming.body[0].seeker.name, 'Priya Shah');
    assert.equal(incoming.body[0].group.name, mine.body.find((g) => g.group_id === 'G-01').name);

    const list = await asTraveller('T-001').get('/api/groups/G-01/join-requests');
    assert.equal(list.status, 200);
    assert.equal(list.body[0].seeker.traveller_id, 'T-002');
    assert.ok(list.body[0].shared_interests.includes('TEMPLES'));

    const approved = await asTraveller('T-001').post(`/api/join-requests/${sent.body.request_id}/approve`);
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'APPROVED');
    assert.ok(approved.body.decided_at);

    const group = await api().get('/api/groups/G-01');
    assert.ok(group.body.member_ids.includes('T-002'));
    assert.equal(group.body.members_count, originalG01.length + 1);
    assert.ok(group.body.members.some((m) => m.name === 'Priya Shah'));

    const after = await asTraveller('T-001').get('/api/groups/mine');
    assert.equal(after.body.find((g) => g.group_id === 'G-01').pending_requests, 0);
    const priyaGroups = await asTraveller('T-002').get('/api/groups/mine');
    assert.equal(priyaGroups.body.find((g) => g.group_id === 'G-01').my_role, 'MEMBER');
    const seekerView = await asTraveller('T-002').get('/api/join-requests/mine');
    assert.equal(seekerView.body[0].status, 'APPROVED');
  });

  it('repeated click → 409 and still exactly one row', async () => {
    assert.equal((await asTraveller('T-002').post('/api/groups/G-01/join-requests')).status, 201);
    const again = await asTraveller('T-002').post('/api/groups/G-01/join-requests');
    assert.equal(again.status, 409);
    const { n } = await db('join_requests').where({ group_id: 'G-01', seeker_id: 'T-002' }).count('* as n').first();
    assert.equal(Number(n), 1);
  });

  it('reject is saved; the seeker sees REJECTED and cannot request again', async () => {
    const sent = await asTraveller('T-002').post('/api/groups/G-01/join-requests');
    const rejected = await asTraveller('T-001').post(`/api/join-requests/${sent.body.request_id}/reject`);
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.status, 'REJECTED');
    const row = await db('join_requests').where({ request_id: sent.body.request_id }).first();
    assert.equal(row.status, 'REJECTED');
    const mine = await asTraveller('T-002').get('/api/join-requests/mine');
    assert.equal(mine.body[0].status, 'REJECTED');
    assert.equal(mine.body[0].group.group_id, 'G-01');
    assert.equal((await asTraveller('T-002').post('/api/groups/G-01/join-requests')).status, 409);
    const group = await api().get('/api/groups/G-01');
    assert.ok(!group.body.member_ids.includes('T-002'));
  });

  it('only the owner can list, approve or reject (403)', async () => {
    const sent = await asTraveller('T-002').post('/api/groups/G-01/join-requests');
    assert.equal((await asTraveller('T-003').get('/api/groups/G-01/join-requests')).status, 403);
    assert.equal((await asTraveller('T-002').post(`/api/join-requests/${sent.body.request_id}/approve`)).status, 403);
    assert.equal((await asTraveller('T-003').post(`/api/join-requests/${sent.body.request_id}/reject`)).status, 403);
    const row = await db('join_requests').where({ request_id: sent.body.request_id }).first();
    assert.equal(row.status, 'PENDING');
  });

  it('a full group refuses new requests, and an approval that would overflow is refused', async () => {
    const a = await asTraveller('T-002').post('/api/groups/G-01/join-requests');
    const b = await asTraveller('T-003').post('/api/groups/G-01/join-requests');
    // Fill the remaining spots behind the API's back so only one is left, then none.
    const { max_size } = await db('groups').where({ group_id: 'G-01' }).first();
    const fillers = ['T-010', 'T-011', 'T-012'].slice(0, max_size - originalG01.length - 1);
    await db('groups').where({ group_id: 'G-01' }).update({ member_ids: [...originalG01, ...fillers] });

    assert.equal((await asTraveller('T-001').post(`/api/join-requests/${a.body.request_id}/approve`)).status, 200);
    const overflow = await asTraveller('T-001').post(`/api/join-requests/${b.body.request_id}/approve`);
    assert.equal(overflow.status, 409);
    assert.match(overflow.body.error.message, /full/i);
    const g = await db('groups').where({ group_id: 'G-01' }).first();
    assert.equal(g.member_ids.length, max_size);
    // Filling the group closed b automatically (M5 follow-up), so it can never overflow it.
    assert.equal((await db('join_requests').where({ request_id: b.body.request_id }).first()).status, 'CLOSED');

    const late = await asTraveller('T-004').post('/api/groups/G-01/join-requests');
    assert.equal(late.status, 409);
  });

  it('owner and members cannot request their own group; unknown group 404; 401 without id', async () => {
    assert.equal((await asTraveller('T-001').post('/api/groups/G-01/join-requests')).status, 409);
    assert.equal((await asTraveller('T-002').post('/api/groups/G-424242/join-requests')).status, 404);
    assert.equal((await api().post('/api/groups/G-01/join-requests')).status, 401);
    assert.equal((await api().get('/api/join-requests/mine')).status, 401);
    assert.equal((await asTraveller('T-001').post('/api/join-requests/R-424242/approve')).status, 404);
  });

  it('concurrent approvals never push the group over max_size', async () => {
    const { max_size } = await db('groups').where({ group_id: 'G-01' }).first();
    const fillers = ['T-010', 'T-011', 'T-012'].slice(0, max_size - originalG01.length - 1);
    await db('groups').where({ group_id: 'G-01' }).update({ member_ids: [...originalG01, ...fillers] });
    const ids = [];
    for (const seeker of ['T-002', 'T-003', 'T-004']) {
      ids.push((await asTraveller(seeker).post('/api/groups/G-01/join-requests')).body.request_id);
    }
    const results = await Promise.all(ids.map((id) => asTraveller('T-001').post(`/api/join-requests/${id}/approve`)));
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 2);
    const g = await db('groups').where({ group_id: 'G-01' }).first();
    assert.equal(g.member_ids.length, max_size);
  });

  it('owner removes an approved member: spot opens, request is REMOVED, they cannot ask again', async () => {
    const sent = await asTraveller('T-002').post('/api/groups/G-01/join-requests');
    await asTraveller('T-001').post(`/api/join-requests/${sent.body.request_id}/approve`);

    const removed = await asTraveller('T-001').delete('/api/groups/G-01/members/T-002');
    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    assert.ok(!removed.body.member_ids.includes('T-002'));
    assert.equal(removed.body.members_count, originalG01.length);

    const g = await db('groups').where({ group_id: 'G-01' }).first();
    assert.deepEqual(g.member_ids, originalG01);
    assert.equal((await db('join_requests').where({ request_id: sent.body.request_id }).first()).status, 'REMOVED');

    const mine = await asTraveller('T-002').get('/api/join-requests/mine');
    assert.equal(mine.body[0].status, 'REMOVED');
    const again = await asTraveller('T-002').post('/api/groups/G-01/join-requests');
    assert.equal(again.status, 409);
    assert.match(again.body.error.message, /removed/i);
  });

  it('removing a seeded member with no request row still records REMOVED', async () => {
    await db('groups').where({ group_id: 'G-01' }).update({ member_ids: [...originalG01, 'T-010'] });
    const res = await asTraveller('T-001').delete('/api/groups/G-01/members/T-010');
    assert.equal(res.status, 200);
    const row = await db('join_requests').where({ group_id: 'G-01', seeker_id: 'T-010' }).first();
    assert.equal(row.status, 'REMOVED');
    assert.ok(row.decided_at);
  });

  it('remove member: 403 non-owner, 400 owner, 404 non-member / unknown group, 401 without id', async () => {
    await db('groups').where({ group_id: 'G-01' }).update({ member_ids: [...originalG01, 'T-010'] });
    assert.equal((await asTraveller('T-010').delete('/api/groups/G-01/members/T-010')).status, 403);
    assert.equal((await asTraveller('T-001').delete('/api/groups/G-01/members/T-001')).status, 400);
    assert.equal((await asTraveller('T-001').delete('/api/groups/G-01/members/T-011')).status, 404);
    assert.equal((await asTraveller('T-001').delete('/api/groups/G-424242/members/T-010')).status, 404);
    assert.equal((await api().delete('/api/groups/G-01/members/T-010')).status, 401);
    assert.ok((await db('groups').where({ group_id: 'G-01' }).first()).member_ids.includes('T-010'));
  });

  it('a note travels with the request to the owner and back to the seeker', async () => {
    const sent = await asTraveller('T-002').post('/api/groups/G-01/join-requests').send({ message: '  Temples and ramen, yes please!  ' });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.message, 'Temples and ramen, yes please!');
    assert.equal((await asTraveller('T-001').get('/api/groups/G-01/join-requests')).body[0].message, 'Temples and ramen, yes please!');
    assert.equal((await asTraveller('T-001').get('/api/join-requests/incoming')).body[0].message, 'Temples and ramen, yes please!');
    assert.equal((await asTraveller('T-002').get('/api/join-requests/mine')).body[0].message, 'Temples and ramen, yes please!');
    const tooLong = await asTraveller('T-003').post('/api/groups/G-01/join-requests').send({ message: 'x'.repeat(501) });
    assert.equal(tooLong.status, 400);
    assert.ok(tooLong.body.error.fields.message);
  });

  it('seeker cancels a pending request and can send a new one (same row, PENDING again)', async () => {
    const sent = await asTraveller('T-002').post('/api/groups/G-01/join-requests');
    assert.equal((await asTraveller('T-003').post(`/api/join-requests/${sent.body.request_id}/cancel`)).status, 403);
    const cancelled = await asTraveller('T-002').post(`/api/join-requests/${sent.body.request_id}/cancel`);
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'CANCELLED');
    assert.equal((await asTraveller('T-002').post(`/api/join-requests/${sent.body.request_id}/cancel`)).status, 409);
    assert.equal((await asTraveller('T-001').get('/api/groups/mine')).body.find((g) => g.group_id === 'G-01').pending_requests, 0);

    const again = await asTraveller('T-002').post('/api/groups/G-01/join-requests').send({ message: 'Changed my mind!' });
    assert.equal(again.status, 201);
    assert.equal(again.body.request_id, sent.body.request_id);
    assert.equal(again.body.status, 'PENDING');
    assert.equal(again.body.decided_at, null);
    assert.equal(Number((await db('join_requests').where({ group_id: 'G-01', seeker_id: 'T-002' }).count('* as n').first()).n), 1);
  });

  it('a member leaves (LEFT), can ask again, and the owner cannot leave', async () => {
    const sent = await asTraveller('T-002').post('/api/groups/G-01/join-requests');
    await asTraveller('T-001').post(`/api/join-requests/${sent.body.request_id}/approve`);
    assert.equal((await asTraveller('T-001').post('/api/groups/G-01/leave')).status, 400);
    assert.equal((await asTraveller('T-005').post('/api/groups/G-01/leave')).status, 404);

    const left = await asTraveller('T-002').post('/api/groups/G-01/leave');
    assert.equal(left.status, 200, JSON.stringify(left.body));
    assert.ok(!left.body.member_ids.includes('T-002'));
    assert.equal(left.body.booking_update, null);
    assert.equal((await db('join_requests').where({ request_id: sent.body.request_id }).first()).status, 'LEFT');
    assert.equal((await asTraveller('T-002').post('/api/groups/G-01/join-requests')).status, 201);
  });

  it('approving the last spot closes the other pending requests; they can ask again when a spot opens', async () => {
    const { max_size } = await db('groups').where({ group_id: 'G-01' }).first();
    const fillers = ['T-010', 'T-011', 'T-012'].slice(0, max_size - originalG01.length - 1);
    await db('groups').where({ group_id: 'G-01' }).update({ member_ids: [...originalG01, ...fillers] }); // one spot left
    const a = await asTraveller('T-002').post('/api/groups/G-01/join-requests');
    const b = await asTraveller('T-003').post('/api/groups/G-01/join-requests');
    const c = await asTraveller('T-004').post('/api/groups/G-01/join-requests');

    const approved = await asTraveller('T-001').post(`/api/join-requests/${a.body.request_id}/approve`);
    assert.equal(approved.status, 200);
    assert.deepEqual([...approved.body.closed_request_ids].sort(), [b.body.request_id, c.body.request_id].sort());
    assert.equal((await db('join_requests').where({ request_id: b.body.request_id }).first()).status, 'CLOSED');
    assert.equal((await asTraveller('T-001').get('/api/join-requests/incoming')).body.length, 0);
    assert.equal((await asTraveller('T-003').post('/api/groups/G-01/join-requests')).status, 409); // still full

    await asTraveller('T-002').post('/api/groups/G-01/leave'); // a spot opens
    const reopened = await asTraveller('T-003').post('/api/groups/G-01/join-requests');
    assert.equal(reopened.status, 201);
    assert.equal(reopened.body.request_id, b.body.request_id);
  });

  it('removing or leaving after booking re-splits the same total over the remaining members', async () => {
    const sent = await asTraveller('T-002').post('/api/groups/G-01/join-requests');
    await asTraveller('T-001').post(`/api/join-requests/${sent.body.request_id}/approve`);
    const members = originalG01.length + 1;
    const room = await db({ r: 'rooms' }).join({ h: 'hotels' }, 'h.hotel_id', 'r.hotel_id').where('h.city', 'Kyoto').select('r.room_id').first();
    await db('group_bookings').insert({ group_id: 'G-01', room_id: room.room_id, rooms_count: 1, nights: 5, total_inr: 23800, per_member_inr: Math.round(23800 / members), members_count: members, booked_by: 'T-001' });

    const removed = await asTraveller('T-001').delete('/api/groups/G-01/members/T-002');
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.booking_update, {
      booking_id: removed.body.booking_update.booking_id, total_inr: 23800, members_count: members - 1,
      per_member_before: Math.round(23800 / members), per_member_after: Math.round(23800 / (members - 1)),
    });
    const booking = await db('group_bookings').where({ group_id: 'G-01' }).first();
    assert.equal(booking.total_inr, 23800);
    assert.equal(booking.members_count, members - 1);
    assert.equal(booking.per_member_inr, Math.round(23800 / (members - 1)));
  });
});
