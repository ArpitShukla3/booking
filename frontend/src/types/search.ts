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

/** One ranked match (M4). Every match passed all 6 rules in the backend. */
export interface LiveMatch {
  group: Group;
  score: number;
  reasons: MatchReasons;
  explanations: string[];
}

export interface MatchesResponse { search: SavedSearch; total: number; matches: LiveMatch[] }
export interface DepartureCity { airport: string; city: string }
