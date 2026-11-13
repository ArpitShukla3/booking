const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../../../src/services/hotelPricing.service.ts');

describe('hotelPricing.roomsNeeded = ceil(members / max_adults)', () => {
  it('2 members in a twin → 1 room', () => assert.equal(pricing.roomsNeeded(2, 2), 1));
  it('3 members in a twin → 2 rooms', () => assert.equal(pricing.roomsNeeded(3, 2), 2));
  it('1 member in a single → 1 room', () => assert.equal(pricing.roomsNeeded(1, 1), 1));
  it('4 members in a triple → 2 rooms', () => assert.equal(pricing.roomsNeeded(4, 3), 2));
  it('4 members in a family room for 4 → 1 room', () => assert.equal(pricing.roomsNeeded(4, 4), 1));
});

describe('hotelPricing.priceStay', () => {
  it('G-01 worked example: Twin ₹4,760 × 1 room × 5 nights = ₹23,800 → ₹11,900 each', () => {
    assert.deepEqual(pricing.priceStay({ price_per_night_amount: 4760, max_adults: 2 }, 2, 5), {
      rooms_needed: 1, total_inr: 23800, per_member_inr: 11900,
    });
  });
  it('3 members, twin, 4 nights → 2 rooms', () => {
    assert.deepEqual(pricing.priceStay({ price_per_night_amount: 5000, max_adults: 2 }, 3, 4), {
      rooms_needed: 2, total_inr: 40000, per_member_inr: 13333,
    });
  });
  it('per member is rounded to the nearest rupee', () => {
    assert.equal(pricing.priceStay({ price_per_night_amount: 1001, max_adults: 3 }, 3, 1).per_member_inr, 334);
  });
});

describe('hotelPricing.isAvailable: rooms_left ≥ rooms needed on EVERY night', () => {
  it('enough rooms on all 5 nights → true', () => {
    assert.equal(pricing.isAvailable({ nights_with_data: 5, min_rooms_left: 2 }, 5, 1), true);
  });
  it('exactly the rooms needed on the tightest night → true', () => {
    assert.equal(pricing.isAvailable({ nights_with_data: 5, min_rooms_left: 2 }, 5, 2), true);
  });
  it('one night short → false', () => {
    assert.equal(pricing.isAvailable({ nights_with_data: 5, min_rooms_left: 1 }, 5, 2), false);
  });
  it('a sold-out night (0 left) → false', () => {
    assert.equal(pricing.isAvailable({ nights_with_data: 5, min_rooms_left: 0 }, 5, 1), false);
  });
  it('a night with no availability row counts as not available', () => {
    assert.equal(pricing.isAvailable({ nights_with_data: 4, min_rooms_left: 9 }, 5, 1), false);
  });
  it('null min (no rows at all) → false', () => {
    assert.equal(pricing.isAvailable({ nights_with_data: 0, min_rooms_left: null }, 3, 1), false);
  });
});
