const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../../../src/services/groupHotels.service.ts');
const controller = require('../../../src/controllers/groupHotels.controller.ts');
const { mockRes } = require('../../helpers/mockRes');

const as = (id, extra = {}) => ({ traveller: { traveller_id: id }, params: { groupId: 'G-01' }, body: {}, ...extra });

describe('groupHotels.controller', () => {
  afterEach(() => mock.restoreAll());

  it('searchHotels → 200 with caller + group id', async () => {
    const search = mock.method(service, 'searchHotels', async () => ({ hotels: [] }));
    const res = mockRes();
    await controller.searchHotels(as('T-001'), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(search.mock.calls[0].arguments, ['T-001', 'G-01']);
  });

  it('saveOption → 201 with the body', async () => {
    const save = mock.method(service, 'saveOption', async () => []);
    const res = mockRes();
    await controller.saveOption(as('T-002', { body: { room_id: 'RM-KYO-001-A' } }), res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(save.mock.calls[0].arguments, ['T-002', 'G-01', { room_id: 'RM-KYO-001-A' }]);
  });

  it('removeOption → 200 with the room id from the path', async () => {
    const remove = mock.method(service, 'removeOption', async () => []);
    const res = mockRes();
    await controller.removeOption(as('T-002', { params: { groupId: 'G-01', roomId: 'RM-KYO-001-A' } }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(remove.mock.calls[0].arguments, ['T-002', 'G-01', 'RM-KYO-001-A']);
  });

  it('book → 201, getBooking → 200', async () => {
    mock.method(service, 'book', async () => ({ booking_id: 'BK-1001' }));
    mock.method(service, 'getBooking', async () => ({ booking: null }));
    const created = mockRes();
    await controller.book(as('T-001', { body: { room_id: 'RM-KYO-001-A' } }), created);
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.booking_id, 'BK-1001');
    const read = mockRes();
    await controller.getBooking(as('T-001'), read);
    assert.equal(read.statusCode, 200);
    assert.deepEqual(read.body, { booking: null });
  });
});
