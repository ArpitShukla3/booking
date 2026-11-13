# TASK-G1: Filter match results by shared interests and gender mix

| Field | Value |
|---|---|
| Deliverable | G1 (Good to have) |
| Track | A: Traveller / Seeker (implemented by Adil, 2026-11-13) |
| Depends on | M3 (saved searches), M4 (matching + ranking) |
| Status | **Implemented 2026-11-13.** Tick the criteria once the tests below pass. |

## Goal
On the match results, a seeker can narrow the list by **gender mix of the group's current members** and by
**shared interests with the organiser**. Filters only remove matches; a group must still pass all 6 rules.

## Behaviour
- "Refine results" panel above the results (only when there are matches):
  - **Group gender mix**: Any mix / Women only / Men only / Mixed, each with how many current matches it keeps
    (options with 0 are disabled). Mix = genders of the group's current members, owner included.
  - **Shared interests with the organiser**: at least 2 (every match), 3, 4, … up to the highest in the results.
  - **Must share**: interest chips taken from the current matches with counts; choosing several means ALL of them.
  - Header shows "X of Y groups" and **Clear filters**. A filtered-out list shows "No groups match these filters" +
    Clear filters (different from the "no matches at all" tips).
- Filters live in the URL (`?shared=3&must=TEMPLES,STREET_FOOD&mix=WOMEN_ONLY`), so they survive refresh and can be
  shared; running a new search clears them. Sort keeps working with filters.
- Each match card shows its gender mix ("Women only · 1 woman", "Mixed · 2 women · 1 man").

## API
`GET /api/searches/:searchId/matches?sort=&shared=&must=&mix=` 🔒
- `shared`: integer 2–16 · `must`: comma-separated interest IDs (case-insensitive) · `mix`: `WOMEN_ONLY|MEN_ONLY|MIXED`.
- Response adds: `total_unfiltered` (passing the 6 rules), `total` (after filters), `filters` (as applied),
  `facets { composition, interests[{interest,label,count}], max_shared }` (over all eligible matches) and per match
  `composition { female, male, kind }`.
- Invalid values → 400 with `error.fields.shared|must|mix`.

## Implementation
- Pure rules: `backend/src/services/matchFilters.service.ts` (`compositionOf`, `applyFilters`, `buildFacets`); the 6-rule
  engine (`matching.service.ts`) is unchanged.
- `matches.service.ts`: one extra query for member genders (`travellers.helper.findByIds`), then rank → facets →
  filter → top 50. Validation: `matchFiltersSchema` in `validation/searches.validation.ts`.
- Frontend: `features/group-match/MatchFiltersPanel.tsx`, `matchFilters.ts` (URL ⇄ filters), `GroupDiscoveryPage.tsx`,
  `GroupCard.tsx` (mix badge), `group-match.css`; `searchService.getMatches(searchId, sort, filters)`.

## Acceptance criteria
- [ ] Gender-mix filter keeps only that mix; counts on the chips match the results.
- [ ] "At least N" and "Must share" keep only matches that satisfy them (ALL chosen interests).
- [ ] Filters never add a group that fails a rule; totals show "X of Y".
- [ ] Filters persist in the URL across refresh; Clear filters and a new search reset them.
- [ ] Invalid query values return 400 with a field message.

## Tests
Backend unit `tests/unit/services/matchFilters.service.test.js`; integration `tests/integration/matchFilters.api.test.js`;
Vitest `src/features/group-match/matchFilters.test.ts`; Playwright `tests/filtersAndProfiles.spec.ts` (G1 journey).
