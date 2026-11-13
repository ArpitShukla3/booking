// MID level: real Express app + real test database, through every layer.
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');

const { api } = require('../helpers/http');
const { closeDb } = require('../helpers/db');

describe('API basics', () => {
  after(closeDb);

  it('GET /api/health → 200 with db up', async () => {
    const res = await api().get('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok', db: 'up' });
  });

  it('unknown route → 404 in the standard error shape', async () => {
    const res = await api().get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.ok(res.body.error.message);
  });

  it('malformed JSON body → 400', async () => {
    const res = await api().post('/api/health').set('Content-Type', 'application/json').send('{bad');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.message, 'Invalid JSON body');
  });

  it('serves hotel photos at the path stored in hotels.image', async () => {
    const res = await api().get('/images/hotels/HOTEL-TWIN-1.jpg');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /image\/jpeg/);
  });
});
