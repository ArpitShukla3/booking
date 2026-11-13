const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const groupsHelper = require('../../../src/helpers/postgres/groups.helper');
const joinRequestsHelper = require('../../../src/helpers/postgres/joinRequests.helper');
const transactionHelper = require('../../../src/helpers/postgres/transaction.helper');
const lookupsHelper = require('../../../src/helpers/postgres/lookups.helper');
const travellersHelper = require('../../../src/helpers/postgres/travellers.helper');
const groupHotelsHelper = require('../../../src/helpers/postgres/groupHotels.helper');
const service = require('../../../src/services/groups.service.ts');

const sarahPost = { name: 'Kyoto temples & street food', city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000, itinerary: 'Day 1 Fushimi Inari' };
const kyoto = { city: 'Kyoto', country_code: 'JP', country_name: 'Japan', timezone: 'Asia/Tokyo' };
const row = (over = {}) => ({ group_id: 'G-1001', owner_id: 'T-001', member_ids: ['T-001'], ...sarahPost, country_name: 'Japan', owner_name: 'Sarah Thomas', owner_gender: 'FEMALE', ...over });

function mockHappyPath() {
  mock.method(lookupsHelper, 'findDestination', async (city) => (city === 'Kyoto' ? kyoto : undefined));
  const insert = mock.method(groupsHelper, 'insert', async () => 'G-1001');
  mock.method(groupsHelper, 'findById', async () => row());
  return insert;
}

describe('groups.service pure rules', () => {
  it('counts nights between ISO dates', () => {
    assert.equal(service.nightsBetween('2027-04-10', '2027-04-15'), 5);
    assert.equal(service.nightsBetween('2027-04-01', '2027-04-20'), 19);
  });
  it('derives the lobby stage from members vs max_size', () => {
    assert.equal(service.stageOf({ member_ids: ['T-001'], max_size: 3 }), 'LOBBY_OPEN');
    assert.equal(service.stageOf({ member_ids: ['T-001', 'T-002', 'T-003'], max_size: 3 }), 'LOBBY_FULL');
    assert.equal(service.stageOf({ member_ids: ['T-001'], max_size: 1 }), 'LOBBY_FULL');
  });
  it('X2: hotel activity outranks the lobby: booked > shortlisted > full > open', () => {
    const open = { member_ids: ['T-001'], max_size: 3 };
    const full = { member_ids: ['T-001', 'T-002'], max_size: 2 };
    assert.equal(service.stageOf(open, { shortlisted: 0, booked: false }), 'LOBBY_OPEN');
    assert.equal(service.stageOf(open, { shortlisted: 1, booked: false }), 'HOTEL_SHORTLISTED');
    assert.equal(service.stageOf(full, { shortlisted: 2, booked: false }), 'HOTEL_SHORTLISTED');
    assert.equal(service.stageOf(open, { shortlisted: 0, booked: true }), 'BOOKED');
    assert.equal(service.stageOf(full, { shortlisted: 3, booked: true }), 'BOOKED');
  });
  it('X2: DTO carries hotel_status (defaults to none) and the derived stage', () => {
    assert.deepEqual(service.toGroupDto(row()).hotel_status, { shortlisted: 0, booked: false });
    const booked = service.toGroupDto(row(), { shortlisted: 1, booked: true });
    assert.equal(booked.stage, 'BOOKED');
    assert.deepEqual(booked.hotel_status, { shortlisted: 1, booked: true });
  });
  it('builds the shared Group DTO', () => {
    const dto = service.toGroupDto(row({ member_ids: ['T-001', 'T-002'] }));
    assert.equal(dto.nights, 5);
    assert.equal(dto.members_count, 2);
    assert.equal(dto.spots_left, 1);
    assert.deepEqual(dto.owner, { traveller_id: 'T-001', name: 'Sarah Thomas', gender: 'FEMALE' });
    assert.equal(dto.country_name, 'Japan');
    assert.equal(dto.stage, 'LOBBY_OPEN');
  });
});

