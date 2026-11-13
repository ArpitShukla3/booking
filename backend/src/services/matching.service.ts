// M4 matching engine. PURE functions only (no DB, no HTTP), so every rule is unit-tested.
// The 6 rules come from the problem statement §5 and tasks/TASK-M4-see-matches.md.
import type { CandidateRow, Evaluation, Gender, GenderPreference, MatchReasons, MatchSort, RuleResult, SeekerSearch } from '../types/search.ts';

const MIN_SHARED_NIGHTS = 2;
const MAX_BUDGET_DIFF = 0.4; // of the lower budget, inclusive
const MIN_SHARED_INTERESTS = 2;

const dayNumber = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };

/** Nights both trips have in common. The check-out day is not a night. */
function sharedNights(a: { check_in: string; check_out: string }, b: { check_in: string; check_out: string }): number {
  const start = a.check_in > b.check_in ? a.check_in : b.check_in;
  const end = a.check_out < b.check_out ? a.check_out : b.check_out;
  return Math.max(0, dayNumber(end) - dayNumber(start));
}

/** Rule 3: |a − b| ≤ 40% of the lower budget. Exactly 40% still matches (integer maths, no float error). */
function budgetCompatible(a: number, b: number): boolean {
  return Math.abs(a - b) * 10 <= Math.min(a, b) * 4;
}

function sharedInterests(seekerInterests: string[], ownerInterests: string[]): string[] {
  const owner = new Set(ownerInterests);
  return [...new Set(seekerInterests)].filter((i) => owner.has(i));
}

/** Rule 5, both ways. */
function genderCompatible(seekerGender: Gender, seekerPref: GenderPreference, ownerGender: Gender, ownerPref: GenderPreference): boolean {
  if (seekerPref === 'SAME_GENDER' && ownerGender !== seekerGender) return false;
  if (ownerPref === 'SAME_GENDER' && seekerGender !== ownerGender) return false;
  return true;
}

/** Rule 6: the owner is in member_ids, so a new member needs members + 1 ≤ max_size. */
function hasRoom(memberIds: string[], maxSize: number): boolean {
  return memberIds.length + 1 <= maxSize;
}



/** Every rule's result, for tests and debugging. */
function checkRules(search: SeekerSearch, group: CandidateRow): RuleResult {
  return {
    same_city: search.city === group.city,
    dates_overlap: sharedNights(search, group) >= MIN_SHARED_NIGHTS,
    budget: budgetCompatible(search.budget_inr, group.budget_inr),
    interests: sharedInterests(search.interests, group.owner_interests).length >= MIN_SHARED_INTERESTS,
    gender: genderCompatible(search.gender, search.gender_preference, group.owner_gender, group.owner_gender_preference),
    group_size: hasRoom(group.member_ids, group.max_size),
    not_already_in_group: group.owner_id !== search.traveller_id && !group.member_ids.includes(search.traveller_id),
  };
}

/**
 * Ranking score, 0–100 (higher = better). Only eligible groups get a score.
 *   interests  50 pts: min(shared interests, 4) / 4 × 50
 *   budget     30 pts: (1 − |diff| / (40% of the lower budget)) × 30
 *   overlap    20 pts: shared nights / the seeker's nights × 20
 * Ties: more shared interests, then smaller budget difference, then earlier check-in, then group_id.
 */
function score(input: { shared_interests: number; budget_a: number; budget_b: number; shared_nights: number; seeker_nights: number }): number {
  const interestPts = (Math.min(input.shared_interests, 4) / 4) * 50;
  const allowed = MAX_BUDGET_DIFF * Math.min(input.budget_a, input.budget_b);
  const budgetPts = allowed > 0 ? Math.max(0, 1 - Math.abs(input.budget_a - input.budget_b) / allowed) * 30 : 0;
  const overlapPts = input.seeker_nights > 0 ? Math.min(1, input.shared_nights / input.seeker_nights) * 20 : 0;
  return Math.round(interestPts + budgetPts + overlapPts);
}

function genderReason(search: SeekerSearch, group: CandidateRow): string {
  const strict = search.gender_preference === 'SAME_GENDER' || group.owner_gender_preference === 'SAME_GENDER';
  if (!strict) return 'Both open to any gender';
  const who = search.gender === 'FEMALE' ? 'women' : 'men';
  return `Same-gender preference met (both ${who})`;
}


/** null unless ALL 6 rules pass (and the seeker isn't already in the group). */
function evaluate(search: SeekerSearch, group: CandidateRow): Evaluation | null {
  const rules = checkRules(search, group);
  if (!Object.values(rules).every(Boolean)) return null;
  const nights = sharedNights(search, group);
  const interests = sharedInterests(search.interests, group.owner_interests);
  const diff = Math.abs(search.budget_inr - group.budget_inr);
  const lower = Math.min(search.budget_inr, group.budget_inr);
  return {
    score: score({ shared_interests: interests.length, budget_a: search.budget_inr, budget_b: group.budget_inr, shared_nights: nights, seeker_nights: dayNumber(search.check_out) - dayNumber(search.check_in) }),
    reasons: {
      city: group.city,
      shared_nights: nights,
      shared_from: search.check_in > group.check_in ? search.check_in : group.check_in,
      shared_to: search.check_out < group.check_out ? search.check_out : group.check_out,
      budget_diff_inr: diff,
      budget_diff_pct: Math.round((diff / lower) * 1000) / 10,
      shared_interests: interests,
      gender: genderReason(search, group),
      spots_left: group.max_size - group.member_ids.length,
    },
  };
}

interface Rankable { score: number; reasons: MatchReasons; group: { group_id: string; check_in: string; budget_inr: number } }

function compare(sort: MatchSort) {
  return (a: Rankable, b: Rankable): number => {
    const primary = sort === 'overlap' ? b.reasons.shared_nights - a.reasons.shared_nights
      : sort === 'budget' ? a.group.budget_inr - b.group.budget_inr
      : 0;
    return primary
      || b.score - a.score
      || b.reasons.shared_interests.length - a.reasons.shared_interests.length
      || a.reasons.budget_diff_inr - b.reasons.budget_diff_inr
      || a.group.check_in.localeCompare(b.group.check_in)
      || a.group.group_id.localeCompare(b.group.group_id);
  };
}

function rank<T extends Rankable>(matches: T[], sort: MatchSort = 'score'): T[] {
  return [...matches].sort(compare(sort));
}

// One object export so unit tests can call (and services can mock) every function.
const matchingService = { MIN_SHARED_NIGHTS, MAX_BUDGET_DIFF, MIN_SHARED_INTERESTS, sharedNights, budgetCompatible, sharedInterests, genderCompatible, hasRoom, checkRules, score, evaluate, rank };
export = matchingService;
