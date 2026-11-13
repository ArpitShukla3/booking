// M3 + M4 through all layers against the test DB (seeded data pack).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, asTraveller } = require('../helpers/http');
const { db, truncate, closeDb } = require('../helpers/db');

const priyaSearch = { home_city: 'Mumbai', city: 'Kyoto', check_in: '2027-04-09', check_out: '2027-04-16', budget_inr: 62000, interests: ['TEMPLES', 'STREET_FOOD', 'ADVENTURE'], gender_preference: 'SAME_GENDER' };
const cleanupGroups = () => db('groups').whereRaw("group_id ~ '^G-[0-9]{4,}$'").del();

describe('Searches + matches API (M3/M4)', () => {
  before(async () => { await truncate('searches'); await cleanupGroups(); });
  after(async () => { await truncate('searches'); await cleanupGroups(); await closeDb(); });

  it('saves Priya\'s search and returns G-01 with clear reasons', async () => {
    const created = await asTraveller('T-002').post('/api/searches').send(priyaSearch);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.match(created.body.search_id, /^S-\d+$/);
    assert.equal(created.body.gender, 'FEMALE');
    assert.equal(created.body.check_in, '2027-04-09');

    const res = await asTraveller('T-002').get(`/api/searches/${created.body.search_id}/matches`);
    assert.equal(res.status, 200);
    const g01 = res.body.matches.find((m) => m.group.group_id === 'G-01');
    assert.ok(g01, 'G-01 Kyoto Spring Temples is a match');
    assert.equal(g01.group.name, 'Kyoto Spring Temples');
    assert.equal(g01.group.owner.name, 'Sarah Thomas');
    assert.equal(g01.group.members_count, 1);
    assert.equal(g01.group.max_size, 3);
    assert.equal(g01.reasons.shared_nights, 5);
    assert.equal(g01.reasons.budget_diff_inr, 2000);
    assert.equal(g01.reasons.shared_interests.length, 2);
    assert.ok(g01.explanations.some((e) => /Temples|temple/i.test(e)), 'interest labels, not only IDs');
    for (const m of res.body.matches) assert.equal(m.group.city, 'Kyoto');
    assert.equal(res.body.total, res.body.matches.length);
  });

  it('persists: the search is listed and readable again', async () => {
    const list = await asTraveller('T-002').get('/api/searches');
    assert.equal(list.status, 200);
    assert.ok(list.body.length >= 1);
    const again = await asTraveller('T-002').get(`/api/searches/${list.body[0].search_id}`);
    assert.equal(again.status, 200);
    assert.deepEqual(again.body.interests, priyaSearch.interests);
    assert.ok(await db('searches').where({ search_id: list.body[0].search_id }).first());
  });

  it('a new M2 group shows up in matches with no code change; own groups never do', async () => {
    const group = await asTraveller('T-001').post('/api/groups').send({ name: 'Fresh Kyoto crew', city: 'Kyoto', check_in: '2027-04-11', check_out: '2027-04-14', max_size: 2, budget_inr: 65000 });
    assert.equal(group.status, 201);
    const search = await asTraveller('T-002').post('/api/searches').send(priyaSearch);
    const res = await asTraveller('T-002').get(`/api/searches/${search.body.search_id}/matches`);
    assert.ok(res.body.matches.some((m) => m.group.group_id === group.body.group_id));

    const sarah = await asTraveller('T-001').post('/api/searches').send({ ...priyaSearch, home_city: 'Bengaluru' });
    const own = await asTraveller('T-001').get(`/api/searches/${sarah.body.search_id}/matches`);
    assert.equal(own.body.matches.some((m) => m.group.owner.traveller_id === 'T-001'), false);
  });

  it('every returned match passes all 6 rules (judge-style random search)', async () => {
    const search = await asTraveller('T-005').post('/api/searches').send({ home_city: 'Delhi', city: 'Osaka', check_in: '2027-04-05', check_out: '2027-04-15', budget_inr: 50000, interests: ['STREET_FOOD', 'NIGHTLIFE', 'SHOPPING', 'THEME_PARKS'], gender_preference: 'ANY' });
    assert.equal(search.status, 201, JSON.stringify(search.body));
    const res = await asTraveller('T-005').get(`/api/searches/${search.body.search_id}/matches`);
    for (const m of res.body.matches) {
      assert.equal(m.group.city, 'Osaka');
      assert.ok(m.reasons.shared_nights >= 2);
      assert.ok(m.reasons.budget_diff_inr * 10 <= Math.min(50000, m.group.budget_inr) * 4);
      assert.ok(m.reasons.shared_interests.length >= 2);
      assert.ok(m.group.members_count < m.group.max_size);
    }
  });

  it('sort=overlap orders by shared nights', async () => {
    const search = await asTraveller('T-002').post('/api/searches').send(priyaSearch);
    const res = await asTraveller('T-002').get(`/api/searches/${search.body.search_id}/matches?sort=overlap`);
    const nights = res.body.matches.map((m) => m.reasons.shared_nights);
    assert.deepEqual(nights, [...nights].sort((a, b) => b - a));
  });

  const invalid = [
    ['dates outside the window', { check_in: '2027-03-25' }, 'check_in', /1–20 April 2027/],
    ['check-out after the window', { check_out: '2027-04-22' }, 'check_out', /1–20 April 2027/],
    ['check-out ≤ check-in', { check_in: '2027-04-12', check_out: '2027-04-12' }, 'check_out', /after check-in/],
    ['city not in the data', { city: 'Paris' }, 'city', /City not available/],
    ['zero budget', { budget_inr: 0 }, 'budget_inr', /./],
    ['one interest', { interests: ['TEMPLES'] }, 'interests', /at least 2/],
  ];
  for (const [label, patch, field, message] of invalid) {
    it(`400 for ${label}, never a silent empty result`, async () => {
      const before = await db('searches').count('* as n').first();
      const res = await asTraveller('T-002').post('/api/searches').send({ ...priyaSearch, ...patch });
      assert.equal(res.status, 400);
      assert.match(res.body.error.fields[field], message);
      assert.deepEqual(await db('searches').count('* as n').first(), before);
    });
  }

  it('401 without a traveller; 404 for someone else\'s search', async () => {
    assert.equal((await api().post('/api/searches').send(priyaSearch)).status, 401);
    assert.equal((await api().get('/api/searches')).status, 401);
    const mine = await asTraveller('T-002').post('/api/searches').send(priyaSearch);
    assert.equal((await asTraveller('T-001').get(`/api/searches/${mine.body.search_id}`)).status, 404);
    assert.equal((await asTraveller('T-001').get(`/api/searches/${mine.body.search_id}/matches`)).status, 404);
  });

  it('GET /api/departure-cities lists the home cities', async () => {
    const res = await api().get('/api/departure-cities');
    assert.equal(res.status, 200);
    assert.ok(res.body.some((c) => c.city === 'Mumbai' && c.airport === 'BOM'));
  });
});
