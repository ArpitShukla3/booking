const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const groupsHelper = require('../../../src/helpers/postgres/groups.helper');
const groupHotelsHelper = require('../../../src/helpers/postgres/groupHotels.helper');
const transactionHelper = require('../../../src/helpers/postgres/transaction.helper');
const reviewsHelper = require('../../../src/helpers/postgres/reviews.helper');
const HttpError = require('../../../src/utils/HttpError');
const service = require('../../../src/services/groupHotels.service.ts');

const g01 = (over = {}) => ({
  group_id: 'G-01', name: 'Kyoto Spring Temples', owner_id: 'T-001', member_ids: ['T-001', 'T-002'], max_size: 3,
  city: 'Kyoto', country_name: 'Japan', check_in: '2027-04-10', check_out: '2027-04-15', budget_inr: 60000,
  itinerary: null, owner_name: 'Sarah Thomas', owner_gender: 'FEMALE', ...over,
});
const stay = (over = {}) => ({
  hotel_id: 'HTL-KYO-001', hotel_name: 'Gion Corner Hotel', area: 'Gion', stars: 3, rating: 7.8,
  lat: 35.0037, lng: 135.7788, image: 'images/hotels/HOTEL-BUSINESS-1.jpg', check_in_from: '15:00',
  check_out_until: '11:00', family_friendly: false,
  room_id: 'RM-KYO-001-A', room_type: 'TWIN', room_name: 'Twin Room', max_adults: 2, max_children: 0,
  price_per_night_amount: 4760, refundable: true, nights_with_data: 5, min_rooms_left: 2, ...over,
});
const is = (status) => (err) => err instanceof HttpError && err.status === status;
const fakeTransaction = () => mock.method(transactionHelper, 'withTransaction', async (work) => work('TRX'));

describe('groupHotels.service access', () => {
  afterEach(() => mock.restoreAll());

  it('404 for an unknown group', async () => {
    mock.method(groupsHelper, 'findById', async () => undefined);
    await assert.rejects(service.searchHotels('T-001', 'G-99'), is(404));
  });

  it('403 for a traveller who is not a member', async () => {
    mock.method(groupsHelper, 'findById', async () => g01());
    const list = mock.method(groupHotelsHelper, 'listRoomStays', async () => []);
    await assert.rejects(service.searchHotels('T-009', 'G-01'), is(403));
    assert.equal(list.mock.callCount(), 0);
  });
});