describe('groups.service.createGroup', () => {
  afterEach(() => mock.restoreAll());

  it('creates Sarah\'s post with the owner as the only member', async () => {
    const insert = mockHappyPath();
    const group = await service.createGroup('T-001', sarahPost);
    const saved = insert.mock.calls[0].arguments[0];
    assert.equal(saved.owner_id, 'T-001');
    assert.deepEqual(saved.member_ids, ['T-001']);
    assert.equal('group_id' in saved, false);
    assert.equal(group.group_id, 'G-1001');
    assert.equal(group.spots_left, 2);
  });

  it('ignores owner_id / member_ids sent by the client', async () => {
    const insert = mockHappyPath();
    await assert.rejects(service.createGroup('T-001', { ...sarahPost, owner_id: 'T-009', member_ids: ['T-009'] }), (e) => e.status === 400);
    assert.equal(insert.mock.callCount(), 0);
  });

  it('trims the name and stores an empty itinerary as null', async () => {
    const insert = mockHappyPath();
    await service.createGroup('T-001', { ...sarahPost, name: '  Kyoto crew ', itinerary: '   ' });
    const saved = insert.mock.calls[0].arguments[0];
    assert.equal(saved.name, 'Kyoto crew');
    assert.equal(saved.itinerary, null);
  });

  const invalid = [
    ['name', { name: '   ' }],
    ['max_size', { max_size: 0 }],
    ['max_size', { max_size: 5 }],
    ['max_size', { max_size: 2.5 }],
    ['budget_inr', { budget_inr: 0 }],
    ['budget_inr', { budget_inr: -100 }],
    ['budget_inr', { budget_inr: 1000.5 }],
    ['check_in', { check_in: '2027-03-31' }],
    ['check_out', { check_out: '2027-04-21' }],
    ['check_out', { check_in: '2027-04-15', check_out: '2027-04-10' }],
    ['check_out', { check_in: '2027-04-10', check_out: '2027-04-10' }],
    ['check_in', { check_in: '2027-02-30' }],
    ['check_in', { check_in: '10/04/2027' }],
    ['city', { city: '' }],
  ];
  for (const [field, patch] of invalid) {
    it(`rejects ${JSON.stringify(patch)} with a ${field} field error and writes nothing`, async () => {
      const insert = mockHappyPath();
      await assert.rejects(service.createGroup('T-001', { ...sarahPost, ...patch }), (e) => e.status === 400 && typeof e.fields[field] === 'string');
      assert.equal(insert.mock.callCount(), 0);
    });
  }

  it('accepts the window edges 2027-04-01 → 2027-04-20 and sizes 1 and 4', async () => {
    mockHappyPath();
    await service.createGroup('T-001', { ...sarahPost, check_in: '2027-04-01', check_out: '2027-04-20', max_size: 1 });
    await service.createGroup('T-001', { ...sarahPost, max_size: 4 });
  });

  it('rejects a city outside the data with a readable message', async () => {
    const insert = mockHappyPath();
    await assert.rejects(service.createGroup('T-001', { ...sarahPost, city: 'Paris' }), (e) => e.status === 400 && /Tokyo|Kyoto|choose/i.test(e.fields.city));
    assert.equal(insert.mock.callCount(), 0);
  });

  it('reports every invalid field at once', async () => {
    mockHappyPath();
    await assert.rejects(service.createGroup('T-001', { ...sarahPost, name: '', max_size: 9, budget_inr: 0 }), (e) => ['name', 'max_size', 'budget_inr'].every((f) => f in e.fields));
  });
});

const booking = { booking_id: 'BK-1001', hotel_id: 'HTL-KYO-001', hotel_name: 'Gion Corner Hotel', room_name: 'Twin Room', rooms_count: 1, nights: 5, total_inr: 23800, per_member_inr: 11900, booked_at: 'now' };
const noHotels = () => mock.method(groupHotelsHelper, 'hotelStatusByGroups', async () => ({}));

