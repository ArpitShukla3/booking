# TASK-M3: Traveller search (seeker search form)

| Field | Value |
|---|---|
| Deliverable | M3 (Must have) |
| Track | **A: Traveller / Seeker** |
| Priority | P0 |
| Depends on | M1 (current traveller, lookup endpoints) |
| Blocks | M4 (matches are computed for a saved search) |

## Goal
A seeker enters what trip they want. The search is saved, so the matches (M4) can be computed and shown again after a refresh.

## Requirements

### Search form fields
| Field | Rule |
|---|---|
| Home city | Choose from `departure_cities`. Pre-fill from the profile. |
| Destination | Required. One of the 5 cities: Tokyo, Kyoto, Osaka, Dubai, Abu Dhabi (from `destinations`). Show it as "Kyoto, Japan". |
| Check-in / check-out | Required. `check_in` ≥ 2027-04-01, `check_out` ≤ 2027-04-20, `check_out` > `check_in` |
| Interests | Multi-select from `interests`. Pre-fill from the profile; the seeker can change them for this search. |
| Budget (INR per person) | Required, positive whole number |
| Gender preference | `ANY` / `SAME_GENDER`. Pre-fill from the profile. |
| Gender | Taken from the profile. Not editable in the search. |

### Behaviour
- The backend validates every field. A city or date outside the data gives a **clear message**, for example "Only 1–20 April 2027 is available" or "City not available". It must never return a silent empty result.
- Each submitted search is **saved** (seeker, all fields above, created time).
- After submitting, the seeker goes to the matches view (M4) for that search.
- The seeker can see their recent searches and open one again.
- The date picker should limit choices to 1–20 April 2027. The backend still validates anyway.
- Show the number of nights for the chosen dates (check-out day not counted).

## Acceptance criteria
- [ ] Priya's search (Kyoto, 2027-04-09 → 2027-04-16, ₹62,000, TEMPLES/STREET_FOOD/ADVENTURE, SAME_GENDER) can be entered and saved.
- [ ] A search with dates outside 1–20 April 2027, `check_out ≤ check_in`, or a city not in the data is rejected with a clear message.
- [ ] A saved search still exists after a refresh and a backend restart.
- [ ] The form accepts **any** valid combination. Nothing is hard-coded to the demo scenario.

## Data
- New table **`searches`**: seeker (FK → travellers), home_city, city (FK → destinations), check_in, check_out, budget_inr, interests text[], gender, gender_preference, created_at
- Migration: new file. Track A owns it.

## Out of scope
- Computing the matches (M4)
- Filters on the results (G1)

## Execution plan

Legend: **[U]** new file · **[M]** modified. Flow: router → controller → service → helper (Postgres).

```
Frontend /group-match (signed-in only)
  └─ POST /api/searches  (X-Traveller-Id from lib/api.ts)
       ▼
[M] backend/src/routes/index.js            + /searches, /departure-cities
[U] backend/src/routes/searches.routes.js  requireTraveller on every route
       POST / · GET / · GET /:searchId · GET /:searchId/matches (M4)
[U] backend/src/controllers/searches.controller.ts   thin: one service call each
[U] backend/src/services/searches.service.ts
       createSearch: zod check (validation/searches.validation.ts) → city in destinations,
       home city in departure_cities, interests in catalog → gender FROM PROFILE → insert
       getSearch: 404 unless it is yours · listMySearches: latest 10
[U] backend/src/helpers/postgres/searches.helper.js  insert / findById / listByTraveller
[M] backend/src/helpers/postgres/lookups.helper.js   + listDepartureCities / findDepartureCity
[U] backend/migrations/20261113000006_create_searches.js
       searches(search_id 'S-1001'…, traveller_id FK, home_city, city FK, check_in, check_out,
       budget_inr, interests[], gender, gender_preference, created_at) + CHECKs
```

Messages: "Only 1–20 April 2027 is available", "City not available: …", "Check-out must be after check-in", "Choose at least 2 interests…". Bad input always gets a 400 with `fields`, never a silent empty result.

## Implementation record (2026-11-13)

The Group Match tab used to run on a browser-side mock (local JSON, browser matching, "sample traveller"). It is now **live**:
- `/group-match` needs a signed-in traveller. The search form (`features/group-match/forms.tsx`) loads destinations, interests and departure cities **from the API** and pre-fills from the profile or the latest saved search. Gender is shown read-only from the profile. Live nights count; backend field errors appear under each field.
- Submit → `POST /api/searches` → URL `/group-match?search=S-1001&sort=score`. A refresh re-reads the saved search and its matches. The **Recent searches** panel re-opens earlier searches.
- Frontend files: [U] `src/services/searchService.ts`, `src/types/search.ts`, `src/features/group-match/{searchSchema.ts,group-match.css,searchSchema.test.ts}`, `tests/search.spec.ts`. [M] `GroupDiscoveryPage.tsx`, `forms.tsx`, `GroupCard.tsx`, `App.tsx` (route protected; the old `/group-match/groups/:id` redirects to `/groups/:id`), `BookingHeader.tsx` (sample-traveller strip hidden on live pages).
- Tests are **written, not yet run** (as requested): `backend/tests/unit/services/searches.service.test.js`, `backend/tests/integration/searches.api.test.js`, `frontend/src/features/group-match/searchSchema.test.ts`, `frontend/tests/search.spec.ts`. Compile checks only: backend `typecheck`, frontend `typecheck` / `lint` / `build` are clean.
- `frontend/tests/discovery.spec.ts` tests the old mock (sample-traveller switcher, URL-only searches, local "Interested"). It will fail now; replace it with `tests/search.spec.ts` or delete it.
- The mock files (`services/mock/*`, `groupMatchService.ts`, `GroupDetailsPage.tsx`) are no longer used by the discovery page. The header's sample-traveller switcher still imports them. Delete them when M5 replaces "Interested".

