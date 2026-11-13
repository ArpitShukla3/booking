const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, asTraveller } = require('../helpers/http');
const { db, closeDb } = require('../helpers/db');

// G2: GET /api/travellers/:id/groups — public list of the groups a traveller organises or has joined.
const cleanupGroups = () => db('groups').whereRaw("group_id ~ '^G-[0-9]{4,}$'").del();
let joined;

describe('Traveller groups API (G2)', () => {
  before(async () => {
    await cleanupGroups();
    joined = (await asTraveller('T-001').post('/api/groups').send({ name: 'Profile trips test', city: 'Osaka', check_in: '2027-04-05', check_out: '2027-04-09', max_size: 3, budget_inr: 50000 })).body.group_id;
    await db('groups').where({ group_id: joined }).update({ member_ids: ['T-001', 'T-002'] });
  });
  after(async () => { await cleanupGroups(); await closeDb(); });

  it('organiser sees OWNER groups (seeded G-01 + the new one); public, no sign-in needed', async () => {
    const res = await api().get('/api/travellers/t-001/groups');
    assert.equal(res.status, 200);
    const roles = new Map(res.body.map((g) => [g.group_id, g.role]));
    assert.equal(roles.get('G-01'), 'OWNER');
    assert.equal(roles.get(joined), 'OWNER');
    const g = res.body.find((x) => x.group_id === joined);
    assert.equal(g.city, 'Osaka');
    assert.equal(g.members_count, 2);
    assert.equal('pending_requests' in g, false);
    assert.equal('booking' in g, false);
  });

  it('a member sees the group as MEMBER', async () => {
    const res = await api().get('/api/travellers/T-002/groups');
    assert.equal(res.body.find((g) => g.group_id === joined).role, 'MEMBER');
  });

  it('unknown traveller 404; someone with no groups gets an empty list', async () => {
    assert.equal((await api().get('/api/travellers/T-99999/groups')).status, 404);
    const lonely = await db('travellers').whereNotIn('traveller_id', db('groups').select('owner_id')).whereRaw("NOT EXISTS (SELECT 1 FROM groups g WHERE travellers.traveller_id = ANY(g.member_ids))").first();
    if (lonely) assert.deepEqual((await api().get(`/api/travellers/${lonely.traveller_id}/groups`)).body, []);
  });
});
