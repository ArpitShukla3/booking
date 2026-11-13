# Work split plan: 2 developers, 6 deliverables

The problem statement has 6 Must-have deliverables (M1–M6). They are split into **two tracks of 3 tickets**. The split follows the two user flows in the problem statement, so each developer owns whole features end to end: DB tables, backend API, and frontend pages.

| Track | Developer | Tickets | Owns |
|---|---|---|---|
| **A: Traveller / Seeker** | Dev A | [M1 Sign up](TASK-M1-sign-up.md) · [M3 Traveller search](TASK-M3-traveller-search.md) · [M4 See matches](TASK-M4-see-matches.md) | identity, lookups, searches, matching engine |
| **B: Group / Owner** | Dev B | [M2 Create group post](TASK-M2-create-group-post.md) · [M5 Join requests](TASK-M5-join-requests.md) · [M6 Common Group Page](TASK-M6-common-group-page.md) | groups, join requests, hotels, cost split, booking |

**Why this split works:**
- The tracks meet in only **3 places**: the current traveller (header), the Group object shape, and one link (match card → group page). All 3 are fixed in §2–§3 **before** anyone starts, so neither developer waits for the other.
- Each track writes to **different tables**, so migrations never conflict.
- The DB already holds the 24 travellers and 12 groups. Track B can build with seeded travellers (`T-001` Sarah) before M1 exists. Track A can match against seeded groups before M2 exists.
- The work is balanced: A has the hardest logic (M4, 25% of the score is correctness). B has the most UI and flow (M6). A takes G1/G2 afterwards, so B has more time for M6.

---

## 1. Phase 0: shared foundation (both devs together, about 45–60 min, one PR)

Do this **together, before splitting**. This is the only shared code. After it is merged, each developer works only in their own files.

### Backend
The backend follows **router → controller → service → helper** (`Agent.md` §4.1). `/api/health` is the reference example.
- [x] Layered folders: `src/routes/`, `src/controllers/`, `src/services/`, `src/helpers/postgres/`, `src/middleware/`, `src/utils/`
- [x] `src/routes/index.js`: mounts one router per feature under `/api`. `server.js` only does `app.use('/api', routes)`.
- [x] `src/utils/HttpError.js` + `src/middleware/errorHandler.js`: the error shape in §3
- [x] `src/helpers/postgres/client.js` (the only Knex instance) + `transaction.helper.js` (`withTransaction`)
- [ ] `src/middleware/currentTraveller.js`: reads the **`X-Traveller-Id`** header, loads the traveller through `helpers/postgres/travellers.helper.js` (`findById` only), and sets `req.traveller`. Exports `requireTraveller` (401 if the header is missing or the traveller is unknown).
- [ ] `src/utils/dates.js`: pure date functions: `isInDataWindow(checkIn, checkOut)` (2027-04-01 ≤ in < out ≤ 2027-04-20), `nightsBetween(in, out)`, `listNights(in, out)`. All work on `YYYY-MM-DD` strings.
- [ ] `src/utils/validate.js`: pure validators: `assertEnum`, `assertPositiveInt`, `assertDateRange`. A check that needs the DB (e.g. "city exists") belongs in a service, which calls `helpers/postgres/lookups.helper.js`.
- [ ] Migration `<ts>_id_sequences.js`: creates `traveller_id_seq` and `group_id_seq`, both starting at **1001**.
- [ ] Empty router/controller/service/helper files for both tracks, each owned by one dev (see §4).

