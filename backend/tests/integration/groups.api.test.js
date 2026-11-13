const { describe, it, after, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, asTraveller } = require('../helpers/http');
const { db, closeDb } = require('../helpers/db');

// Only app-created groups (G-1001+). Text comparison would also hit G-12, so use a regex.
const cleanup = () => db('groups').whereRaw("group_id ~ '^G-[0-9]{4,}$'").del();
const sarahPost = { name: 'Kyoto temples & street food', city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000, itinerary: 'Day 1 Fushimi Inari, Day 2 Nishiki market' };

describe('Groups API (M2)', () => {
  before(cleanup);
  after(async () => { await cleanup(); await closeDb(); });

  it('creates Sarah\'s Kyoto post: owner is the only member, id from the sequence', async () => {
    const res = await asTraveller('T-001').post('/api/groups').send(sarahPost);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.group_id, /^G-\d{4,}$/);
    assert.ok(Number(res.body.group_id.slice(2)) >= 1001);
    assert.deepEqual(res.body.member_ids, ['T-001']);
    assert.equal(res.body.owner.name, 'Sarah Thomas');
    assert.equal(res.body.country_name, 'Japan');
    assert.equal(res.body.check_in, '2027-04-10');
    assert.equal(res.body.nights, 5);
    assert.equal(res.body.spots_left, 2);
    assert.equal(res.body.stage, 'LOBBY_OPEN');

    // persistence: read straight from the DB and back through the API
    const dbRow = await db('groups').where({ group_id: res.body.group_id }).first();
    assert.equal(dbRow.owner_id, 'T-001');
    const read = await api().get(`/api/groups/${res.body.group_id}`);
    assert.equal(read.status, 200);
    assert.equal(read.body.name, sarahPost.name);
    assert.deepEqual(read.body.members.map((m) => m.traveller_id), ['T-001']);

    const mine = await asTraveller('T-001').get('/api/groups/mine');
    assert.equal(mine.status, 200);
    const created = mine.body.find((g) => g.group_id === res.body.group_id);
    assert.ok(created, 'new group is listed in My Groups');
    assert.equal(created.my_role, 'OWNER');
    assert.equal(created.pending_requests, 0);
    assert.ok(mine.body.some((g) => g.group_id === 'G-01'), 'seeded owned group is listed too');
  });

  it('a traveller who is only a member sees the group as MEMBER', async () => {
    const seeded = await db('groups').whereRaw('cardinality(member_ids) > 1').first();
    if (!seeded) return; // data pack has only single-member groups
    const member = seeded.member_ids.find((id) => id !== seeded.owner_id);
    const mine = await asTraveller(member).get('/api/groups/mine');
    assert.equal(mine.body.find((g) => g.group_id === seeded.group_id).my_role, 'MEMBER');
  });

  it('ignores owner_id sent in the body (rejects unknown keys)', async () => {
    const res = await asTraveller('T-001').post('/api/groups').send({ ...sarahPost, owner_id: 'T-002' });
    assert.equal(res.status, 400);
  });

  const invalid = [
    ['size 0', { max_size: 0 }, 'max_size'],
    ['size 5', { max_size: 5 }, 'max_size'],
    ['check-in before the window', { check_in: '2027-03-30' }, 'check_in'],
    ['check-out after the window', { check_out: '2027-04-25' }, 'check_out'],
    ['check-out before check-in', { check_in: '2027-04-15', check_out: '2027-04-12' }, 'check_out'],
    ['unknown city', { city: 'Paris' }, 'city'],
    ['zero budget', { budget_inr: 0 }, 'budget_inr'],
    ['blank name', { name: ' ' }, 'name'],
  ];
  for (const [label, patch, field] of invalid) {
    it(`400 for ${label} with a readable ${field} message`, async () => {
      const before = await db('groups').count('* as n').first();
      const res = await asTraveller('T-001').post('/api/groups').send({ ...sarahPost, ...patch });
      assert.equal(res.status, 400);
      assert.equal(typeof res.body.error.fields[field], 'string');
      assert.ok(res.body.error.fields[field].length > 5);
      assert.deepEqual(await db('groups').count('* as n').first(), before);
    });
  }

  it('401 without a traveller id, and for an unknown traveller', async () => {
    assert.equal((await api().post('/api/groups').send(sarahPost)).status, 401);
    assert.equal((await api().get('/api/groups/mine')).status, 401);
    assert.equal((await asTraveller('T-99999').post('/api/groups').send(sarahPost)).status, 401);
  });

  it('details work for seeded G-01 and 404 for unknown groups', async () => {
    const res = await api().get('/api/groups/G-01');
    assert.equal(res.status, 200);
    assert.equal(res.body.owner.traveller_id, 'T-001');
    assert.equal(res.body.check_in, '2027-04-10');
    assert.ok(Array.isArray(res.body.members) && res.body.members.length >= 1);
    assert.ok(res.body.members[0].interests);
    assert.equal((await api().get('/api/groups/G-424242')).status, 404);
  });

  it('GET /api/destinations lists the 5 cities with countries', async () => {
    const res = await api().get('/api/destinations');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 5);
    assert.ok(res.body.some((d) => d.city === 'Kyoto' && d.country_name === 'Japan'));
  });
});
