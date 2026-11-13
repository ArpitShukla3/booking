import type { Group } from './group';

export type GenderPreference = 'ANY' | 'SAME_GENDER';
export type MatchSort = 'score' | 'overlap' | 'budget';

export interface SearchInput {
  home_city: string;
  city: string;
  check_in: string;
  check_out: string;
  budget_inr: number;
  interests: string[];
  gender_preference: GenderPreference;
}

/** A saved search (M3), as returned by the backend. */
export interface SavedSearch extends SearchInput {
  search_id: string;
  traveller_id: string;
  country_name: string;
  gender: 'FEMALE' | 'MALE';
  created_at: string;
}

export interface MatchReasons {
  city: string;
  shared_nights: number;
  shared_from: string;
  shared_to: string;
  budget_diff_inr: number;
  budget_diff_pct: number;
  shared_interests: string[];
  gender: string;
  spots_left: number;
}

/** G1: gender mix of the group's current members (owner included). */
export type CompositionKind = 'WOMEN_ONLY' | 'MEN_ONLY' | 'MIXED';
export interface MatchComposition { female: number; male: number; kind: CompositionKind }

/** One ranked match (M4). Every match passed all 6 rules in the backend. */
export interface LiveMatch {
  group: Group;
  score: number;
  reasons: MatchReasons;
  explanations: string[];
  composition: MatchComposition;
}

/** G1 filters as the backend applied them. */
export interface MatchFilters { min_shared: number | null; must: string[]; composition: CompositionKind | null }
export interface MatchFacets {
  composition: Record<CompositionKind, number>;
  interests: { interest: string; label: string; count: number }[];
  max_shared: number;
}

export interface MatchesResponse {
  search: SavedSearch;
  /** After the G1 filters. */
  total: number;
  /** Passing the 6 rules, before filters. */
  total_unfiltered: number;
  filters: MatchFilters;
  facets: MatchFacets;
  matches: LiveMatch[];
}
export interface DepartureCity { airport: string; city: string }