describe('groupHotels.service.searchHotels', () => {
  afterEach(() => mock.restoreAll());
  const noReviews = () => mock.method(reviewsHelper, 'countBySubjects', async () => ({}));

  it('prices every room for the group and groups them by hotel', async () => {
    noReviews();
    mock.method(groupsHelper, 'findById', async () => g01());
    const list = mock.method(groupHotelsHelper, 'listRoomStays', async () => [
      stay(),
      stay({ room_id: 'RM-KYO-001-B', room_type: 'DOUBLE', room_name: 'Double Room', price_per_night_amount: 4984, min_rooms_left: 0 }),
    ]);
    const result = await service.searchHotels('T-002', 'g-01');
    assert.deepEqual(list.mock.calls[0].arguments, ['Kyoto', '2027-04-10', '2027-04-15']);
    assert.equal(result.nights, 5);
    assert.equal(result.members_count, 2);
    assert.equal(result.hotels.length, 1);
    const [hotel] = result.hotels;
    assert.equal(hotel.name, 'Gion Corner Hotel');
    assert.equal(hotel.image, 'images/hotels/HOTEL-BUSINESS-1.jpg');
    const twin = hotel.options.find((o) => o.room_id === 'RM-KYO-001-A');
    assert.equal(twin.total_inr, 23800);
    assert.equal(twin.per_member_inr, 11900);
    assert.equal(twin.rooms_needed, 1);
    assert.equal(twin.available, true);
    assert.equal(hotel.options.find((o) => o.room_id === 'RM-KYO-001-B').available, false);
  });

  it('cheapest available per-member price is reported per hotel (null when none)', async () => {
    noReviews();
    mock.method(groupsHelper, 'findById', async () => g01());
    mock.method(groupHotelsHelper, 'listRoomStays', async () => [
      stay({ min_rooms_left: 0 }),
      stay({ hotel_id: 'HTL-KYO-002', hotel_name: 'Kyoto Hills Hotel', room_id: 'RM-KYO-002-A', price_per_night_amount: 6000 }),
    ]);
    const { hotels } = await service.searchHotels('T-001', 'G-01');
    assert.equal(hotels.find((h) => h.hotel_id === 'HTL-KYO-001').from_per_member_inr, null);
    assert.equal(hotels.find((h) => h.hotel_id === 'HTL-KYO-002').from_per_member_inr, 15000);
  });

  it('TASK-X3: each hotel carries its stored review count (0 when none), from one query', async () => {
    mock.method(groupsHelper, 'findById', async () => g01());
    mock.method(groupHotelsHelper, 'listRoomStays', async () => [stay(), stay({ hotel_id: 'HTL-KYO-002', room_id: 'RM-KYO-002-A' })]);
    const counts = mock.method(reviewsHelper, 'countBySubjects', async () => ({ 'HTL-KYO-001': 5 }));
    const { hotels } = await service.searchHotels('T-001', 'G-01');
    assert.deepEqual(counts.mock.calls[0].arguments, ['HOTEL', ['HTL-KYO-001', 'HTL-KYO-002']]);
    assert.deepEqual(hotels.map((h) => h.review_count), [5, 0]);
  });
});

describe('groupHotels.service shortlist', () => {
  afterEach(() => mock.restoreAll());

  function setup({ booking, saved = [] } = {}) {
    mock.method(groupsHelper, 'findById', async () => g01());
    mock.method(groupHotelsHelper, 'findBooking', async () => booking);
    mock.method(groupHotelsHelper, 'listRoomStays', async () => [stay()]);
    mock.method(groupHotelsHelper, 'listSaved', async () => saved);
  }

  it('400 with a field error when room_id is missing', async () => {
    setup();
    await assert.rejects(service.saveOption('T-001', 'G-01', {}), (e) => is(400)(e) && 'room_id' in e.fields);
  });

  it('409 once the group is booked', async () => {
    setup({ booking: { booking_id: 'BK-1001' } });
    await assert.rejects(service.saveOption('T-001', 'G-01', { room_id: 'RM-KYO-001-A' }), is(409));
  });

  it('404 for a room that is not in the group city', async () => {
    setup();
    mock.method(groupHotelsHelper, 'findRoomStay', async () => undefined);
    await assert.rejects(service.saveOption('T-001', 'G-01', { room_id: 'RM-TYO-001-A' }), is(404));
  });

  it('409 when the room is not available for every night', async () => {
    setup();
    mock.method(groupHotelsHelper, 'findRoomStay', async () => stay({ min_rooms_left: 0 }));
    await assert.rejects(service.saveOption('T-001', 'G-01', { room_id: 'RM-KYO-001-A' }), is(409));
  });

  it('stores the priced snapshot and saved_by = caller', async () => {
    setup();
    mock.method(groupHotelsHelper, 'findRoomStay', async () => stay());
    const insert = mock.method(groupHotelsHelper, 'insertSaved', async (row) => ({ id: 1, ...row }));
    await service.saveOption('T-002', 'G-01', { room_id: 'rm-kyo-001-a' });
    assert.deepEqual(insert.mock.calls[0].arguments[0], {
      group_id: 'G-01', room_id: 'RM-KYO-001-A', saved_by: 'T-002', rooms_count: 1, nights: 5, total_inr: 23800, per_member_inr: 11900,
    });
  });

  it('409 when the caller already saved this room', async () => {
    setup();
    mock.method(groupHotelsHelper, 'findRoomStay', async () => stay());
    mock.method(groupHotelsHelper, 'insertSaved', async () => undefined);
    await assert.rejects(service.saveOption('T-002', 'G-01', { room_id: 'RM-KYO-001-A' }), is(409));
  });

  it('listSaved merges savers of the same room and counts alignment', async () => {
    setup({ saved: [
      { room_id: 'RM-KYO-001-A', saved_by: 'T-001', saver_name: 'Sarah Thomas', created_at: 'a' },
      { room_id: 'RM-KYO-001-A', saved_by: 'T-002', saver_name: 'Priya Shah', created_at: 'b' },
    ] });
    const list = await service.listSaved('T-002', 'G-01');
    assert.equal(list.length, 1);
    assert.equal(list[0].alignment, 2);
    assert.equal(list[0].saved_by_me, true);
    assert.deepEqual(list[0].saved_by.map((s) => s.name), ['Sarah Thomas', 'Priya Shah']);
    assert.equal(list[0].per_member_inr, 11900);
    assert.equal(list[0].within_budget, true);
  });

  it('removeOption → 404 when the caller had not saved it', async () => {
    setup();
    mock.method(groupHotelsHelper, 'deleteSaved', async () => 0);
    await assert.rejects(service.removeOption('T-002', 'G-01', 'RM-KYO-001-A'), is(404));
  });
});

