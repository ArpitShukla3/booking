import { describe, expect, it, vi } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import { ApiError } from '@/lib/api';
import { createGroupHotelStore, entryKey } from '@/store/useGroupHotelStore';
import type { GroupHotelApi } from '@/services/groupHotelService';
import type { HotelOption, HotelResult, HotelSearch } from '@/types/hotel';
import { activeFilterCount, applyFilters, DEFAULT_FILTERS, priceBounds, priceBrackets, ratingWord } from './hotelFilters';
import { mockReviews, timeAgo } from './mockReviews';
import { parseCredits } from './credits';
import { tripSteps } from '@/features/groups/tripFlow';

const option = (over: Partial<HotelOption> = {}): HotelOption => ({
  room_id: 'RM-1', room_type: 'TWIN', name: 'Twin Room', max_adults: 2, max_children: 0, price_per_night_inr: 4760,
  refundable: true, rooms_needed: 1, nights: 5, total_inr: 23800, per_member_inr: 11900, available: true, min_rooms_left: 2, ...over,
});
const hotel = (over: Partial<HotelResult> = {}): HotelResult => ({
  hotel_id: 'H-1', name: 'Gion Corner Hotel', area: 'Gion', city: 'Kyoto', stars: 3, rating: 7.8, lat: 35, lng: 135,
  image: 'images/hotels/HOTEL-BUSINESS-1.jpg', check_in_from: '15:00', check_out_until: '11:00', family_friendly: false,
  options: [option()], from_per_member_inr: 11900, ...over,
});
const gion = hotel();
const hills = hotel({ hotel_id: 'H-2', name: 'Kyoto Hills Hotel', area: 'Higashiyama', stars: 4, rating: 8.4,
  options: [option({ room_id: 'RM-2', price_per_night_inr: 9000, total_inr: 45000, per_member_inr: 22500, refundable: false })] });
const soldOut = hotel({ hotel_id: 'H-3', name: 'Sold Out Inn', options: [option({ room_id: 'RM-3', available: false, per_member_inr: 5000 })] });

describe('hotel filters (view only)', () => {
  it('search matches hotel name or area, case-insensitive', () => {
    expect(applyFilters([gion, hills], { ...DEFAULT_FILTERS, query: 'higashi' }).map((m) => m.hotel.name)).toEqual(['Kyoto Hills Hotel']);
    expect(applyFilters([gion, hills], { ...DEFAULT_FILTERS, query: 'GION' })).toHaveLength(1);
  });
  it('price per night range is inclusive', () => {
    expect(applyFilters([gion, hills], { ...DEFAULT_FILTERS, priceMin: 4760, priceMax: 4760 }).map((m) => m.hotel.hotel_id)).toEqual(['H-1']);
    expect(applyFilters([gion, hills], { ...DEFAULT_FILTERS, priceMin: 5000 }).map((m) => m.hotel.hotel_id)).toEqual(['H-2']);
  });
  it('hides sold-out options unless asked; stars and refundable filters', () => {
    expect(applyFilters([gion, soldOut], DEFAULT_FILTERS).map((m) => m.hotel.hotel_id)).toEqual(['H-1']);
    expect(applyFilters([gion, soldOut], { ...DEFAULT_FILTERS, availableOnly: false })).toHaveLength(2);
    expect(applyFilters([gion, hills], { ...DEFAULT_FILTERS, stars: [4] }).map((m) => m.hotel.hotel_id)).toEqual(['H-2']);
    expect(applyFilters([gion, hills], { ...DEFAULT_FILTERS, refundableOnly: true }).map((m) => m.hotel.hotel_id)).toEqual(['H-1']);
  });
  it('sorts by per-member price and rating; available ranks first in recommended', () => {
    expect(applyFilters([hills, gion], { ...DEFAULT_FILTERS, sort: 'price_asc' }).map((m) => m.hotel.hotel_id)).toEqual(['H-1', 'H-2']);
    expect(applyFilters([gion, hills], { ...DEFAULT_FILTERS, sort: 'rating' })[0].hotel.hotel_id).toBe('H-2');
    expect(applyFilters([soldOut, gion], { ...DEFAULT_FILTERS, availableOnly: false })[0].hotel.hotel_id).toBe('H-1');
  });
  it('price bounds, brackets and active count', () => {
    expect(priceBounds([gion, hills])).toEqual({ min: 4500, max: 9000 });
    expect(priceBrackets([gion, hills]).map((b) => b.label)).toEqual(['Under ₹5,000', '₹5,000 & above']);
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, query: 'x', priceMax: 1, stars: [3] })).toBe(3);
    expect(ratingWord(8.4)).toBe('Very good');
  });
});

