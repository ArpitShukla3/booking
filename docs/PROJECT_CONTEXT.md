# Group Travel Matcher project context

## Current status: real traveller identity (2026-11-13)

The latest M1 task adds real PostgreSQL signup and Traveller ID login to the existing
Home/discovery implementation. Code is recorded in commit `2b658a4` on `main`;
this documentation/task update follows it. Earlier discovery notes below are
historical and remain preserved. No approval, hotel, booking or authentication
framework was added.

### Routes and API

| Frontend route | Behavior |
|---|---|
| `/signup` | RHF/Zod profile form using the backend interest catalog; success shows generated ID, copy and dashboard actions |
| `/login` | Traveller ID-only sign-in; preserves input on errors; no passwords/email/OTP |
| `/dashboard` | Protected profile, ID copy, home city/airport, interests, Group Match navigation and logout |
| `/` | Existing homepage for guests; restored signed-in users automatically open dashboard |

| API | Success | Failure |
|---|---|---|
| POST `/api/travellers` | 201 complete saved profile | 400 fields, 409 ID conflict, 503 DB failure |
| POST `/api/travellers/sign-in` | 200 existing profile | 400 invalid ID/body, 404 `Traveller ID not found`, 503 |
| GET `/api/travellers/:traveller_id` | 200 saved profile | 400, 404, 503 |
| GET `/api/interests` | 200 IDs/labels/categories from PostgreSQL | 503 |

### Architecture and changed files

- Backend keeps Express 5, Knex/pg, its singleton database client, text primary keys
  and `text[]` interests. No Prisma was configured or introduced. New typed modules
  run through `tsx`; existing CommonJS entrypoints/helpers/migrations stay compatible.
- New `backend/src/{types/traveller,validation/travellers.validation,
  services/travellers.service,controllers/travellers.controller}.ts` follow the
  existing router → controller → service → helper layers.
- New `src/helpers/postgres/travellers.helper.js` owns SQL; new traveller/interest
  routers are mounted in `src/routes/index.js`. The helper never creates another client.
- Added Zod, tsx, TypeScript and type definitions to backend package/lock files,
  `backend/tsconfig.json`, typed start/dev/test scripts and `seed:travellers`.
- Frontend adds Axios in package/lock files, `src/lib/api.ts` (10-second timeout,
  readable HTTP/network errors), `src/services/travellerService.ts`,
  `src/types/traveller.ts`, and `.env.example` with `VITE_API_URL`.
- `src/features/identity/` contains schemas, LoginPage, SignupPage, CopyTravellerId,
  DashboardPage and shared session lifecycle/route guard.
- `src/lib/identityStorage.ts` owns parsing/clearing; `src/store/useTravellerStore.ts`
  owns current profile, ID, deadline, initialization/loading/errors and actions:
  signup, signInWithId, restoreSession, logout and ensureValidSession.
- The original sample identity moved to `useDemoTravellerStore.ts`; discovery keeps
  its own browser-local store and mock requests. Header/account navigation uses the
  real profile and labels the sample selector explicitly. No new group logic was added.
- Updated App routes, header and identity styling in `index.css`. Existing Home,
  discovery and backend health behavior are preserved.
- CORS example/default/local configuration allows both localhost:5173 and
  127.0.0.1:5173; a regression test covers both (no wildcard origin).
- Tests: backend traveller service/API tests; frontend identity store tests and
  `tests/identity.spec.ts`; existing discovery test selector updated for the explicit
  sample label. Earlier tests are retained.
- Added and validated `.agents/skills/frontend-features/SKILL.md`; existing backend
  skill is untouched. Updated AGENTS, Agent frontend/schema/API notes, M1/PLAN and
  root/frontend/backend README instructions.

### PostgreSQL changes

New migration `20261113000003_traveller_id_sequence.js` creates `traveller_id_seq`,
`next_traveller_id()` and the default on the existing `travellers.traveller_id`.
Allocation starts above the existing numeric maximum: a fresh database's first
signup is T-025. Padding uses at least three digits without truncating T-1000.
`nextval` safely allocates concurrent IDs; no row-count generation is used.
Rollback removes only the default/function/sequence and preserves profiles.