### Frontend
- [ ] Install `react-router-dom`. `src/App.tsx` holds the route table plus the layout (header with the current traveller's name and nav links).
- [ ] `src/lib/api.ts`: a `fetch` wrapper. Base URL is `import.meta.env.VITE_API_URL` (default `http://localhost:4000`). It sends `X-Traveller-Id` automatically and throws the `{error}` shape as a typed error.
- [ ] `src/store/session.ts`: Zustand store with `persist` (localStorage): `currentTravellerId`, `setCurrentTraveller`, `clear`. Remove the placeholder `useCounterStore.ts`.
- [ ] `src/types/api.ts`: the shared TypeScript types from §3 (`Traveller`, `Group`, `Destination`, `Interest`, `ApiError`).
- [ ] `.env.example` in the frontend with `VITE_API_URL`.
- [ ] **Dev shortcut** until M1 is done: opening the app with `?as=T-001` sets the current traveller. It stays as a debug feature.

### Decisions fixed in Phase 0 (write them in `Agent.md` §8)
| Decision | Value |
|---|---|
| Identity | No auth. The client stores `currentTravellerId`. Every request sends the `X-Traveller-Id` header. |
| New traveller IDs | `'T-' \|\| nextval('traveller_id_seq')` → `T-1001`, `T-1002`, … (seeded ones are `T-001`–`T-024`) |
| New group IDs | `'G-' \|\| nextval('group_id_seq')` → `G-1001`, … (seeded ones are `G-01`–`G-12`) |
| Enum values | Same as the data: `FEMALE`/`MALE`, `ANY`/`SAME_GENDER`, `PENDING`/`APPROVED`/`REJECTED` |
| Money | Whole INR integers. Per-member cost is rounded to the nearest rupee. |

---

## 2. Integration contract (fixed: change it only if both devs agree)

### 2.1 Current traveller
The backend reads `X-Traveller-Id`. The frontend gets it from `useSession().currentTravellerId`. That is all either track needs from the other for identity.

### 2.2 Group object: the only shape both tracks use
Track B returns it. Track A shows it on match cards.
```ts
type Group = {
  group_id: string;
  name: string;
  city: string; country_name: string;
  check_in: string; check_out: string; nights: number;      // YYYY-MM-DD
  max_size: number; members_count: number; spots_left: number;
  budget_inr: number;
  itinerary: string | null;
  owner: { traveller_id: string; name: string; gender: 'FEMALE'|'MALE' };
  member_ids: string[];
};
```
A match (Track A) is `{ group: Group, score: number, reasons: MatchReasons }`.

### 2.3 The handoff link
A match card links to **`/groups/:groupId`** (Group Details page, Track B). The "Interested" button lives on that page. Track A never calls the join-request API.

---

## 3. API contract

Errors from every endpoint: `{ "error": { "message": string, "fields"?: { [field]: string } } }`, using HTTP 400 (validation), 401 (no traveller), 403 (not allowed), 404, 409 (conflict, e.g. full group or already booked).
🔒 = needs `X-Traveller-Id`.

### Track A
| Method | Path | Ticket | Notes |
|---|---|---|---|
| GET | `/api/interests` | M1 | lookups. **Build these first** (B needs them for the M2 form) |
| GET | `/api/destinations` | M1 | `[{city, country_code, country_name, timezone}]` |
| GET | `/api/departure-cities` | M1 | |
| POST | `/api/travellers` | M1 | sign up → `Traveller` |
| GET | `/api/travellers` | M1 | for "continue as existing traveller" |
| GET | `/api/travellers/:id` | M1 | B may call this to show member details |
| POST | `/api/searches` 🔒 | M3 | saves and returns a search |
| GET | `/api/searches` 🔒 | M3 | my recent searches |
| GET | `/api/searches/:id` 🔒 | M3 | |
| GET | `/api/searches/:id/matches` 🔒 | M4 | `[{group, score, reasons}]`, ranked |

### Track B
| Method | Path | Ticket | Notes |
|---|---|---|---|
| POST | `/api/groups` 🔒 | M2 | owner = current traveller → `Group` |
| GET | `/api/groups/mine` 🔒 | M2 | owned + member groups, with `pending_requests` count |
| GET | `/api/groups/:id` | M2 | `Group` + member profiles |
| POST | `/api/groups/:id/join-requests` 🔒 | M5 | seeker sends a request |
| GET | `/api/groups/:id/join-requests` 🔒 | M5 | owner only |
| POST | `/api/join-requests/:id/approve` 🔒 | M5 | owner only; transaction; 409 if full |
| POST | `/api/join-requests/:id/reject` 🔒 | M5 | owner only |
| GET | `/api/join-requests/mine` 🔒 | M5 | the seeker's requests + status |
| GET | `/api/groups/:id/hotels` 🔒 | M6 | members only; options with total + per-member cost |
| GET / POST / DELETE | `/api/groups/:id/saved-options` 🔒 | M6 | shortlist + alignment |
| GET / POST | `/api/groups/:id/booking` 🔒 | M6 | one booking per group; 409 if one already exists |

---

## 4. Who owns which files (so changes don't conflict)

| | Track A | Track B |
|---|---|---|
| Backend features (each has `routes/<f>.routes.js`, `controllers/<f>.controller.js`, `services/<f>.service.js`, `helpers/postgres/<f>.helper.js`) | `lookups`, `travellers`, `searches`, `matches` | `groups`, `joinRequests`, `groupHotels` |
| Pure logic + unit tests | `services/matching.service.js` (the 6 rules, scoring; no DB) | `services/hotelPricing.service.js` (rooms needed, total, per member; no DB) |
| Migrations / tables | `searches` | `join_requests`, `saved_hotel_options`, `group_bookings` |
| Frontend pages | `/signup`, `/login`, `/search`, `/searches/:id/matches`, `/me` | `/groups/new`, `/my-groups`, `/groups/:groupId`, `/groups/:groupId/hotels`, `/my-requests`, `/credits` |
| Frontend folders | `src/features/traveller/`, `src/features/search/` | `src/features/groups/`, `src/features/hotels/` |

**Cross-track reads:** if your service needs the other track's data (e.g. Track B shows member profiles, Track A reads groups for matching), **call the other track's helper read functions** (`travellers.helper.findByIds`, `groups.helper.listOpenByCity`). Don't write your own SQL against their tables. Ask the owner to add a missing read function; it's a small additive change.

**Shared files after Phase 0:** `routes/index.js`, `App.tsx` (route table), and the header nav. Only **add lines** to them (one per route); don't rewrite them. Any merge conflict there is then trivial.

**Migrations:** each developer creates only their own migration files (`npx knex migrate:make ...`). The tables are separate, so the run order between tracks does not matter. Never edit a migration that is already pushed (`Agent.md` §6).

---

## 5. Timeline and sync points

```
          Dev A (Traveller/Seeker)              Dev B (Group/Owner)
Phase 0   ────────── Shared foundation together (§1), merge to main ──────────
Phase 1   M1: lookups first (≈30 min, push!)   M2: groups API + create form
          → sign-up, choose traveller, header  → My Groups, Group Details page
          ═══ SYNC 1: merge M1 + M2. B swaps the temporary city list for /api/destinations ═══
Phase 2   M3: searches table, form, validation M5: join_requests, Interested button,
          M4: matching.js + unit tests          owner badge, approve/reject (txn)
          ═══ SYNC 2: run Scenario B end to end: search → match → details → interested → approve ═══
Phase 3   M4: ranking, reasons UI, empty state  M6: hotel search + cost, shortlist,
          then G1 filters, G2 member profiles  alignment, confirm popup, booking lock
          ═══ SYNC 3: full demo rehearsal (§6), README, known limitations ═══
Phase 4   Stretch S1 chat / polish: whoever finishes first
```

At every sync point:
1. Both rebase on `main`, merge their PRs, run `npm run migrate`, and smoke-test together.
2. **Each dev spends 5 minutes walking the other through their code.** Judges question each team member on the whole codebase (20% of the score).

---

## 6. Integration checklist (definition of done for the team)

- [ ] **Scenario A:** Dev 1 signs up (or acts as Sarah) → creates a Kyoto group 10–15 Apr, 3 people, ₹60,000.
- [ ] **Scenario B:** Dev 2 signs up as Priya → searches Kyoto 9–16 Apr, ₹62,000, TEMPLES/STREET_FOOD/ADVENTURE, SAME_GENDER → sees Sarah's group with clear reasons → Interested.
- [ ] Sarah sees the badge → approves → group 2/3.
- [ ] Both open the Common Group Page → Twin Room `RM-KYO-001-A` shows ₹23,800 total, ₹11,900 each → save → book → confirmation popup → booking is locked.
- [ ] Refresh and restart the backend: everything is still there.
- [ ] **Judge request drill:** add a new traveller with new dates/interests, and check the matches for each of the 6 rules (boundary cases in TASK-M4).
- [ ] Out-of-data city or date → clear message everywhere (M2, M3).
- [ ] Root README: start in 1–2 commands, architecture, ranking formula, what's finished, known limitations.

---

## 7. Working rules

- **Branches:** `a/m1-sign-up`, `b/m2-create-group`, … PR to `main`. Keep each PR small. Merge at least at every sync point.
- **Commits:** start with the ticket ID (`M4: add budget rule + tests`). Push **at least every hour**. The judges check the Git history.
- **Contract changes** (§2–§3) are agreed by both devs and updated in this file in the same commit.
- **Ticket status:** tick the acceptance checkboxes in the ticket file as they pass.
- No AI/LLM calls inside the app. The data pack stays read-only.