describe('mock reviews', () => {
  it('are deterministic per hotel and have nested comments', () => {
    const a = mockReviews(gion);
    expect(mockReviews(gion)).toEqual(a);
    expect(a.length).toBeGreaterThanOrEqual(4);
    expect(a.every((r) => r.rating >= 5 && r.rating <= 10)).toBe(true);
    expect(timeAgo('2026-11-01T00:00:00Z', Date.parse('2026-11-04T00:00:00Z'))).toBe('3 days ago');
  });
});

describe('credits parser', () => {
  it('reads the ATTRIBUTIONS.md table rows with links', () => {
    const md = '| File | Used for |\n|---|---|\n| `images/hotels/HOTEL-CAPSULE-1.jpg` | Namba Capsule Plus | [A.jpg](https://x/a) | Syced | [CC0](http://cc0) |\n';
    expect(parseCredits(md)).toEqual([{ file: 'images/hotels/HOTEL-CAPSULE-1.jpg', usedFor: 'Namba Capsule Plus',
      source: { text: 'A.jpg', href: 'https://x/a' }, author: 'Syced', license: { text: 'CC0', href: 'http://cc0' } }]);
  });
});

describe('trip progress with hotels', () => {
  const g = { stage: 'LOBBY_OPEN' as const, members_count: 2, max_size: 3, spots_left: 1 };
  it('booking completes hotel and booked steps', () => {
    const steps = tripSteps(g, { shortlisted: 1, bookedHotel: 'Gion Corner Hotel' });
    expect(steps.find((s) => s.key === 'booked')?.state).toBe('done');
    expect(steps.find((s) => s.key === 'hotel')?.detail).toBe('Gion Corner Hotel');
  });
  it('a shortlist makes "Hotel fixed" current', () => {
    expect(tripSteps(g, { shortlisted: 2, bookedHotel: null }).find((s) => s.key === 'hotel')?.state).toBe('current');
  });
});

describe('useGroupHotelStore', () => {
  const search: HotelSearch = { group_id: 'G-01', city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', nights: 5, members_count: 2, budget_inr: 60000, hotels: [gion] };
  const memory = (): StateStorage & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
  };
  const api = (over: Partial<GroupHotelApi> = {}): GroupHotelApi => ({
    searchHotels: vi.fn(async () => search), listSaved: vi.fn(async () => []), getBooking: vi.fn(async () => null),
    save: vi.fn(async () => []), unsave: vi.fn(async () => []), book: vi.fn(async () => { throw new Error('unused'); }), ...over,
  });

  it('loads hotels, shortlist and booking per traveller+group and persists them', async () => {
    const storage = memory();
    const store = createGroupHotelStore(api(), storage);
    await store.getState().load('T-001', 'G-01');
    expect(store.getState().entries[entryKey('T-001', 'G-01')].search?.hotels).toHaveLength(1);
    expect(Object.values(storage.data)[0]).toContain('Gion Corner Hotel');
  });

  it('dedupes concurrent loads', async () => {
    const a = api();
    const store = createGroupHotelStore(a, memory());
    await Promise.all([store.getState().load('T-001', 'G-01'), store.getState().load('T-001', 'G-01')]);
    expect(a.searchHotels).toHaveBeenCalledTimes(1);
  });

  it('403 marks the group forbidden and drops cached data', async () => {
    const store = createGroupHotelStore(api({ searchHotels: vi.fn(async () => { throw new ApiError('Members only', 403); }) }), memory());
    await store.getState().load('T-009', 'G-01');
    expect(store.getState().status[entryKey('T-009', 'G-01')].forbidden).toBe(true);
  });

  it('filters persist per group and merge with defaults', () => {
    const storage = memory();
    const store = createGroupHotelStore(api(), storage);
    store.getState().setFilters('g-01', { priceMax: 5000 });
    expect(store.getState().filters['G-01']).toEqual({ ...DEFAULT_FILTERS, priceMax: 5000 });
    expect(Object.values(storage.data)[0]).toContain('"priceMax":5000');
  });

  it('save replaces the shortlist with the server response', async () => {
    const saved = [{ room_id: 'RM-1' }] as never;
    const store = createGroupHotelStore(api({ save: vi.fn(async () => saved) }), memory());
    await store.getState().save('T-001', 'G-01', 'RM-1');
    expect(store.getState().entries[entryKey('T-001', 'G-01')].shortlist).toBe(saved);
    expect(store.getState().busy).toEqual({});
  });
});