New migration `20261113000004_backfill_missing_travellers.js` inserts missing
catalog/traveller seeds with ON CONFLICT DO NOTHING; it never overwrites existing
or user-created rows. It advances the sequence without rewinding. Its rollback
intentionally preserves potentially referenced seed records. `npm run seed:travellers`
provides the same idempotent maintenance behavior. Original migrations/data are
unchanged; no columns were removed or renamed. Nullable legacy age values remain
compatible, while new signup requires integer age 1–120. Home city is required
text and home airport is a three-letter code, normalized to uppercase. Empty or
single-interest profiles are permitted per the original M1 edge-case rule.

### Exactly seven-day remembered identity

Storage key: `group_match_active_traveller`.

```json
{ "traveller_id": "T-025", "expires_at": 1790000000000 }
```

The timestamp above is illustrative. Only successful signup or explicit login
writes `Date.now() + 7 * 24 * 60 * 60 * 1000`. Refresh validates the record and
fetches the profile without extending the timestamp. Expired/malformed records,
impossible date values, oversized IDs and backend 404s clear identity. Backend or
storage-read outages keep valid identity retryable rather than substituting a fake
profile. The lifecycle checks open-tab timers, focus/visibility and cross-tab storage
changes; identity-dependent dashboard actions call ensureValidSession.

Logout clears client state/storage without deleting the account. Async operation
versions prevent late restoration responses from reactivating a logged-out user.
Failed identity writes invalidate an older record where possible and still show a
successfully created profile/ID. If both storage removal and overwrite fail, the UI
explains that logout succeeded only in the current tab and site storage needs clearing.
This is demo identity: a Traveller ID is not a secure credential or authorization token.

### Validation and known limits

Executed checks: 27 backend unit + 16 PostgreSQL integration tests; 30 frontend
unit/service tests; 20 Playwright tests including actual API signup/login and all
prior discovery tests. Both TypeScript projects and the Vite production build are
checked. Oxlint has the original Button Fast Refresh warning; ESLint is not configured.
The new migrations were rolled down/up only in `booking_test`. A created T-025
profile was fetched and signed in successfully before and after an actual API restart.
The idempotent seed script was run with that new user present. No seed/user reset ran.

Browser tests verify seven-day storage, refresh without renewal, logout without DB
deletion, seeded/new IDs, unknown/deleted IDs, corrupted/expired storage, live-tab
expiry using injected time, network errors/outage retry and 360px mobile layouts.
Browser signup tests create a real `Rahul Browser Demo` profile in the configured
development API; these permanent test profiles are not deleted. Backend integration
records are isolated in `booking_test` and only their own generated rows are cleaned.

Known limits: ID-only sign-in is intentionally not secure authentication; no ID
recovery flow is implemented. Group discovery remains a separate labelled sample
feature; real backend matching/approvals/bookings require their own tasks. Browser
persistence can be disabled by browser policy; that condition is reported rather
than pretending seven-day remembrance succeeded. PostgreSQL remains authoritative.

Next recommended task: integrate real backend group discovery under a separate
scope, reusing the delivered current-traveller contract. General destination and
departure lookup endpoints from the larger original M1 plan remain deferred.


## Earlier discovery delivery (historical context)

The app now has a Booking.com-inspired Home Dashboard and a focused Group Match
discovery frontend. It runs without a backend connection. The original backend
and official data pack remain intact. Read `Agent.md` for their architecture and
schema; this file records the separate frontend demo.

The discovery-phase user request superseded an earlier, larger frontend brief. Signup,
group creation, approvals, hotel comparison, bookings and secondary booking-category
pages are deliberately outside this delivery. Unfinished files from that earlier
draft were removed before completion; no pre-existing working features were removed.

## Routes and user journey

| Route | Component | Behavior |
| --- | --- | --- |
| `/` | `pages/HomePage.tsx` | Navy promotional hero, yellow hotel-search preview, four informational cards, travel-companions CTA |
| `/group-match` | `features/group-match/GroupDiscoveryPage.tsx` | Validated search filters, eligible results, sorting, loading/error/empty states |
| `/group-match/groups/:group_id` | `features/group-match/GroupDetailsPage.tsx` | Itinerary, owner/members, dates/capacity/budget, compatibility and Interested state |
| Unknown URL | App fallback | Explains available routes and links to discovery |

