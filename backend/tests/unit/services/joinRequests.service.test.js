const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const groupsHelper = require('../../../src/helpers/postgres/groups.helper');
const joinRequestsHelper = require('../../../src/helpers/postgres/joinRequests.helper');
const travellersHelper = require('../../../src/helpers/postgres/travellers.helper');
const transactionHelper = require('../../../src/helpers/postgres/transaction.helper');
const HttpError = require('../../../src/utils/HttpError');
const service = require('../../../src/services/joinRequests.service.ts');

const g01 = (over = {}) => ({
  group_id: 'G-01', name: 'Kyoto Spring Temples', owner_id: 'T-001', member_ids: ['T-001'], max_size: 3,
  city: 'Kyoto', country_name: 'Japan', check_in: '2027-04-10', check_out: '2027-04-15', budget_inr: 60000,
  itinerary: null, owner_name: 'Sarah Thomas', owner_gender: 'FEMALE', ...over,
});
const request = (over = {}) => ({ request_id: 'R-1001', group_id: 'G-01', seeker_id: 'T-002', status: 'PENDING', created_at: 'now', decided_at: null, ...over });
const sarah = { traveller_id: 'T-001', name: 'Sarah Thomas', age: 29, gender: 'FEMALE', home_city: 'Mumbai', home_airport: 'BOM', interests: ['TEMPLES', 'STREET_FOOD', 'MUSEUMS'], gender_preference: 'SAME_GENDER' };
const priya = { traveller_id: 'T-002', name: 'Priya Shah', age: 26, gender: 'FEMALE', home_city: 'Delhi', home_airport: 'DEL', interests: ['TEMPLES', 'STREET_FOOD', 'ADVENTURE'], gender_preference: 'SAME_GENDER' };
const is = (status) => (err) => err instanceof HttpError && err.status === status;

/** Runs the transaction callback with a fake trx so the service code path is exercised. */
function fakeTransaction() {
  return mock.method(transactionHelper, 'withTransaction', async (work) => work('TRX'));
}

describe('joinRequests.service pure rules', () => {
  it('requestBlocker: open group, stranger with no request → null', () => {
    assert.equal(service.requestBlocker(g01(), 'T-002', undefined), null);
  });
  it('requestBlocker: owner, member, full, pending, rejected', () => {
    assert.equal(service.requestBlocker(g01(), 'T-001', undefined), 'OWNER');
    assert.equal(service.requestBlocker(g01({ member_ids: ['T-001', 'T-002'] }), 'T-002', undefined), 'MEMBER');
    assert.equal(service.requestBlocker(g01({ member_ids: ['T-001', 'T-003', 'T-004'] }), 'T-002', undefined), 'FULL');
    assert.equal(service.requestBlocker(g01(), 'T-002', request()), 'PENDING');
    assert.equal(service.requestBlocker(g01(), 'T-002', request({ status: 'REJECTED' })), 'REJECTED');
  });
  it('requestBlocker: a full group still reports PENDING for an existing request', () => {
    assert.equal(service.requestBlocker(g01({ max_size: 1 }), 'T-002', request()), 'PENDING');
  });
  it('sharedInterests keeps the seeker order and drops the rest', () => {
    assert.deepEqual(service.sharedInterests(priya.interests, sarah.interests), ['TEMPLES', 'STREET_FOOD']);
    assert.deepEqual(service.sharedInterests(['SKIING'], sarah.interests), []);
  });
});

describe('joinRequests.service.createRequest', () => {
  afterEach(() => mock.restoreAll());

  it('Priya → G-01 creates a PENDING request', async () => {
    mock.method(groupsHelper, 'findById', async () => g01());
    mock.method(joinRequestsHelper, 'findByGroupAndSeeker', async () => undefined);
    const insert = mock.method(joinRequestsHelper, 'insert', async () => request());
    const created = await service.createRequest('T-002', 'g-01');
    assert.deepEqual(insert.mock.calls[0].arguments[0], { group_id: 'G-01', seeker_id: 'T-002' });
    assert.equal(created.status, 'PENDING');
  });

  it('404 for an unknown group', async () => {
    mock.method(groupsHelper, 'findById', async () => undefined);
    await assert.rejects(service.createRequest('T-002', 'G-999'), is(404));
  });

  for (const [label, group, existing] of [
    ['the owner', g01(), undefined],
    ['a member', g01({ member_ids: ['T-001', 'T-002'] }), undefined],
    ['a full group', g01({ member_ids: ['T-001', 'T-003', 'T-004'] }), undefined],
    ['a repeated click (already PENDING)', g01(), request()],
    ['a REJECTED seeker', g01(), request({ status: 'REJECTED' })],
  ]) {
    it(`409 and no insert for ${label}`, async () => {
      mock.method(groupsHelper, 'findById', async () => group);
      mock.method(joinRequestsHelper, 'findByGroupAndSeeker', async () => existing);
      const insert = mock.method(joinRequestsHelper, 'insert', async () => request());
      await assert.rejects(service.createRequest(label === 'the owner' ? 'T-001' : 'T-002', 'G-01'), is(409));
      assert.equal(insert.mock.callCount(), 0);
    });
  }

  it('409 when a concurrent click won the unique constraint', async () => {
    mock.method(groupsHelper, 'findById', async () => g01());
    mock.method(joinRequestsHelper, 'findByGroupAndSeeker', async () => undefined);
    mock.method(joinRequestsHelper, 'insert', async () => undefined); // ON CONFLICT DO NOTHING
    await assert.rejects(service.createRequest('T-002', 'G-01'), is(409));
  });
});

