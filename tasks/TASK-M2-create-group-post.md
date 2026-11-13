# TASK-M2: Create a group post (group owner)

| Field | Value |
|---|---|
| Deliverable | M2 (Must have) |
| Track | **B: Group / Owner** |
| Priority | P0 |
| Depends on | Shared foundation (`PLAN.md` §1). Current traveller from M1. Until M1 is done, develop as a seeded traveller (e.g. `T-001`). Lookup endpoints from M1; until they exist, use a temporary list of the 5 cities in your branch and remove it before merge. |
| Blocks | M5 (requests need a group), M6 (group page) |

## Goal
A signed-in traveller creates a group trip post. The post becomes visible to seekers (M4) at once, and the owner can manage it.

## Requirements

### Create form fields
| Field | Rule |
|---|---|
| Group name | Required, non-empty |
| Destination | Required. One of the 5 cities (from `destinations`). Show it as "Kyoto, Japan". |
| Check-in / check-out | Required. `check_in` ≥ 2027-04-01, `check_out` ≤ 2027-04-20, `check_out` > `check_in` |
| Number of people wanted | Total including the owner, **1–4**. Store it as `max_size`. Show "you + N more". |
| Approx budget (INR per person) | Required, positive whole number |
| Proposed itinerary | Free text |

### Behaviour
- The owner is the current traveller. The backend sets `owner_id` and **puts the owner in `member_ids`**.
- New group IDs follow the scheme in `PLAN.md` §1 (sequence-based `T-1001`… / `G-1001`…). They must never collide with `G-01` … `G-12`.
- The backend validates every field. A city or date outside the data gives a clear message.
- **My Groups** page: lists the groups the current traveller owns or is a member of, with members count, dates, and city. Show a **pending-requests badge** on owned groups (the count comes from M5; show 0 until M5 is done).
- **Group Details page** (`/groups/:groupId`): name, city/country, dates and nights, budget, itinerary, owner, member list (name, age, home city, interests), and free spots. The seeker's match card (M4) links here, and M5 adds actions to it.
- A new group is saved and appears in seekers' matches with no extra work. M4 reads `groups`.

## Acceptance criteria
- [x] Sarah's post can be created: Kyoto, 2027-04-10 → 2027-04-15, 3 people, ₹60,000, itinerary text.
- [x] After creation, `member_ids = [owner]` and the group appears in My Groups.
- [x] The group still exists after a refresh and a backend restart.
- [x] Invalid input is rejected with readable messages: size 0 or 5, dates outside the window, check-out before check-in, an unknown city.
- [ ] A seeker whose search fits the new group sees it in M4 results with no code change.
- [x] The Group Details page works for seeded groups (e.g. `G-01`) and new groups.

## Data
- Table: `groups` (exists)
- Migration: none. The ID sequence is created in Phase 0 (`PLAN.md` §1).

## Out of scope
- Editing or deleting a group after creation (nice to have)
- Join requests (M5)

## Execution plan
_To be added later._


## Implementation record (2026-11-13)

Built end to end on `main` (uncommitted). The plan above was followed, with these changes:
- **Group IDs:** a DB default `next_group_id()` gives `G-1001`, `G-1002`, … (migration `20261113000005_group_id_sequence.js`). It also adds indexes on `owner_id` and `member_ids`.
- **Backend style:** new services and controllers are TypeScript, like the traveller feature. Services export **one object** (`export =`), so `mock.method()` works in unit tests. Plain ES named exports are read-only getters under tsx.
- **Identity:** `X-Traveller-Id` header. Backend: only `middleware/currentTraveller.js` reads it. Frontend: only `lib/api.ts` sets it (the store registers the provider).
- **Extra:** `GET /api/destinations` (Track A lookup, minimal) for the form, plus a `stage` field on `Group` (`LOBBY_OPEN` / `LOBBY_FULL`) for the trip-progress flow.

### Files
```
backend
 [U] migrations/20261113000005_group_id_sequence.js
 [U] src/routes/groups.routes.js, src/routes/destinations.routes.js     [M] src/routes/index.js
 [U] src/middleware/currentTraveller.js
 [U] src/controllers/groups.controller.ts, src/controllers/lookups.controller.ts
 [U] src/services/groups.service.ts, src/services/lookups.service.ts
 [U] src/validation/groups.validation.ts, src/validation/dates.ts, src/types/group.ts
 [U] src/helpers/postgres/groups.helper.js, src/helpers/postgres/lookups.helper.js
 [M] src/helpers/postgres/travellers.helper.js  (+ findByIds)
 [U] tests/unit/services/groups.service.test.js, tests/unit/middleware/currentTraveller.test.js,
     tests/unit/controllers/groups.controller.test.js, tests/integration/groups.api.test.js
frontend
 [U] src/features/groups/{CreateGroupPage,MyGroupsPage,GroupPage}.tsx  (/groups/new, /my-groups, /groups/:groupId)
 [U] src/features/groups/{parts.tsx,media.ts,schema.ts,tripFlow.ts,groups.css,groups.test.ts}
 [U] src/services/groupService.ts, src/types/group.ts, tests/groups.spec.ts
 [M] src/lib/api.ts (X-Traveller-Id), src/store/useTravellerStore.ts, src/App.tsx (routes),
     src/components/layout/BookingHeader.tsx ("My groups" nav), src/features/identity/DashboardPage.tsx (links)
```

### UI
- **Create** (`/groups/new`): photo city picker, a yellow date box with a live nights count, a 1–4 size picker ("you + N more"), budget in ₹, itinerary with a character counter, and a sticky live preview card. Backend field errors appear under each field.
- **My groups** (`/my-groups`): All / Created by me / Joined tabs with a sliding indicator, a "Trip status" dropdown filter, an Owner/Member badge, a pending-requests badge (0 until M5), and seat bars.
- **Group details** (`/groups/:groupId`): hero photo, facts strip, itinerary, member cards (name, age, home city, interests) plus open-spot placeholders, and the **trip-progress flow**: Group posted → Lobby filling → Lobby complete → Hotel fixed → Booked. The hotel and booking steps stay "upcoming" until M6.
- Online photos from Unsplash with local fallbacks. Skeleton loaders, staggered fade-up animations, `prefers-reduced-motion` respected, details route prefetched on hover.

### Test results (run 2026-11-13)
- Backend unit: 58/58 pass. Backend integration: 29/30 pass. The 1 failure was the pre-existing CORS test, caused by the local `backend/.env` listing only `localhost:5173`. Fixed locally to match `.env.example`.
- Frontend: `typecheck`, `lint` and `build` clean. Vitest 42/42 pass. Playwright `tests/groups.spec.ts`: 5/5 pass against the real API.
- The full Playwright suite is sometimes flaky under parallel load. This also hits the existing `discovery.spec.ts` tests, so it is not specific to M2.

### Remaining
- `pending_requests` is always 0 until M5. "Search hotels together" is disabled until M6.
