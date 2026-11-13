const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const helper = require('../../../src/helpers/postgres/travellers.helper');
const service = require('../../../src/services/travellers.service.ts');
const valid = { name: 'Rahul Kumar', age: 24, gender: 'MALE', home_city: 'Delhi', home_airport: 'DEL', interests: ['ADVENTURE', 'STREET_FOOD'], gender_preference: 'ANY' };

describe('traveller services', () => {
  afterEach(() => mock.restoreAll());
  it('normalizes valid fields, validates catalog IDs and returns the DB-generated profile', async () => {
    mock.method(helper, 'findInterestIds', async ids => ids);
    const insert = mock.method(helper, 'insert', async input => ({ traveller_id: 'T-025', ...input }));
    const result = await service.createTraveller({ ...valid, name: ' Rahul Kumar ', home_airport: 'del' });
    assert.equal(result.traveller_id, 'T-025'); assert.equal(result.name, 'Rahul Kumar'); assert.equal(result.home_airport, 'DEL'); assert.equal('traveller_id' in insert.mock.calls[0].arguments[0], false);
  });
  for (const [field, value] of [['name', ' '], ['age', 0], ['age', 24.5], ['age', '24'], ['gender', 'OTHER'], ['gender_preference', 'UNKNOWN'], ['home_city', ''], ['home_airport', 'D'], ['interests', 'TEMPLES'], ['interests', ['TEMPLES', 'TEMPLES']]]) {
    it(`rejects ${field}=${JSON.stringify(value)} before writing`, async () => {
      const insert = mock.method(helper, 'insert', async () => {});
      await assert.rejects(service.createTraveller({ ...valid, [field]: value }), error => error.status === 400 && !!error.fields[field]);
      assert.equal(insert.mock.callCount(), 0);
    });
  }
  it('rejects unknown interest IDs and client-supplied IDs', async () => {
    mock.method(helper, 'findInterestIds', async () => []);
    await assert.rejects(service.createTraveller(valid), error => error.status === 400 && !!error.fields.interests);
    await assert.rejects(service.createTraveller({ ...valid, traveller_id: 'T-025' }), error => error.status === 400);
  });
  it('permits empty interests and duplicate names without introducing matching requirements', async () => {
    mock.method(helper, 'findInterestIds', async ids => ids);
    mock.method(helper, 'insert', async input => ({ ...input, traveller_id: 'T-026' }));
    assert.deepEqual((await service.createTraveller({ ...valid, interests: [] })).interests, []);
  });
  it('signs in by normalized ID, never creates an account and returns 404 for unknown IDs', async () => {
    const insert = mock.method(helper, 'insert', async () => {});
    mock.method(helper, 'findById', async id => id === 'T-025' ? { traveller_id: id, ...valid } : undefined);
    assert.equal((await service.signIn({ traveller_id: ' t-025 ' })).traveller_id, 'T-025');
    await assert.rejects(service.signIn({ traveller_id: 'T-9999999' }), error => error.status === 404 && error.message === 'Traveller ID not found');
    assert.equal(insert.mock.callCount(), 0);
  });
  it('rejects malformed IDs and request bodies', async () => {
    for (const input of [{}, null, { traveller_id: '../invalid' }, { traveller_id: 'T-25' }]) await assert.rejects(service.signIn(input), error => error.status === 400);
  });
  it('maps ID collisions to 409 and database connectivity failures to a safe 503', async () => {
    mock.method(helper, 'findInterestIds', async ids => ids);
    mock.method(helper, 'insert', async () => { throw Object.assign(new Error('secret constraint detail'), { code: '23505' }); });
    await assert.rejects(service.createTraveller(valid), error => error.status === 409 && !error.message.includes('secret'));
    mock.restoreAll();
    mock.method(helper, 'findById', async () => { throw Object.assign(new Error('secret db detail'), { code: 'ECONNREFUSED' }); });
    await assert.rejects(service.getTraveller('T-001'), error => error.status === 503 && !error.message.includes('secret'));
  });
});