describe('groupHotels.service.book', () => {
  afterEach(() => mock.restoreAll());

  function setup({ existing, roomStay = stay() } = {}) {
    fakeTransaction();
    mock.method(groupsHelper, 'findById', async () => g01());
    const lock = mock.method(groupsHelper, 'lockById', async () => g01());
    mock.method(groupHotelsHelper, 'findBooking', async () => existing);
    mock.method(groupHotelsHelper, 'findRoomStay', async () => roomStay);
    const insert = mock.method(groupHotelsHelper, 'insertBooking', async (row) => ({ booking_id: 'BK-1001', ...row }));
    return { lock, insert };
  }

  it('creates ONE booking with the G-01 worked-example amounts, inside a transaction', async () => {
    const { lock, insert } = setup();
    await service.book('T-002', 'G-01', { room_id: 'RM-KYO-001-A' });
    assert.equal(lock.mock.calls[0].arguments[1], 'TRX');
    assert.deepEqual(insert.mock.calls[0].arguments, [{
      group_id: 'G-01', room_id: 'RM-KYO-001-A', rooms_count: 1, nights: 5, total_inr: 23800,
      per_member_inr: 11900, members_count: 2, booked_by: 'T-002',
    }, 'TRX']);
  });

  it('409 when the group already has a booking', async () => {
    const { insert } = setup({ existing: { booking_id: 'BK-1001' } });
    await assert.rejects(service.book('T-001', 'G-01', { room_id: 'RM-KYO-001-A' }), is(409));
    assert.equal(insert.mock.callCount(), 0);
  });

  it('409 when availability changed and a night is now short', async () => {
    const { insert } = setup({ roomStay: stay({ min_rooms_left: 0 }) });
    await assert.rejects(service.book('T-001', 'G-01', { room_id: 'RM-KYO-001-A' }), is(409));
    assert.equal(insert.mock.callCount(), 0);
  });

  it('409 when a parallel booking won the unique(group_id) race', async () => {
    setup();
    mock.method(groupHotelsHelper, 'insertBooking', async () => undefined);
    await assert.rejects(service.book('T-001', 'G-01', { room_id: 'RM-KYO-001-A' }), is(409));
  });

  it('403 for a non-member, before any write', async () => {
    const { insert } = setup();
    await assert.rejects(service.book('T-009', 'G-01', { room_id: 'RM-KYO-001-A' }), is(403));
    assert.equal(insert.mock.callCount(), 0);
  });
});