describe('joinRequests.service.listForGroup', () => {
  afterEach(() => mock.restoreAll());

  it('owner sees requests with seeker profile and interests shared with the group', async () => {
    mock.method(groupsHelper, 'findById', async () => g01());
    const { traveller_id: _id, ...priyaColumns } = priya;
    mock.method(joinRequestsHelper, 'listByGroup', async () => [{ ...request(), ...priyaColumns }]); // joined row
    mock.method(travellersHelper, 'findByIds', async (ids) => [sarah, priya].filter((t) => ids.includes(t.traveller_id)));
    const list = await service.listForGroup('T-001', 'G-01');
    assert.equal(list.length, 1);
    assert.equal(list[0].seeker.name, 'Priya Shah');
    assert.deepEqual(list[0].shared_interests, ['TEMPLES', 'STREET_FOOD']);
  });

  it('403 for anyone but the owner', async () => {
    mock.method(groupsHelper, 'findById', async () => g01());
    const list = mock.method(joinRequestsHelper, 'listByGroup', async () => []);
    await assert.rejects(service.listForGroup('T-002', 'G-01'), is(403));
    assert.equal(list.mock.callCount(), 0);
  });
});

describe('joinRequests.service.approve', () => {
  afterEach(() => mock.restoreAll());

  function arrange({ group = g01(), req = request() } = {}) {
    fakeTransaction();
    mock.method(joinRequestsHelper, 'findById', async () => req);
    mock.method(joinRequestsHelper, 'findByIdForUpdate', async () => req);
    mock.method(groupsHelper, 'findById', async () => group);
    mock.method(groupsHelper, 'lockById', async () => group);
    const addMember = mock.method(groupsHelper, 'addMember', async () => [...group.member_ids, req.seeker_id]);
    const updateStatus = mock.method(joinRequestsHelper, 'updateStatus', async (_id, status) => ({ ...req, status, decided_at: 'now' }));
    return { addMember, updateStatus };
  }

  it('adds the seeker to member_ids and marks APPROVED in one transaction', async () => {
    const { addMember, updateStatus } = arrange();
    const result = await service.approve('T-001', 'r-1001');
    assert.deepEqual(addMember.mock.calls[0].arguments, ['G-01', 'T-002', 'TRX']);
    assert.deepEqual(updateStatus.mock.calls[0].arguments, ['R-1001', 'APPROVED', 'TRX']);
    assert.equal(result.status, 'APPROVED');
    assert.equal(result.group.members_count, 2);
    assert.equal(result.group.spots_left, 1);
  });

  it('409 with a clear message when the group filled up meanwhile', async () => {
    const { addMember, updateStatus } = arrange({ group: g01({ member_ids: ['T-001', 'T-003', 'T-004'] }) });
    await assert.rejects(service.approve('T-001', 'R-1001'), (e) => is(409)(e) && /full/i.test(e.message));
    assert.equal(addMember.mock.callCount(), 0);
    assert.equal(updateStatus.mock.callCount(), 0);
  });

  it('403 for a non-owner, 404 for an unknown request', async () => {
    arrange();
    await assert.rejects(service.approve('T-002', 'R-1001'), is(403));
    mock.restoreAll();
    mock.method(joinRequestsHelper, 'findById', async () => undefined);
    await assert.rejects(service.approve('T-001', 'R-404'), is(404));
  });

  it('409 when the request was already decided', async () => {
    const { addMember } = arrange({ req: request({ status: 'REJECTED' }) });
    await assert.rejects(service.approve('T-001', 'R-1001'), is(409));
    assert.equal(addMember.mock.callCount(), 0);
  });
});

describe('joinRequests.service.reject', () => {
  afterEach(() => mock.restoreAll());

  it('marks REJECTED and never touches member_ids', async () => {
    fakeTransaction();
    mock.method(joinRequestsHelper, 'findById', async () => request());
    mock.method(joinRequestsHelper, 'findByIdForUpdate', async () => request());
    mock.method(groupsHelper, 'findById', async () => g01());
    const addMember = mock.method(groupsHelper, 'addMember', async () => []);
    mock.method(joinRequestsHelper, 'updateStatus', async (_id, status) => request({ status, decided_at: 'now' }));
    const result = await service.reject('T-001', 'R-1001');
    assert.equal(result.status, 'REJECTED');
    assert.equal(addMember.mock.callCount(), 0);
  });

  it('403 for a non-owner', async () => {
    mock.method(joinRequestsHelper, 'findById', async () => request());
    mock.method(groupsHelper, 'findById', async () => g01());
    await assert.rejects(service.reject('T-003', 'R-1001'), is(403));
  });
});
