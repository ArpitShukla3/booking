const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../../../src/services/joinRequests.service.ts');
const controller = require('../../../src/controllers/joinRequests.controller.ts');
const { mockRes } = require('../../helpers/mockRes');

const as = (id, extra = {}) => ({ traveller: { traveller_id: id }, params: {}, ...extra });

describe('joinRequests.controller', () => {
  afterEach(() => mock.restoreAll());

  it('createRequest → 201, seeker from req.traveller', async () => {
    const create = mock.method(service, 'createRequest', async () => ({ request_id: 'R-1001', status: 'PENDING' }));
    const res = mockRes();
    await controller.createRequest(as('T-002', { params: { groupId: 'G-01' } }), res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(create.mock.calls[0].arguments, ['T-002', 'G-01', undefined]);
  });

  it('approve / reject → 200 with the decided request', async () => {
    mock.method(service, 'approve', async () => ({ status: 'APPROVED' }));
    mock.method(service, 'reject', async () => ({ status: 'REJECTED' }));
    const a = mockRes();
    await controller.approve(as('T-001', { params: { requestId: 'R-1001' } }), a);
    assert.equal(a.statusCode, 200);
    assert.equal(a.body.status, 'APPROVED');
    const r = mockRes();
    await controller.reject(as('T-001', { params: { requestId: 'R-1001' } }), r);
    assert.equal(r.body.status, 'REJECTED');
  });

  it('listMine → 200 array', async () => {
    mock.method(service, 'listMine', async () => []);
    const res = mockRes();
    await controller.listMine(as('T-002'), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, []);
  });

  it('createRequest passes the body (note); cancel → 200', async () => {
    const create = mock.method(service, 'createRequest', async () => ({ status: 'PENDING' }));
    mock.method(service, 'cancel', async () => ({ status: 'CANCELLED' }));
    await controller.createRequest(as('T-002', { params: { groupId: 'G-01' }, body: { message: 'Hi' } }), mockRes());
    assert.deepEqual(create.mock.calls[0].arguments, ['T-002', 'G-01', { message: 'Hi' }]);
    const res = mockRes();
    await controller.cancel(as('T-002', { params: { requestId: 'R-1001' } }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'CANCELLED');
  });
});
