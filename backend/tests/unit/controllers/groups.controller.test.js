const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../../../src/services/groups.service.ts');
const controller = require('../../../src/controllers/groups.controller.ts');
const { mockRes } = require('../../helpers/mockRes');

describe('groups.controller', () => {
  afterEach(() => mock.restoreAll());
  it('createGroup → 201 with the created group, owner from req.traveller', async () => {
    const create = mock.method(service, 'createGroup', async () => ({ group_id: 'G-1001' }));
    const res = mockRes();
    await controller.createGroup({ traveller: { traveller_id: 'T-001' }, body: { name: 'x' } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.group_id, 'G-1001');
    assert.equal(create.mock.calls[0].arguments[0], 'T-001');
  });
  it('getGroup → 200', async () => {
    mock.method(service, 'getGroup', async (id) => ({ group_id: id }));
    const res = mockRes();
    await controller.getGroup({ params: { groupId: 'G-01' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.group_id, 'G-01');
  });
  it('removeMember → 200, owner from req.traveller, ids from params', async () => {
    const remove = mock.method(service, 'removeMember', async () => ({ group_id: 'G-01', member_ids: ['T-001'] }));
    const res = mockRes();
    await controller.removeMember({ traveller: { traveller_id: 'T-001' }, params: { groupId: 'G-01', travellerId: 'T-002' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(remove.mock.calls[0].arguments, ['T-001', 'G-01', 'T-002']);
  });
});