Search fields and sorting live in query parameters. Detail links carry the search
criteria. The initial view evaluates an explicit Kyoto sample search, using Priya
Shah (`T-002`) if no active traveller has been selected. “Sign in” and “Switch
traveller” choose an existing official sample profile. Register explains that
registration is not connected; no signup flow existed in the baseline.

## Frontend architecture

- `App.tsx`: shared header/footer, Router, lazy discovery/details pages, loading
  fallback, route title/focus handling.
- `components/layout/BookingHeader.tsx`: category navigation, sample-traveller
  selector, help/info dialogs, confirmed clearing of pending demo requests.
- `components/layout/Footer.tsx`: prototype disclosure and photo credits.
- `pages/HomePage.tsx`: `HeroBanner`, `WhyBookingCards`, `TravelCompanionsSection`.
- `components/shared/SearchBar.tsx`: explicitly visual-only hotel-search preview.
- `components/shared/common.tsx`: container, photo fallback, demo notice, interest
  tags, match explanations, loading/error/empty states and route focus.
- `components/ui/`: existing Button retained; Input/native Select, Radix Checkbox,
  Radix Dialog and RHF Form/Field wrappers follow the existing shadcn pattern.
- `features/group-match/forms.tsx`: RHF/Zod search form and official interest choices.
- `features/group-match/GroupCard.tsx`: reusable results card.
- `features/group-match/GroupDetailsPage.tsx`: details and reusable member card.
- `lib/schemas.ts`: dates restricted to 1–20 April 2027, positive integer INR,
  supported cities/interests and enums, checkout after check-in.
- `lib/searchParams.ts`: URL parsing/serialization and documented sample defaults.
- `lib/useAsync.ts`: small promise-state hook; changed keys discard stale reads;
  explicit retry and actor-dependent keys prevent identity data leaking between views.
- `lib/format.ts`: `Intl` currency/date formatting; dates use UTC for display.
- `store/useTravellerStore.ts`: active traveller ID only. The existing unused
  `useCounterStore.ts` is preserved.
- `index.css` and `tailwind.config.js`: reusable Booking palette, compact Arial
  typography, 1140px desktop container, responsive layout and focus/reduced-motion rules.

## Sample data and contracts

`src/data/{travellers,groups,interests}.json` are unchanged development-time
snapshots of official data records: 24 travellers, 12 groups and 16 interests.
Original field names and enum values are preserved. UI code never loads data from
the official repository folder at runtime. Destination photos are downloaded from
Unsplash into `public/images/`; attribution links are in `CREDITS.md`.

Pages depend on the `GroupMatchService` interface in `types/groupMatch.ts`, exposed
by `services/groupMatchService.ts`. All methods return promises:

- `getTravellers()` / `getTraveller(traveller_id)`
- `searchGroups(search, traveller_id, sort)`
- `getGroupDetails(group_id, search, traveller_id)`
- `expressInterest(group_id, search, traveller_id)`

The implementation is `services/mock/groupMatchMockService.ts`, which accepts an
injected storage interface for tests. No Express endpoint is assumed or called.
This is the replacement boundary for future backend integration.

### Eligibility versus ranking

`services/mock/matching.ts` contains the temporary **pure** `evaluateMatch`:
same city, >=2 shared nights, budget difference <=40% of the lower budget,
>=2 distinct search interests shared with the owner, bidirectional gender
compatibility, and capacity for one more person. Current members are excluded
from discovery. Shared nights exclude checkout day; integer cross-multiplication
keeps the exact 40% budget boundary inclusive.

`rankMatches` is separate. Default demo score = 10 × shared nights + 5 × shared
interests + round(20 × (1 − relative budget difference / 0.4)). Scores are explained
as **points**, never random percentages or match probabilities. Users can also
sort by shared nights or budget. Ties break consistently by group ID.

### Temporary persistence

- `gtm.active-traveller-id`: active sample ID only; default `T-002`.
- `gtm.discovery.requests.v1`: `{ version: 1, requests: [...] }`, validated with Zod.
- Requests are idempotent per group/traveller and remain PENDING. They do not add
  members, notify owners or offer an approval flow.
- Corrupt/unavailable storage produces a useful error. The traveller dialog can
  clear requests after confirmation. Local identity and requests are independent.
- This state is local to one browser/origin, untrusted and unauthenticated. Future
  backend work must replace matching and persistence before claiming shared results.

