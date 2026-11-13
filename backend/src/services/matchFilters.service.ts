// G1: optional filters on top of the 6 matching rules (they can only REMOVE matches, never add one).
// Pure functions, no I/O. matches.service applies them after ranking.
import type { CompositionKind, Match, MatchComposition, MatchFacets, MatchFilters } from '../types/search.ts';

/** Gender mix of the people already in the group (owner included). */
function compositionOf(genders: ('FEMALE' | 'MALE')[]): MatchComposition {
  const female = genders.filter((g) => g === 'FEMALE').length;
  const male = genders.filter((g) => g === 'MALE').length;
  const kind: CompositionKind = male === 0 ? 'WOMEN_ONLY' : female === 0 ? 'MEN_ONLY' : 'MIXED';
  return { female, male, kind };
}

/** Keeps matches with at least `min_shared` shared interests, ALL of `must`, and the chosen gender mix. */
function applyFilters<T extends Pick<Match, 'reasons' | 'composition'>>(matches: T[], filters: MatchFilters): T[] {
  return matches.filter((m) => {
    const shared = m.reasons.shared_interests;
    if (filters.min_shared !== null && shared.length < filters.min_shared) return false;
    if (filters.must.some((interest) => !shared.includes(interest))) return false;
    if (filters.composition !== null && m.composition.kind !== filters.composition) return false;
    return true;
  });
}

/** Counts for the filter chips, computed over ALL eligible matches (before filtering). */
function buildFacets(matches: Pick<Match, 'reasons' | 'composition'>[], labels: Map<string, string>): MatchFacets {
  const composition: Record<CompositionKind, number> = { WOMEN_ONLY: 0, MEN_ONLY: 0, MIXED: 0 };
  const interestCounts = new Map<string, number>();
  let maxShared = 0;
  for (const m of matches) {
    composition[m.composition.kind] += 1;
    maxShared = Math.max(maxShared, m.reasons.shared_interests.length);
    for (const i of m.reasons.shared_interests) interestCounts.set(i, (interestCounts.get(i) ?? 0) + 1);
  }
  const interests = [...interestCounts.entries()]
    .map(([interest, count]) => ({ interest, label: labels.get(interest) ?? interest, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { composition, interests, max_shared: maxShared };
}

const matchFiltersService = { compositionOf, applyFilters, buildFacets };
export = matchFiltersService;