describe('groups.service reads', () => {
  afterEach(() => mock.restoreAll());

  it('getGroup returns 404 for an unknown group', async () => {
    mock.method(groupsHelper, 'findById', async () => undefined);
    await assert.rejects(service.getGroup('G-9999'), (e) => e.status === 404);
  });

  it('getGroup adds member profiles, owner first', async () => {
    mock.method(groupsHelper, 'findById', async () => row({ member_ids: ['T-001', 'T-002'] }));
    mock.method(travellersHelper, 'findByIds', async () => [{ traveller_id: 'T-002', name: 'Priya' }, { traveller_id: 'T-001', name: 'Sarah' }]);
    noHotels();
    const group = await service.getGroup('G-1001');
    assert.deepEqual(group.members.map((m) => m.traveller_id), ['T-001', 'T-002']);
  });

  it('listMyGroups marks the role and counts pending requests only on owned groups', async () => {
    mock.method(groupsHelper, 'listForTraveller', async () => [row(), row({ group_id: 'G-02', owner_id: 'T-003', member_ids: ['T-003', 'T-001'] })]);
    const count = mock.method(joinRequestsHelper, 'countPendingByGroups', async () => ({ 'G-1001': 2, 'G-02': 5 }));
    noHotels();
    const groups = await service.listMyGroups('T-001');
    assert.deepEqual(groups.map((g) => g.my_role), ['OWNER', 'MEMBER']);
    assert.deepEqual(count.mock.calls[0].arguments[0], ['G-1001']);
    assert.deepEqual(groups.map((g) => g.pending_requests), [2, 0]);
  });

  it('listMyGroups shows 0 when an owned group has no pending requests', async () => {
    mock.method(groupsHelper, 'listForTraveller', async () => [row()]);
    mock.method(joinRequestsHelper, 'countPendingByGroups', async () => ({}));
    noHotels();
    assert.equal((await service.listMyGroups('T-001'))[0].pending_requests, 0);
  });

  it('X2: listMyGroups reads hotel status for all groups in one call and returns the live stage + booking', async () => {
    mock.method(groupsHelper, 'listForTraveller', async () => [row(), row({ group_id: 'G-02' }), row({ group_id: 'G-03' })]);
    mock.method(joinRequestsHelper, 'countPendingByGroups', async () => ({}));
    const status = mock.method(groupHotelsHelper, 'hotelStatusByGroups', async () => ({
      'G-1001': { shortlisted: 2, booking },
      'G-02': { shortlisted: 1, booking: null },
    }));
    const groups = await service.listMyGroups('T-001');
    assert.equal(status.mock.callCount(), 1);
    assert.deepEqual(status.mock.calls[0].arguments[0], ['G-1001', 'G-02', 'G-03']);
    assert.deepEqual(groups.map((g) => g.stage), ['BOOKED', 'HOTEL_SHORTLISTED', 'LOBBY_OPEN']);
    assert.deepEqual(groups[0].booking, booking);
    assert.equal(groups[1].booking, null);
    assert.deepEqual(groups[1].hotel_status, { shortlisted: 1, booked: false });
  });

  it('X2: getGroup (public) shows stage + hotel_status but never the booking details', async () => {
    mock.method(groupsHelper, 'findById', async () => row());
    mock.method(travellersHelper, 'findByIds', async () => []);
    mock.method(groupHotelsHelper, 'hotelStatusByGroups', async () => ({ 'G-1001': { shortlisted: 1, booking } }));
    const group = await service.getGroup('G-1001');
    assert.equal(group.stage, 'BOOKED');
    assert.deepEqual(group.hotel_status, { shortlisted: 1, booked: true });
    assert.equal('booking' in group, false);
  });
});

