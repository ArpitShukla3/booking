// LOW level: controller maps the service result to status + JSON. Service mocked.
const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const healthService = require('../../../src/services/health.service');
const healthController = require('../../../src/controllers/health.controller');
const { mockRes } = require('../../helpers/mockRes');

describe('health.controller.getHealth', () => {
  afterEach(() => mock.restoreAll());

  it('responds 200 and hides the internal ok flag', async () => {
    mock.method(healthService, 'getStatus', async () => ({ ok: true, status: 'ok', db: 'up' }));
    const res = mockRes();

    await healthController.getHealth({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { status: 'ok', db: 'up' });
  });

  it('responds 503 when the DB is down', async () => {
    mock.method(healthService, 'getStatus', async () => ({ ok: false, status: 'error', db: 'down', message: 'x' }));
    const res = mockRes();

    await healthController.getHealth({}, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.db, 'down');
  });
});
