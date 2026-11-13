import { searchSchema } from "../../lib/schemas";
import type {
  Group,
  GroupSearch,
  Match,
  MatchSort,
  Traveller,
} from "../../types/groupMatch";

/** Eligibility only. This temporary pure function will move to the matching API. */
export function evaluateMatch(
  group: Group,
  owner: Traveller,
  seeker: Traveller,
  input: GroupSearch,
): Match | null {
  if (
    !searchSchema.safeParse(input).success ||
    group.member_ids.includes(seeker.traveller_id)
  )
    return null;
  const shared_nights = Math.max(
    0,
    (Date.parse(
      input.check_out < group.check_out ? input.check_out : group.check_out,
    ) -
      Date.parse(
        input.check_in > group.check_in ? input.check_in : group.check_in,
      )) /
      86400000,
  );
  const shared_interests = [...new Set(input.interests)].filter((interest) =>
    owner.interests.includes(interest),
  );
  const budgetDifference = Math.abs(input.budget_inr - group.budget_inr);
  const lowerBudget = Math.min(input.budget_inr, group.budget_inr);
  const sameGenderRequired =
    input.gender_preference === "SAME_GENDER" ||
    owner.gender_preference === "SAME_GENDER";
  if (
    input.city !== group.city ||
    shared_nights < 2 ||
    budgetDifference * 10 > lowerBudget * 4 ||
    shared_interests.length < 2 ||
    (sameGenderRequired && seeker.gender !== owner.gender) ||
    group.member_ids.length + 1 > group.max_size
  )
    return null;
  const openPlaces = group.max_size - group.member_ids.length;
  return {
    group,
    owner,
    shared_nights,
    shared_interests,
    score: calculateScore(
      shared_nights,
      shared_interests.length,
      budgetDifference / lowerBudget,
    ),
    explanations: [
      `Same destination: ${group.city}`,
      `${shared_nights} overlapping nights`,
      `${shared_interests.length} shared interests`,
      "Compatible budget",
      "Mutual gender preferences",
      `${openPlaces} open ${openPlaces === 1 ? "place" : "places"}`,
    ],
  };
}

/** Transparent demo ranking, not an eligibility condition or match probability.
 * 10 points/shared night (max 20 nights), 5/shared interest (max 16),
 * plus 0–20 points for budget closeness. Maximum 300 points.
 */
function calculateScore(
  nights: number,
  interests: number,
  relativeBudgetDifference: number,
) {
  return (
    nights * 10 +
    interests * 5 +
    Math.round(20 * (1 - relativeBudgetDifference / 0.4))
  );
}
export function rankMatches(matches: Match[], sort: MatchSort): Match[] {
  return [...matches].sort(
    (a, b) =>
      (sort === "budget"
        ? a.group.budget_inr - b.group.budget_inr
        : sort === "overlap"
          ? b.shared_nights - a.shared_nights
          : b.score - a.score) ||
      a.group.group_id.localeCompare(b.group.group_id),
  );
}