## Dependencies and file inventory

New runtime packages: `react-router-dom`, `react-hook-form`, `zod`,
`@hookform/resolvers`, `@radix-ui/react-dialog`, `@radix-ui/react-checkbox`.
New development tools: `vitest`, `@playwright/test`, `agent-browser`.
Existing React 19, Vite, TypeScript, Tailwind 3.4, Zustand and Lucide are retained.
No Axios, Query, notification package, backend library or other styling framework
was retained from the broader draft.

Modified existing files: root `README.md`, `Agent.md` (frontend notes only),
`frontend/{package.json,package-lock.json,.gitignore,README.md,tailwind.config.js}`,
`frontend/src/{App.tsx,index.css}`. New modules are listed in the architecture
section, plus `frontend/playwright.config.ts`, `frontend/tests/discovery.spec.ts`,
the mock utility/service tests, `AGENTS.md`, this file and the implementation plan.
`backend/` and the official data pack are unchanged.

## Validation

- Matching/service tests: 15 passed, covering all six rules, exact boundaries,
  duplicate interests, sort immutability, persistence, idempotency and storage errors.
- Playwright: 9 passed, covering Home/navigation, search/empty/reset/sort/detail
  links, validation/focus, pending requests/refresh/identity switching, invalid
  records/URLs, images and overflow at 360, 390, 768 and 1440 pixels.
- Initial browser failures exposed mobile hero minimum-width overflow and an
  ambiguous sort label. Both were fixed and all browser tests rerun successfully.
- Agent-browser: details WCAG A/AA audit: zero violations and zero incomplete checks.
- Final typecheck, production build, lint and further page audits are recorded
  below when completed. ESLint is not configured; use the existing Oxlint script.
- No reference screenshot was found in the session or repository; visual direction
  follows the explicit Booking palette/layout brief and was reviewed in Chrome.

## Remaining work / next recommended task

Implement backend discovery endpoints with the same typed search/detail/request
contract and rule tests, then replace the mock adapter. Plan signup reuse/integration
with the teammate before adding it. Approval, booking and other categories require
separate scoped tasks; they are not hidden unfinished features in this prototype.

## Implementation history

- 2026-11-13 · `main` · baseline `735d7dd`: inspected original scaffold, preserved
  teammate backend/test architecture, implemented Home and discovery directly in
  the existing frontend. Latest scope explicitly narrows the earlier full-journey
  brief. Changes remain uncommitted and unpushed as requested.

- 2026-11-13 · `main` · `2b658a4`: real traveller signup/login, database sequence/backfill, exactly seven-day identity and protected dashboard; task/API/context/skill documentation completed afterwards. Original discovery history remains above.

- 2026-11-13 · `main` · after pulling `938b633`: **M5 join requests**. Backend: `join_requests` table (migration `…07`), `joinRequests` router → controller → service → helper, transactional approval with a group row lock and size re-check, owner-only 403s, `GET /api/join-requests/incoming` for notifications, real `pending_requests` in My groups. Frontend routes: `/my-requests` (new, protected). Group details page shows an Interested button with disabled reasons (owner/member/full/pending/declined) for seekers, and a Join requests section for owners (seeker age, gender, home city, gender preference, interests with shared ones highlighted, Approve / Decline with confirmation). My groups shows a notification panel of who is interested; the header has a bell with the pending count and a My requests nav link. No new dependencies. Tests: backend 123 unit + 50 integration passing; frontend typecheck, Oxlint (0 errors) and Vitest 65 passing; Playwright `joinRequests.spec.ts` 4/4 passing against the real backend; production build passes. Pre-existing `discovery.spec.ts` failures (7) come from `/group-match` now requiring sign-in in `938b633`. Note: the dev DB was reset by `migrate:rollback --all` during this work, so app-created dev rows (T-025+, G-1001+, searches) were lost; verify migration `down` on the test DB in future.
- 2026-11-13 · `main` · traveller profile page (demo reputation), ticket `tasks/TASK-X1-traveller-profile-reviews.md`. New route `/travellers/:travellerId` (`src/features/profile/TravellerProfilePage.tsx`, `profile.css`). The profile itself is real (`GET /api/travellers/:id`). Reviews, ratings and Reddit-style up/down votes (on the profile and on each review) are **sample data** from `src/services/mock/reputationMock.ts` via `src/services/reputationService.ts`, shown with a visible "sample data" note; a viewer's own votes are kept only in this browser under `gtm.demo.reputation-votes.v1`. Owners reach it from "View profile" on join-request cards and from seeker names in the My groups notifications (Back link returns to the group's requests). No backend changes. Tests written but not run in this session (user runs them): Vitest `src/services/mock/reputationMock.test.ts`, Playwright `tests/profile.spec.ts`. Typecheck and Oxlint pass.

