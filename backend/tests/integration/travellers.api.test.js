const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const { api } = require('../helpers/http');
const { db, closeDb } = require('../helpers/db');
const helper = require('../../src/helpers/postgres/travellers.helper');
const createdIds = [];
const valid = { name: 'Signup integration traveller', age: 24, gender: 'MALE', home_city: 'Delhi', home_airport: 'DEL', interests: ['ADVENTURE', 'STREET_FOOD'], gender_preference: 'ANY' };
describe('traveller identity API + PostgreSQL', () => {
  after(async () => { if (createdIds.length) await db('travellers').whereIn('traveller_id', createdIds).del(); await closeDb(); });
  it('creates and persists the exact traveller profile, fetches and signs in the same ID', async () => {
    const response = await api().post('/api/travellers').send(valid);
    assert.equal(response.status, 201); createdIds.push(response.body.traveller_id);
    assert.match(response.body.traveller_id, /^T-\d{3,}$/); assert.ok(Number(response.body.traveller_id.slice(2)) >= 25);
    assert.deepEqual(Object.keys(response.body).sort(), ['traveller_id', ...Object.keys(valid)].sort());
    assert.deepEqual((await db('travellers').where({ traveller_id: response.body.traveller_id }).first()).interests, valid.interests);
    assert.deepEqual((await api().get(`/api/travellers/${response.body.traveller_id}`)).body, response.body);
    assert.deepEqual((await api().post('/api/travellers/sign-in').send({ traveller_id: response.body.traveller_id })).body, response.body);
  });
  it('logs in seeded users and rejects nonexistent IDs without creating them', async () => {
    const existing = await api().post('/api/travellers/sign-in').send({ traveller_id: 'T-001' });
    assert.equal(existing.status, 200); assert.equal(existing.body.name, 'Sarah Thomas');
    const before = await db('travellers').count('* as n').first();
    const missing = await api().post('/api/travellers/sign-in').send({ traveller_id: 'T-99999999' });
    assert.equal(missing.status, 404); assert.equal(missing.body.error.message, 'Traveller ID not found');
    assert.deepEqual(await db('travellers').count('* as n').first(), before);
  });
  it('returns the actual catalog and field errors for invalid enum/interest/ID inputs', async () => {
    const catalog = await api().get('/api/interests'); assert.equal(catalog.status, 200); assert.equal(catalog.body.length, 16); assert.ok(catalog.body.some(i => i.interest === 'TEMPLES' && i.label));
    for (const body of [{ ...valid, gender: 'OTHER' }, { ...valid, interests: ['NOT_A_TAG'] }, { ...valid, traveller_id: 'T-001' }, { ...valid, name: '' }]) { const response = await api().post('/api/travellers').send(body); assert.equal(response.status, 400); assert.ok(response.body.error.fields); }
  });
  it('allows both local frontend development origins', async () => {
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
      const response = await api().get('/api/interests').set('Origin', origin);
      assert.equal(response.headers['access-control-allow-origin'], origin);
    }
  });
  it('uses a database sequence for 16 concurrent registrations', async () => {
    const responses = await Promise.all(Array.from({ length: 16 }, () => api().post('/api/travellers').send(valid)));
    for (const r of responses) { assert.equal(r.status, 201); createdIds.push(r.body.traveller_id); }
    assert.equal(new Set(responses.map(r => r.body.traveller_id)).size, 16);
  });
  it('reruns missing-seed insertion idempotently without overwriting seeded or new profiles', async () => {
    const before = await db('travellers').orderBy('traveller_id');
    await helper.seedMissingTravellers(); await helper.seedMissingTravellers();
    assert.deepEqual(await db('travellers').orderBy('traveller_id'), before);
  });
  it('keeps all digits after the sequence reaches 1000', async () => {
    await db.raw("SELECT setval('traveller_id_seq', GREATEST((SELECT last_value FROM traveller_id_seq), 999), true)");
    const response = await api().post('/api/travellers').send(valid);
    assert.equal(response.status, 201); createdIds.push(response.body.traveller_id);
    assert.match(response.body.traveller_id, /^T-[1-9]\d{3,}$/);
  });
});