describe('groups.service.removeMember / leaveGroup', () => {
  afterEach(() => mock.restoreAll());
  const twoMembers = () => row({ member_ids: ['T-001', 'T-002'] });

  function arrange({ group = twoMembers(), booking } = {}) {
    mock.method(transactionHelper, 'withTransaction', async (work) => work('TRX'));
    mock.method(groupsHelper, 'findById', async () => group);
    mock.method(groupsHelper, 'lockById', async () => group);
    const remove = mock.method(groupsHelper, 'removeMember', async (_g, id) => (group.member_ids.includes(id) ? group.member_ids.filter((m) => m !== id) : undefined));
    const mark = mock.method(joinRequestsHelper, 'markMembershipEnded', async () => ({}));
    mock.method(groupHotelsHelper, 'findBooking', async () => booking);
    const split = mock.method(groupHotelsHelper, 'updateBookingSplit', async () => ({}));
    return { remove, mark, split };
  }

  it('perMemberShare rounds to the nearest rupee and never divides by zero', () => {
    assert.equal(service.perMemberShare(23800, 2), 11900);
    assert.equal(service.perMemberShare(10000, 3), 3333);
    assert.equal(service.perMemberShare(10001, 2), 5001);
    assert.equal(service.perMemberShare(5000, 0), 5000);
  });

  it('owner removes a member: member_ids shrink and the request is REMOVED in one transaction', async () => {
    const { remove, mark, split } = arrange();
    const group = await service.removeMember('T-001', 'g-1001', 't-002');
    assert.deepEqual(remove.mock.calls[0].arguments, ['G-1001', 'T-002', 'TRX']);
    assert.deepEqual(mark.mock.calls[0].arguments, ['G-1001', 'T-002', 'REMOVED', 'TRX']);
    assert.deepEqual(group.member_ids, ['T-001']);
    assert.equal(group.spots_left, 2);
    assert.equal(group.booking_update, null);
    assert.equal(split.mock.callCount(), 0);
  });

  it('after booking: same total re-split over the remaining members', async () => {
    const { split } = arrange({ booking: { booking_id: 'BK-1001', total_inr: 23800, per_member_inr: 11900, members_count: 2 } });
    const group = await service.removeMember('T-001', 'G-1001', 'T-002');
    assert.deepEqual(split.mock.calls[0].arguments, ['G-1001', 1, 23800, 'TRX']);
    assert.deepEqual(group.booking_update, { booking_id: 'BK-1001', total_inr: 23800, members_count: 1, per_member_before: 11900, per_member_after: 23800 });
  });

  it('403 for a non-owner, 400 for removing the owner, 404 for a non-member or unknown group', async () => {
    const { remove } = arrange();
    await assert.rejects(service.removeMember('T-002', 'G-1001', 'T-002'), (e) => e.status === 403);
    await assert.rejects(service.removeMember('T-001', 'G-1001', 'T-001'), (e) => e.status === 400);
    assert.equal(remove.mock.callCount(), 0);
    await assert.rejects(service.removeMember('T-001', 'G-1001', 'T-009'), (e) => e.status === 404);
    mock.restoreAll();
    mock.method(groupsHelper, 'findById', async () => undefined);
    await assert.rejects(service.removeMember('T-001', 'G-404', 'T-002'), (e) => e.status === 404);
  });

  it('does not mark the request when the traveller was not a member', async () => {
    const { mark } = arrange();
    await assert.rejects(service.removeMember('T-001', 'G-1001', 'T-009'));
    assert.equal(mark.mock.callCount(), 0);
  });

  it('a member leaves: LEFT is recorded and the booking re-split', async () => {
    const { mark, split } = arrange({ group: row({ member_ids: ['T-001', 'T-002', 'T-003'] }), booking: { booking_id: 'BK-1', total_inr: 30000, per_member_inr: 10000, members_count: 3 } });
    const group = await service.leaveGroup('T-003', 'G-1001');
    assert.deepEqual(mark.mock.calls[0].arguments, ['G-1001', 'T-003', 'LEFT', 'TRX']);
    assert.deepEqual(split.mock.calls[0].arguments, ['G-1001', 2, 15000, 'TRX']);
    assert.deepEqual(group.member_ids, ['T-001', 'T-002']);
  });

  it('the owner cannot leave (400); a non-member gets 404', async () => {
    const { remove } = arrange();
    await assert.rejects(service.leaveGroup('T-001', 'G-1001'), (e) => e.status === 400);
    await assert.rejects(service.leaveGroup('T-009', 'G-1001'), (e) => e.status === 404);
    assert.equal(remove.mock.callCount(), 0);
  });
});
