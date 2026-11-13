import type { Group, GroupRow } from './group.ts';

export type Gender = 'FEMALE' | 'MALE';
export type GenderPreference = 'ANY' | 'SAME_GENDER';
export type MatchSort = 'score' | 'overlap' | 'budget';

/** A saved search (row of `searches` joined with destinations). */
export interface Search {
  search_id: string;
  traveller_id: string;
  home_city: string;
  city: string;
  country_name: string;
  check_in: string;
  check_out: string;
  budget_inr: number;
  interests: string[];
  gender: Gender;
  gender_preference: GenderPreference;
  created_at: string | Date;
}

/** Group row + the owner's profile fields the rules need. */
export interface CandidateRow extends GroupRow {
  owner_interests: string[];
  owner_gender_preference: GenderPreference;
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

export interface Match {
  group: Group;
  score: number;
  reasons: MatchReasons;
  explanations: string[];
  composition: MatchComposition;
}

/** G1 filters (all optional). */
export interface MatchFilters { min_shared: number | null; must: string[]; composition: CompositionKind | null }
export interface MatchFacets {
  composition: Record<CompositionKind, number>;
  interests: { interest: string; label: string; count: number }[];
  max_shared: number;
}

export interface MatchesResponse {
  search: Search;
  /** Matches after the G1 filters. */
  total: number;
  /** Matches that pass the 6 rules, before filters. */
  total_unfiltered: number;
  filters: MatchFilters;
  facets: MatchFacets;
  matches: Match[];
}

export interface SeekerSearch {
  traveller_id: string;
  city: string;
  check_in: string;
  check_out: string;
  budget_inr: number;
  interests: string[];
  gender: Gender;
  gender_preference: GenderPreference;
}

export interface RuleResult {
  same_city: boolean;
  dates_overlap: boolean;
  budget: boolean;
  interests: boolean;
  gender: boolean;
  group_size: boolean;
  not_already_in_group: boolean;
}

export interface Evaluation { score: number; reasons: MatchReasons }
