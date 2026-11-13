// LOW level: service logic with the helper mocked. No database needed.
const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const healthHelper = require('../../../src/helpers/postgres/health.helper');
const healthService = require('../../../src/services/health.service');

describe('health.service.getStatus', () => {
  afterEach(() => mock.restoreAll());

  it('reports ok when the DB answers', async () => {
    mock.method(healthHelper, 'ping', async () => true);

    const result = await healthService.getStatus();

    assert.deepEqual(result, { ok: true, status: 'ok', db: 'up' });
  });

  it('reports db down with the error message instead of throwing', async () => {
    mock.method(healthHelper, 'ping', async () => { throw new Error('connection refused'); });

    const result = await healthService.getStatus();

    assert.equal(result.ok, false);
    assert.equal(result.db, 'down');
    assert.equal(result.message, 'connection refused');
  });

  it('falls back to the error code when the message is empty', async () => {
    mock.method(healthHelper, 'ping', async () => {
      const err = new Error('');
      err.code = 'ECONNREFUSED';
      throw err;
    });

    const result = await healthService.getStatus();

    assert.equal(result.message, 'ECONNREFUSED');
  });
});
