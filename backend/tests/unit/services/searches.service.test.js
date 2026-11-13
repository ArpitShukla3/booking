const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const searchesHelper = require('../../../src/helpers/postgres/searches.helper');
const lookupsHelper = require('../../../src/helpers/postgres/lookups.helper');
const travellersHelper = require('../../../src/helpers/postgres/travellers.helper');
const service = require('../../../src/services/searches.service.ts');

const priya = { traveller_id: 'T-002', name: 'Priya Shah', gender: 'FEMALE' };
const valid = { home_city: 'Mumbai', city: 'Kyoto', check_in: '2027-04-09', check_out: '2027-04-16', budget_inr: 62000, interests: ['TEMPLES', 'STREET_FOOD', 'ADVENTURE'], gender_preference: 'SAME_GENDER' };

function mockLookups() {
  mock.method(lookupsHelper, 'findDestination', async (city) => (['Tokyo', 'Kyoto', 'Osaka', 'Dubai', 'Abu Dhabi'].includes(city) ? { city } : undefined));
  mock.method(lookupsHelper, 'findDepartureCity', async (city) => (['Mumbai', 'Delhi', 'Bengaluru', 'Chennai'].includes(city) ? { city, airport: 'BOM' } : undefined));
  mock.method(travellersHelper, 'findInterestIds', async (ids) => ids.filter((i) => i !== 'NOT_A_TAG'));
  const insert = mock.method(searchesHelper, 'insert', async () => 'S-1001');
  mock.method(searchesHelper, 'findById', async (id) => ({ search_id: id, traveller_id: 'T-002', ...valid, gender: 'FEMALE' }));
  return insert;
}

describe('searches.service.createSearch', () => {
  afterEach(() => mock.restoreAll());

  it('saves Priya\'s search with gender taken from her profile', async () => {
    const insert = mockLookups();
    const search = await service.createSearch(priya, valid);
    const row = insert.mock.calls[0].arguments[0];
    assert.equal(row.traveller_id, 'T-002');
    assert.equal(row.gender, 'FEMALE');
    assert.equal('search_id' in row, false);
    assert.equal(search.search_id, 'S-1001');
  });

  it('rejects a gender sent in the body (it is not editable)', async () => {
    const insert = mockLookups();
    await assert.rejects(service.createSearch(priya, { ...valid, gender: 'MALE' }), (e) => e.status === 400);
    assert.equal(insert.mock.callCount(), 0);
  });

  const invalid = [
    ['check_in', { check_in: '2027-03-31' }, /1–20 April 2027/],
    ['check_out', { check_out: '2027-04-21' }, /1–20 April 2027/],
    ['check_out', { check_in: '2027-04-12', check_out: '2027-04-12' }, /after check-in/],
    ['check_out', { check_in: '2027-04-15', check_out: '2027-04-10' }, /after check-in/],
    ['budget_inr', { budget_inr: 0 }, /more than/],
    ['budget_inr', { budget_inr: 1.5 }, /whole/],
    ['interests', { interests: ['TEMPLES'] }, /at least 2/],
    ['interests', { interests: ['TEMPLES', 'TEMPLES'] }, /only once/],
    ['gender_preference', { gender_preference: 'FEMALE_ONLY' }, /./],
    ['city', { city: '' }, /destination/],
  ];
  for (const [field, patch, message] of invalid) {
    it(`rejects ${JSON.stringify(patch)} with a clear ${field} message`, async () => {
      const insert = mockLookups();
      await assert.rejects(service.createSearch(priya, { ...valid, ...patch }), (e) => e.status === 400 && message.test(e.fields[field]));
      assert.equal(insert.mock.callCount(), 0);
    });
  }

  it('rejects a city not in the data with "City not available"', async () => {
    mockLookups();
    await assert.rejects(service.createSearch(priya, { ...valid, city: 'Paris' }), (e) => /City not available/.test(e.fields.city));
  });

  it('rejects unknown home cities and interests', async () => {
    mockLookups();
    await assert.rejects(service.createSearch(priya, { ...valid, home_city: 'Atlantis', interests: ['TEMPLES', 'NOT_A_TAG'] }),
      (e) => !!e.fields.home_city && /NOT_A_TAG/.test(e.fields.interests));
  });

  it('accepts any valid combination (window edges, ANY preference)', async () => {
    mockLookups();
    await service.createSearch(priya, { ...valid, city: 'Abu Dhabi', check_in: '2027-04-01', check_out: '2027-04-20', gender_preference: 'ANY', budget_inr: 1 });
  });
});

describe('searches.service.getSearch', () => {
  afterEach(() => mock.restoreAll());
  it('404 for another traveller\'s search and for malformed ids', async () => {
    mock.method(searchesHelper, 'findById', async () => ({ search_id: 'S-1001', traveller_id: 'T-001' }));
    await assert.rejects(service.getSearch('T-002', 'S-1001'), (e) => e.status === 404);
    await assert.rejects(service.getSearch('T-002', '../x'), (e) => e.status === 404);
  });
});
