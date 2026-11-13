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

```
GET /api/searches/:searchId/matches?sort=score|overlap|budget   (requireTraveller)
  [U] controllers/searches.controller.ts → getMatches
  [U] services/matches.service.ts
        getSearch (404 unless yours) → groups.helper.listCandidatesByCity(city)
        (group + owner gender/preference/interests in ONE query) → matching.evaluate()
        for each → rank → top 50 + total; labels for interest names
  [U] services/matching.service.ts   PURE: sharedNights, budgetCompatible (integer maths,
        exactly 40% passes), sharedInterests (owner's, de-duplicated), genderCompatible (both
        ways), hasRoom, checkRules, score, evaluate, rank. Also excludes groups you own or are in.
  [M] helpers/postgres/groups.helper.js  + listCandidatesByCity
```

Response: `{ search, total, matches: [{ group: Group, score, reasons: { city, shared_nights, shared_from, shared_to, budget_diff_inr, budget_diff_pct, shared_interests, gender, spots_left }, explanations: string[] }] }`

### Ranking (also in README)
Score 0–100 = **interests** min(shared, 4)/4 × 50 + **budget** (1 − diff / (40% of the lower budget)) × 30 + **overlap** (shared nights / seeker nights) × 20, rounded.
Tie-break: more shared interests → smaller budget difference → earlier check-in → `group_id`.
`sort=overlap` puts the most shared nights first; `sort=budget` puts the lowest group budget first. Each uses the score order as the tie-break.

## Implementation record (2026-11-13)
- Match cards show the group name, "City, Country", dates and nights, members (1/3), owner, budget, itinerary preview, shared-interest tags, score /100, and 6 reasons. Example: "5 shared nights", "Budgets 3.3% apart (₹2,000)", "2 shared interests: Temples and shrines, Street food and markets", "Same-gender preference met (both women)", "2 spots left". Cards link to `/groups/:groupId`.
- No matches → suggestions (widen dates, add interests, adjust budget, other city) and a "Start your own group" link.
- New M2 groups appear automatically (candidates are read from `groups`).
- Tests **written, not yet run**: `backend/tests/unit/services/matching.service.test.js` covers every rule and every boundary listed above, the Priya × G-01 worked example, own-group exclusion and ranking ties. `backend/tests/integration/searches.api.test.js` covers Priya → G-01, a new M2 group appearing, own groups excluded, a judge-style random search where every returned match obeys all 6 rules, and sorting.

