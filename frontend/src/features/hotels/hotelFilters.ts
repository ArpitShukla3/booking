import type { HotelOption, HotelResult } from '@/types/hotel';

/**
 * View-only filtering and ordering of the backend's priced results.
 * All pricing and availability is calculated by the backend; this only decides what to show.
 */
export type HotelSort = 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'stars';

export interface HotelFilters {
  query: string;
  /** Price per room per night, inclusive. null = no bound. */
  priceMin: number | null;
  priceMax: number | null;
  stars: number[];
  refundableOnly: boolean;
  availableOnly: boolean;
  sort: HotelSort;
}

export const DEFAULT_FILTERS: HotelFilters = {
  query: '', priceMin: null, priceMax: null, stars: [], refundableOnly: false, availableOnly: true, sort: 'recommended',
};

export interface HotelMatch {
  hotel: HotelResult;
  /** The option to feature on the card: cheapest per member among those that pass the filters (available first). */
  best: HotelOption;
  matching: number;
}

const byOptionPreference = (a: HotelOption, b: HotelOption) =>
  Number(b.available) - Number(a.available) || a.per_member_inr - b.per_member_inr;

function optionPasses(o: HotelOption, f: HotelFilters): boolean {
  if (f.priceMin !== null && o.price_per_night_inr < f.priceMin) return false;
  if (f.priceMax !== null && o.price_per_night_inr > f.priceMax) return false;
  if (f.refundableOnly && !o.refundable) return false;
  if (f.availableOnly && !o.available) return false;
  return true;
}

export function textMatches(hotel: Pick<HotelResult, 'name' | 'area'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${hotel.name} ${hotel.area}`.toLowerCase().includes(q);
}

const SORTS: Record<HotelSort, (a: HotelMatch, b: HotelMatch) => number> = {
  // Bookable first, then the best value for rating (rating per ₹1,000 per member).
  recommended: (a, b) => Number(b.best.available) - Number(a.best.available)
    || b.hotel.rating / b.best.per_member_inr - a.hotel.rating / a.best.per_member_inr,
  price_asc: (a, b) => a.best.per_member_inr - b.best.per_member_inr,
  price_desc: (a, b) => b.best.per_member_inr - a.best.per_member_inr,
  rating: (a, b) => b.hotel.rating - a.hotel.rating || a.best.per_member_inr - b.best.per_member_inr,
  stars: (a, b) => b.hotel.stars - a.hotel.stars || b.hotel.rating - a.hotel.rating,
};

export function applyFilters(hotels: HotelResult[], f: HotelFilters): HotelMatch[] {
  const out: HotelMatch[] = [];
  for (const hotel of hotels) {
    if (!textMatches(hotel, f.query)) continue;
    if (f.stars.length && !f.stars.includes(hotel.stars)) continue;
    const options = hotel.options.filter((o) => optionPasses(o, f)).sort(byOptionPreference);
    if (!options.length) continue;
    out.push({ hotel, best: options[0], matching: options.length });
  }
  return out.sort(SORTS[f.sort]);
}

/** Slider bounds over every option, rounded out to ₹500. */
export function priceBounds(hotels: HotelResult[]): { min: number; max: number } {
  const prices = hotels.flatMap((h) => h.options.map((o) => o.price_per_night_inr));
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.floor(Math.min(...prices) / 500) * 500, max: Math.ceil(Math.max(...prices) / 500) * 500 };
}

/** Histogram of per-night prices (Booking.com "Your budget" bars). */
export function priceHistogram(hotels: HotelResult[], bins = 24): number[] {
  const { min, max } = priceBounds(hotels);
  const counts = Array.from({ length: bins }, () => 0);
  if (max <= min) return counts;
  for (const o of hotels.flatMap((h) => h.options)) {
    const i = Math.min(bins - 1, Math.floor(((o.price_per_night_inr - min) / (max - min)) * bins));
    counts[i] += 1;
  }
  return counts;
}

export interface PriceBracket { label: string; min: number | null; max: number | null }

/** Amazon-style quick ranges, adapted to the prices actually on offer. */
export function priceBrackets(hotels: HotelResult[]): PriceBracket[] {
  const { min, max } = priceBounds(hotels);
  if (max <= min) return [];
  const steps = [5000, 10000, 20000, 40000].filter((s) => s > min && s < max);
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const brackets: PriceBracket[] = [];
  let lower: number | null = null;
  for (const s of steps) {
    brackets.push({ label: lower === null ? `Under ${inr(s)}` : `${inr(lower)} – ${inr(s)}`, min: lower, max: s });
    lower = s;
  }
  brackets.push({ label: lower === null ? 'Any price' : `${inr(lower)} & above`, min: lower, max: null });
  return brackets;
}

/** How many filters differ from the defaults (for the "Clear all" badge). */
export function activeFilterCount(f: HotelFilters): number {
  return Number(Boolean(f.query.trim())) + Number(f.priceMin !== null || f.priceMax !== null) + Number(f.stars.length > 0)
    + Number(f.refundableOnly) + Number(!f.availableOnly);
}

/** Booking.com score words. */
export function ratingWord(rating: number): string {
  if (rating >= 9) return 'Superb';
  if (rating >= 8.5) return 'Excellent';
  if (rating >= 8) return 'Very good';
  if (rating >= 7) return 'Good';
  if (rating >= 6) return 'Pleasant';
  return 'Review score';
}

export const roomTypeLabel = (type: string) =>
  type.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
