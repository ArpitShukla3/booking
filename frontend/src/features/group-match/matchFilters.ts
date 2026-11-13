import type { CompositionKind, MatchComposition, MatchFilters } from '@/types/search';

/** G1 filters live in the URL (?shared=3&must=TEMPLES,STREET_FOOD&mix=WOMEN_ONLY) so results can be shared and survive refresh. */
export const NO_FILTERS: MatchFilters = { min_shared: null, must: [], composition: null };

const KINDS: CompositionKind[] = ['WOMEN_ONLY', 'MEN_ONLY', 'MIXED'];

export function filtersFromParams(params: URLSearchParams): MatchFilters {
  const shared = Number(params.get('shared'));
  const mix = params.get('mix') as CompositionKind | null;
  return {
    min_shared: Number.isInteger(shared) && shared >= 2 && shared <= 16 ? shared : null,
    must: [...new Set((params.get('must') ?? '').split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z_]{2,40}$/.test(s)))],
    composition: mix && KINDS.includes(mix) ? mix : null,
  };
}

/** Writes filters into a copy of the params (empty filters remove their key). */
export function withFilters(params: URLSearchParams, filters: MatchFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  if (filters.min_shared) next.set('shared', String(filters.min_shared)); else next.delete('shared');
  if (filters.must.length) next.set('must', filters.must.join(',')); else next.delete('must');
  if (filters.composition) next.set('mix', filters.composition); else next.delete('mix');
  return next;
}

export const activeFilterCount = (f: MatchFilters) => (f.min_shared ? 1 : 0) + f.must.length + (f.composition ? 1 : 0);

export const filtersKey = (f: MatchFilters) => `${f.min_shared ?? ''}|${f.must.join(',')}|${f.composition ?? ''}`;

export const COMPOSITION_LABELS: Record<CompositionKind, string> = { WOMEN_ONLY: 'Women only', MEN_ONLY: 'Men only', MIXED: 'Mixed' };

/** "2 women", "1 man · 1 woman". */
export function compositionText(c: MatchComposition): string {
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [c.female ? part(c.female, 'woman', 'women') : '', c.male ? part(c.male, 'man', 'men') : ''].filter(Boolean).join(' · ');
}

export function toggleInterest(f: MatchFilters, interest: string): MatchFilters {
  return { ...f, must: f.must.includes(interest) ? f.must.filter((i) => i !== interest) : [...f.must, interest] };
}
