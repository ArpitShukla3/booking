import { describe, expect, it } from 'vitest';
import { activeFilterCount, compositionText, filtersFromParams, filtersKey, NO_FILTERS, toggleInterest, withFilters } from './matchFilters';

describe('G1 filters in the URL', () => {
  it('reads valid values and ignores bad ones', () => {
    expect(filtersFromParams(new URLSearchParams('shared=3&must=temples,STREET_FOOD,temples&mix=WOMEN_ONLY')))
      .toEqual({ min_shared: 3, must: ['TEMPLES', 'STREET_FOOD'], composition: 'WOMEN_ONLY' });
    expect(filtersFromParams(new URLSearchParams('shared=1&must=bad id!&mix=EVERYONE'))).toEqual(NO_FILTERS);
    expect(filtersFromParams(new URLSearchParams(''))).toEqual(NO_FILTERS);
  });
  it('writes filters and removes empty ones, keeping other params', () => {
    const base = new URLSearchParams('search=S-1001&sort=budget&shared=3&mix=MIXED');
    const next = withFilters(base, { min_shared: null, must: ['TEMPLES'], composition: null });
    expect(next.toString()).toBe('search=S-1001&sort=budget&must=TEMPLES');
    expect(withFilters(next, NO_FILTERS).toString()).toBe('search=S-1001&sort=budget');
  });
  it('round-trips', () => {
    const f = { min_shared: 4, must: ['A_B', 'CD'], composition: 'MEN_ONLY' as const };
    expect(filtersFromParams(withFilters(new URLSearchParams(), f))).toEqual(f);
  });
});

describe('helpers', () => {
  it('counts active filters and builds a stable key', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount({ min_shared: 3, must: ['A', 'B'], composition: 'MIXED' })).toBe(4);
    expect(filtersKey({ min_shared: 3, must: ['A'], composition: null })).toBe('3|A|');
  });
  it('toggles interests', () => {
    const one = toggleInterest(NO_FILTERS, 'TEMPLES');
    expect(one.must).toEqual(['TEMPLES']);
    expect(toggleInterest(one, 'TEMPLES').must).toEqual([]);
  });
  it('describes the gender mix', () => {
    expect(compositionText({ female: 1, male: 0, kind: 'WOMEN_ONLY' })).toBe('1 woman');
    expect(compositionText({ female: 2, male: 1, kind: 'MIXED' })).toBe('2 women · 1 man');
    expect(compositionText({ female: 0, male: 3, kind: 'MEN_ONLY' })).toBe('3 men');
  });
});