- 2026-11-13 · `main` · after pulling `2aa78ec`: **M6 Common Group Page** (uncommitted). Backend: migration `…08` (`saved_hotel_options`, `group_bookings`), members-only `GET /api/groups/:id/hotels`, `GET|POST /saved-options`, `DELETE /saved-options/:roomId`, `GET|POST /booking` (transaction + group row lock + availability re-check, 409 on second booking). Frontend: hotel search section under the members on `/groups/:groupId` (search bar, sort, Amazon/Booking-style price-per-night filter, stars/refundable/sold-out filters, heart-to-shortlist, alignment, finalise popup, locked booking banner, trip progress hotel/booked steps); new protected route `/groups/:groupId/hotels/:hotelId` (gallery + lightbox, overview, rooms table, OpenStreetMap iframe, Reddit-style **mock** reviews with votes/nested replies, user-requested no API); new route `/credits` (hotel photo credits from the backend-served ATTRIBUTIONS.md). State: `useGroupHotelStore` (persisted cache + filters, stale-while-revalidate) and `useHotelReviewStore` (persisted mock interactions). `API_BASE_URL` exported from `lib/api.ts`. No new dependencies. Migration `down` verified with `knex migrate:down` (single step) so dev data was kept. Verified during development: backend unit 158 + integration 57 passing; frontend typecheck, Oxlint (only the pre-existing button.tsx warning), Vitest 79 passing, Playwright `groupHotels.spec.ts` 2 passing; full final suite run pending.
- 2026-11-13 · `main` · **owner can remove members** (M5 follow-up, user request; reverses the ticket's "membership is final"). `DELETE /api/groups/:groupId/members/:travellerId`, migration `…09` adds status `REMOVED`; transaction removes from `member_ids` and marks the request REMOVED so the traveller can't re-request. UI: Remove + confirm on member cards for the owner, "Removed from group" state for the seeker, Removed filter in My requests. Dev DB migrated forward (no data loss). Typecheck/Oxlint pass; tests written (backend unit + integration, Vitest, Playwright) and left for the developer to run.
- 2026-11-13 · `main` · **S1 team chat** (ticket `tasks/TASK-S1-group-chat.md`). Migration `…10` (`group_chats`, `chat_messages`, `chat_poll_options`, `chat_poll_votes`); `groupChat` router → controller → service → helper at `/api/groups/:groupId/chat` (members only, opens after the M6 booking, 409 before). Simple access: owner can do everything; members send messages / create polls when the owner's Group settings allow (`ALL_MEMBERS` / `OWNER_ONLY`); announcements owner-only; everyone votes. Message IDs `M-1001`+, chat IDs `C-1001`+. Frontend route `/groups/:groupId/chat` (`src/features/chat/`), Chat with team button on the group page (disabled until booked), polling every 4 s, optimistic poll votes with rollback. Dev DB migrated forward. Migration order on dev/test was also normalised (08 hotels before 09 removed-status) with data backed up and restored. Ticket sweep: M1 lookups, M2 new-group-in-matches, M5 removal and X1 criteria ticked from passing tests; M2 execution plan filled in; PLAN.md has a status table.
  - S1 test results (background run): backend 179 unit + 68 integration passing; Vitest 103 passing; production build passing; Playwright chat/joinRequests/groupHotels/profile/groups specs 21/21 passing. Two bugs found and fixed during testing (message sequence START value; poll counts not refreshing for other members). `discovery.spec.ts` still has its 7 known failures (spec doesn't sign in since `/group-match` became protected in `938b633`).

- 2026-11-13 · `main` · after pulling `803d828`: **TASK-X2 live trip status on My groups** (uncommitted). Backend: `stage` now `LOBBY_OPEN | LOBBY_FULL | HOTEL_SHORTLISTED | BOOKED` from `groups.service.stageOf(group, hotelStatus)`; Group DTO adds `hotel_status`; `/api/groups/mine` adds a `booking` summary; new read `groupHotels.helper.hotelStatusByGroups` (2 queries). No migration, no new endpoint. Frontend: `useMyGroupsStore` (Zustand persist, per traveller, stale-while-revalidate) + `useLiveMyGroups` (refresh on open, focus/visibility, every 20 s while visible, cross-tab `storage` event, and after hotel save/book in this tab); status pill with 4 colours that pops on change; booked cards show hotel, booking ID and your share; shortlisted cards link to `#hotels`; status filter has all 4 stages; "Live · updated Xs ago" indicator with manual refresh. Group page pill uses the same stage (`liveStage`). Tests: backend unit 168 / integration 63 passing; frontend Vitest 101 passing; Playwright `liveStatus.spec.ts`, `groupHotels.spec.ts`, `groups.spec.ts` passing.

- 2026-11-13 · `main` · on top of `012a5f3` (uncommitted): **TASK-X3 Ask the reviews (contextual retrieval)**. Postgres image switched to `pgvector/pgvector:pg16` on the same volume (REINDEX done for `booking` and `booking_test`; dump kept outside the repo). Migrations `…11_create_reviews` (extension `vector`; `reviews`, `review_chunks` with `vector(768)` + HNSW, `review_questions`) and `…12_seed_reviews` (loads `backend/data/reviews/corpus.json` + `index.json`). Hotel and traveller review texts moved from the browser mocks into Postgres (identical IDs/text; votes and replies stay local). Offline scripts `reviews:corpus`, `reviews:index` (Ollama: `gemma3:4b` writes one context per chunk, `nomic-embed-text` embeds; resumable), `reviews:apply`. Runtime has **no model calls** (guard test `noRuntimeModel.test.js`): BM25 in memory (`helpers/bm25`, k1 1.2, b 0.75) + pgvector (`helpers/vector`) fused with RRF (k 60); query vector = precomputed suggested-question embedding or the mean of the top-3 BM25 chunk embeddings; similarity floors 0.6 / 0.85 plus a 0.1 margin, calibrated on the index. Endpoints `GET /api/reviews/:hotels|travellers/:id`, `…/questions`, `…/search?q=&limit=`; hotel search adds `review_count`. Frontend: `AskReviews` (Booking-style yellow search box, suggested-question chips that become a swipe row on phones, recent questions, debounced, previous answer kept dimmed while loading, highlighted passages, keyword/meaning/fused rank chips, search context on demand, "Read full review" jump) on the hotel Guest reviews and the traveller profile; `useReviewSearchStore` (Zustand cache, persisted recent questions); `reputationService` now composes API reviews with the mock profile votes. Also fixed: rooms table sr-only header caused 258px horizontal scroll on the hotel page at phone width; profile grid items can shrink. Tests: backend unit 217 / integration 78 passing; frontend Vitest 120 passing; Playwright `askReviews.spec.ts` + hotels/profile/live/groups specs passing (full run: 7 known `discovery.spec` failures from `938b633`; `joinRequests`/`profile` timeouts only under CPU load while Ollama indexes, pass alone). Offline index was still building at write time (resume with `npm run reviews:index`).
- 2026-11-13 · `main` · **M5 request lifecycle follow-ups** (user request; see the M5 ticket): optional note with a join request, seeker cancels a pending request, member leaves a group, other pending requests close automatically when an approval fills the group, and removal/leaving after booking warns in the dialog and re-splits the booking (same total, `round(total ÷ members)`). Migration `…13`; endpoints `POST /api/join-requests/:id/cancel`, `POST /api/groups/:id/leave`; removal/leave responses include `booking_update`. Frontend: note dialog on Interested, Cancel request (group page + My requests), Leave group button, cost-split warnings, new statuses Cancelled / Left / Group filled. Dev DB not migrated yet (it still needs the X3 pgvector steps: REINDEX + `npm run migrate`, which also applies `…11`–`…13`).
  - Results: backend 229 unit + 83 integration passing, Vitest 127 passing, build passing. Playwright `memberLifecycle.spec.ts` and the updated `joinRequests.spec.ts` not run yet (dev DB needs the X3 upgrade + migrations first).
