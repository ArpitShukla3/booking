const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { asTraveller } = require('../helpers/http');
const { db, truncate, closeDb } = require('../helpers/db');

// G1: filters on top of the 6 matching rules. Two app-created Kyoto groups owned by Sarah (T-001, female):
// one women-only, one mixed (a man added). Priya (T-002, female) searches Kyoto open to any gender.
const cleanupGroups = () => db('groups').whereRaw("group_id ~ '^G-[0-9]{4,}$'").del();
const post = { city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 4, budget_inr: 60000 };
const search = { home_city: 'Mumbai', city: 'Kyoto', check_in: '2027-04-09', check_out: '2027-04-16', budget_inr: 62000, interests: ['TEMPLES', 'STREET_FOOD', 'ADVENTURE'], gender_preference: 'ANY' };
let womenOnly; let mixed; let searchId;
const matches = (query = '') => asTraveller('T-002').get(`/api/searches/${searchId}/matches${query}`);
const idsOf = (res) => res.body.matches.map((m) => m.group.group_id);

describe('Match filters API (G1)', () => {
  before(async () => {
    await truncate('searches');
    await cleanupGroups();
    womenOnly = (await asTraveller('T-001').post('/api/groups').send({ ...post, name: 'Filter test women' })).body.group_id;
    mixed = (await asTraveller('T-001').post('/api/groups').send({ ...post, name: 'Filter test mixed' })).body.group_id;
    const man = await db('travellers').where({ gender: 'MALE' }).first();
    await db('groups').where({ group_id: mixed }).update({ member_ids: ['T-001', man.traveller_id] });
    searchId = (await asTraveller('T-002').post('/api/searches').send(search)).body.search_id;
  });
  after(async () => { await truncate('searches'); await cleanupGroups(); await closeDb(); });

  it('unfiltered: both groups match, each with its gender mix; facets are returned', async () => {
    const res = await matches();
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.total, res.body.total_unfiltered);
    assert.deepEqual(res.body.filters, { min_shared: null, must: [], composition: null });
    const byId = new Map(res.body.matches.map((m) => [m.group.group_id, m]));
    assert.deepEqual(byId.get(womenOnly).composition, { female: 1, male: 0, kind: 'WOMEN_ONLY' });
    assert.deepEqual(byId.get(mixed).composition, { female: 1, male: 1, kind: 'MIXED' });
    const { composition, interests } = res.body.facets;
    assert.equal(composition.WOMEN_ONLY + composition.MEN_ONLY + composition.MIXED, res.body.total_unfiltered);
    for (const facet of interests) {
      assert.equal(facet.count, res.body.matches.filter((m) => m.reasons.shared_interests.includes(facet.interest)).length, facet.interest);
    }
  });

  it('gender mix filter keeps only that mix and never adds groups', async () => {
    const all = await matches();
    const women = await matches('?mix=WOMEN_ONLY');
    assert.ok(idsOf(women).includes(womenOnly));
    assert.ok(!idsOf(women).includes(mixed));
    assert.ok(women.body.matches.every((m) => m.composition.kind === 'WOMEN_ONLY'));
    assert.equal(women.body.total, all.body.facets.composition.WOMEN_ONLY);
    assert.equal(women.body.total_unfiltered, all.body.total_unfiltered);
    assert.ok(idsOf(women).every((id) => idsOf(all).includes(id)));
    assert.ok(idsOf(await matches('?mix=MIXED')).includes(mixed));
  });

  it('minimum shared interests and "must share" (ALL chosen interests)', async () => {
    const three = await matches('?shared=3');
    assert.ok(three.body.matches.every((m) => m.reasons.shared_interests.length >= 3));
    const temples = await matches('?must=temples');
    assert.ok(temples.body.matches.length > 0);
    assert.ok(temples.body.matches.every((m) => m.reasons.shared_interests.includes('TEMPLES')));
    const both = await matches('?must=TEMPLES,STREET_FOOD&mix=WOMEN_ONLY&sort=budget');
    assert.ok(both.body.matches.every((m) => ['TEMPLES', 'STREET_FOOD'].every((i) => m.reasons.shared_interests.includes(i)) && m.composition.kind === 'WOMEN_ONLY'));
    assert.deepEqual(both.body.filters, { min_shared: null, must: ['TEMPLES', 'STREET_FOOD'], composition: 'WOMEN_ONLY' });
  });

  it('invalid filters are 400 with a field message', async () => {
    assert.ok((await matches('?shared=1')).body.error.fields.shared);
    assert.equal((await matches('?shared=abc')).status, 400);
    assert.ok((await matches('?mix=EVERYONE')).body.error.fields.mix);
    assert.ok((await matches('?must=bad%20id!')).body.error.fields.must);
  });
});
