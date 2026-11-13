# TASK-M4: See matches (matching engine and results list)

| Field | Value |
|---|---|
| Deliverable | M4 (Must have) |
| Track | **A: Traveller / Seeker** |
| Priority | P0. 25% of the score is correctness on new judge requests. |
| Depends on | M3 (search), seeded `groups` (exist). Groups created in M2 appear automatically. |
| Blocks | Nothing. The match card links to the Group Details page (Track B, M5). |

## Goal
For a seeker's search, the **backend** returns every group post that passes **all 6 rules**, ranked. The UI shows them and explains why each one is a match.

## Matching rules: ALL must pass
Seeker = the search plus the seeker's profile. Owner = the traveller in `groups.owner_id`.

| # | Rule | Exact check |
|---|---|---|
| 1 | Same destination | `search.city == group.city` (exact city) |
| 2 | Dates overlap | Shared nights ≥ 2. `shared = max(0, min(s.check_out, g.check_out) − max(s.check_in, g.check_in))` in days. The check-out day is not a night. |
| 3 | Budget | `abs(s.budget − g.budget) ≤ 0.4 × min(s.budget, g.budget)`. **Exactly 40% still matches.** |
| 4 | Shared interests | `|search.interests ∩ owner.interests| ≥ 2`. Uses the **owner's profile** interests, not the members'. |
| 5 | Gender preference (both ways) | If seeker pref = SAME_GENDER → owner.gender == seeker.gender **and** if owner pref = SAME_GENDER → seeker.gender == owner.gender |
| 6 | Group size | `member_ids.length + 1 ≤ max_size` (the owner is counted in both) |

Also exclude groups the seeker already **owns or belongs to**.

## Requirements
- All matching runs in the backend. The frontend only displays the result.
- Each match shows: **group name, destination (city, country), dates, members count (e.g. 1/3), owner name**. Also show the budget and the itinerary preview.
- **The match reason is visible**: shared nights, budget difference in % of the lower budget, the shared interest names, the gender-preference result, and free spots left. Judges score "is the match reason clear?".
- **Ranking**: a documented weighted score, for example shared interests, then budget closeness, then overlap nights, with a fixed tie-break (for example earlier check-in, then group_id). Write the formula in the README; the team explains it in the demo.
- **No matches**: show a helpful empty state with suggested actions: widen dates, add interests, change budget, pick another city.
- Large result sets: limit or paginate.
- A new group created in M2 appears in the results with no code change.
- Every match card opens the **Group Details page** (`/groups/:groupId`, built by Track B). The "Interested" button lives there.

## Acceptance criteria
- [ ] Priya's search returns **G-01 Kyoto Spring Temples** (owner Sarah, 5 shared nights, ₹2,000 difference, 2 shared interests, 1/3 members).
- [ ] Boundary tests pass:
  - 1 shared night → no match; 2 → match
  - ₹60,000 vs ₹84,000 → match; ₹60,000 vs ₹85,000 → no match
  - 1 shared interest with the owner → no match
  - A male seeker against a SAME_GENDER female owner → no match. A female seeker with SAME_GENDER against a male owner with ANY → no match.
  - A full group (members == max_size) → no match
  - Kyoto vs Osaka → no match
- [ ] The matching function has unit tests that cover each rule and the boundaries above.
- [ ] Results are correct for any new traveller or search a judge enters.

## Data
- Reads: `searches`, `groups`, `travellers` (owner), `destinations`
- No new tables

## Out of scope
- Interest / gender-composition filters on the results (G1, a good-to-have)
- Express interest / join request (M5, Track B)

## Execution plan
_To be added later._
