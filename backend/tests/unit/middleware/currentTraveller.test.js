const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const travellersHelper = require('../../../src/helpers/postgres/travellers.helper');
const { requireTraveller } = require('../../../src/middleware/currentTraveller');

const reqWith = (id) => ({ get: (name) => (name.toLowerCase() === 'x-traveller-id' ? id : undefined) });

describe('requireTraveller', () => {
  afterEach(() => mock.restoreAll());

  it('401 when the header is missing', async () => {
    await assert.rejects(requireTraveller(reqWith(undefined), {}, () => {}), (e) => e.status === 401);
  });
  it('401 when the traveller does not exist', async () => {
    mock.method(travellersHelper, 'findById', async () => undefined);
    await assert.rejects(requireTraveller(reqWith('T-999'), {}, () => {}), (e) => e.status === 401);
  });
  it('sets req.traveller for a known traveller (case-insensitive id)', async () => {
    mock.method(travellersHelper, 'findById', async (id) => ({ traveller_id: id, name: 'Sarah' }));
    const req = reqWith(' t-001 ');
    let called = false;
    await requireTraveller(req, {}, () => { called = true; });
    assert.equal(req.traveller.traveller_id, 'T-001');
    assert.ok(called);
  });
});
