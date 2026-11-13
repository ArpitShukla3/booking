# Agent.md: Group Travel Matcher

Read this file before you change anything in this repository. It is written for human developers and AI coding agents.
It records what has been built so far, how the database is set up, and the rules everyone follows so changes do not conflict.

**Last updated:** 2026-11-13

---

## 1. What this project is

This is a hackathon project: **Intern Hackathon, Problem 3: Group Travel Matcher**. Travellers either post a group trip or search for a group to join. The app matches them using 6 rules. Group members then search hotels together, see the cost per person, and confirm one booking.

| Document | Location |
|---|---|
| Problem statement | `hackathon-problem-3-group-travel-matcher/problem-3-group-travel-matcher.md` (also the PDF in the repo root) |
| Data dictionary: every file, field, and worked example | `hackathon-problem-3-group-travel-matcher/DATA_DICTIONARY.md` |
| Photo credits | `hackathon-problem-3-group-travel-matcher/images/ATTRIBUTIONS.md` |

**Hard rules from the organisers (do not break):**
1. Never modify anything in `hackathon-problem-3-group-travel-matcher/`. The judges use the same files.
2. All business logic (matching, ranking, approvals, cost calculation) runs in the **backend**.
3. The frontend gets **all** data from the backend API. It never reads the data files.
4. Data must persist across page refresh and backend restart (it lives in Postgres).
5. **The app must not call any AI/LLM model.**
6. The app must start with 1–2 commands, documented in the README.
7. Push to Git at least every hour. Judges check the Git history.

---

## 2. Repository layout

```
booking/
├── Agent.md                     ← this file
├── README.md
├── hackathon-problem-3-group-travel-matcher/   ← READ-ONLY data pack
│   ├── data/catalog/            destinations, hotels, rooms, availability
│   ├── data/problem-3/          travellers, groups, interests
│   └── images/hotels/           10 hotel photos (JPG)
├── backend/                     ← Node.js + Express + PostgreSQL
│   ├── docker-compose.yml       Postgres 16 (alpine) container
│   ├── knexfile.js              Knex config (also sets the DATE type parser)
│   ├── .env.example             copy to .env
│   ├── migrations/              Knex migrations (schema + data load)
│   ├── tests/                   test-first: unit/ (low) + integration/ (mid) (section 4.2)
│   └── src/                     layered: router → controller → service → helper (section 4.1)
│       ├── app.js               Express app: CORS, JSON, /images static, mounts /api, error handler
│       ├── server.js            starts app.js on PORT, graceful shutdown
│       ├── config.js            reads .env, resolves DATA_DIR
│       ├── routes/              index.js (mounts all) + <feature>.routes.js
│       ├── controllers/         <feature>.controller.js
│       ├── services/            <feature>.service.js (business logic)
│       ├── helpers/
│       │   └── postgres/        client.js (the only Knex instance), transaction.helper.js,
│       │                        <feature>.helper.js (all SQL lives here)
│       ├── middleware/          errorHandler.js (+ currentTraveller.js later)
│       └── utils/               HttpError.js, pure functions (dates, validation)
├── frontend/                    ← React 19 + Vite + TypeScript + Tailwind 3.4 (Home + Group Match discovery demo)
├── tasks/                       PLAN.md (2-dev split) + TASK-M1…M6 tickets
└── .agents/skills/backend-feature/SKILL.md   AI-agent skill for backend work
                                 (also linked at .claude/skills/backend-feature)
```

---

## 3. Quick start

Requirements: Node.js ≥ 20 (developed on v24), Docker with Compose v2.

```bash
# Backend
cd backend
cp .env.example .env     # first time only
npm install
npm run setup            # docker compose up (waits for healthy) + run all migrations
npm run dev              # API at http://localhost:4000 (auto-restart on change)

# Frontend (separate terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

To check that the backend works: `curl localhost:4000/api/health` should return `{"status":"ok","db":"up"}`.

### Backend npm scripts

| Script | What it does |
|---|---|
| `npm start` / `npm run dev` | Run the API (dev mode restarts the server when files change) |
| `npm run db:up` / `db:down` | Start / stop the Postgres container |
| `npm run setup` | `db:up` + `migrate` (use this the first time) |
| `npm run migrate` | Run pending migrations |
| `npm run migrate:status` | Show which migrations have run |
| `npm run migrate:rollback` | Roll back **all** migrations |
| `npm run db:reset` | **Delete the DB volume**, recreate the DB, migrate again. Data your app created is lost. |
| `npm test` | Unit tests, then integration tests (Postgres must be running) |
| `npm run test:unit` | Low-level tests only (no DB, ~0.2 s) |
| `npm run test:integration` | Creates/migrates `booking_test` if needed, then the mid-level API tests |
| `npm run test:watch` | Re-run unit tests on every file change |

### Environment variables (`backend/.env`)

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | API port |
| `COMPOSE_PROJECT_NAME` | `booking` | Docker Compose resource namespace; keeps this project's volume separate from other projects named `backend`. |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | Postgres address. `DB_PORT` is also the host port in docker-compose. |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `booking` / `booking` / `booking` | Credentials, shared by docker-compose and Knex |
| `DATA_DIR` | `../hackathon-problem-3-group-travel-matcher` | Path to the data pack, relative to `backend/` |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated list of allowed frontend origins |
| `DB_NAME_TEST` | `<DB_NAME>_test` | Database the tests use. Selected automatically when `NODE_ENV=test`. Tests never touch the dev DB. |

`.env` is git-ignored. If you add a variable, add it to `.env.example` and to this table too.

If port 5432 is already in use on your machine, set `DB_PORT=5433` (any free port) in `.env`, then run `npm run db:down && npm run setup`.

To open a psql shell: `docker exec -it booking-postgres psql -U booking -d booking`

---

## 4. Backend stack

| Piece | Choice | Notes |
|---|---|---|
| Runtime | Node.js, **CommonJS** (`require`) | Keep CommonJS: the Knex CLI and migrations use it |
| HTTP | Express **5** | Errors thrown in async route handlers reach the error handler automatically |
| DB | PostgreSQL 16 via `docker-compose.yml` | Container `booking-postgres`, volume `booking_pgdata` when using the example `.env` |
| Query builder / migrations | Knex 3 + `pg` | Migration history table: `knex_migrations` |
| Config | `dotenv` | Loaded once in `src/config.js` |

Implemented so far:
- `GET /api/health`: runs `select 1` against the DB (200 `{"status":"ok","db":"up"}`, or 503 when the DB is down). **This is the reference example of the 4 layers.** Copy its shape for new features.
- `GET /images/*`: static files from `<DATA_DIR>/images` (hotel photos).
- A JSON 404 handler and a central error handler (`src/middleware/errorHandler.js`).
- Graceful shutdown on SIGINT/SIGTERM (closes the DB pool).

**No feature endpoints exist yet.** See the roadmap in section 9.

### 4.1 Backend architecture: router → controller → service → helper

Every request goes through these layers, in this order. A layer only calls the layer directly below it.

```
HTTP request
   │
   ▼
routes/<feature>.routes.js          WHERE: method + path + middleware → controller function
   │
   ▼
controllers/<feature>.controller.js HTTP IN/OUT: read req (params, query, body, req.traveller),
   │                                call ONE service function, send status + JSON
   ▼
services/<feature>.service.js       WHAT: business rules, validation, matching, cost maths,
   │                                permissions, transactions. Throws HttpError.
   ▼
helpers/postgres/<feature>.helper.js HOW DATA IS STORED: Knex/SQL queries, return plain rows
   │
   ▼
PostgreSQL
```

| Layer | Allowed | Not allowed |
|---|---|---|
| **Router** | `router.get/post(...)`, attaching middleware (e.g. `requireTraveller`), pointing to a controller function | Any logic, any DB access |
| **Controller** | Reading `req`, calling a service, choosing the status code, `res.json(...)` | SQL / Knex, business rules, calling helpers directly |
| **Service** | Business logic, input validation, combining several helpers, `withTransaction(...)`, `throw new HttpError(...)`, calling other services | `req`/`res`, Knex/SQL, importing `helpers/postgres/client.js` |
| **Helper** | Knex queries on the tables it owns; accepts an optional `trx` as its last argument; returns plain objects | HTTP status codes, business rules (e.g. "is the group full?" belongs in the service) |

**Helpers are the data-access layer.** Today they live only in `helpers/postgres/`. Other data sources added later get their own folder next to it (e.g. `helpers/cache/`, `helpers/storage/`). Services then use them the same way, and swapping storage does not touch services, controllers, or routes.

**`utils/` vs `helpers/`:** `utils/` holds pure functions with no I/O (date maths, `HttpError`, validators). `helpers/` is only for talking to a data store.

**Naming:** one feature → four files with the same name: `groups.routes.js`, `groups.controller.js`, `groups.service.js`, `helpers/postgres/groups.helper.js`. Export plain functions (`module.exports = { createGroup, getGroup }`), not classes.

**Errors:** services throw `HttpError` (`HttpError.badRequest(msg, fields)`, `.unauthorized()`, `.forbidden()`, `.notFound()`, `.conflict()`). Controllers don't catch: Express 5 sends async errors to `errorHandler`, which always returns `{ "error": { "message", "fields"? } }`. Unknown errors become 500 and are logged.

**Transactions:** when two or more writes must succeed together (e.g. approve a request + add the member), the service wraps them in `withTransaction(async (trx) => { ... })` from `helpers/postgres/transaction.helper.js`, and passes `trx` to every helper call inside.

**Mocking rule:** services import helpers as module objects and call `helper.fn()`. Never destructure them (`const { fn } = require(...)`), or unit tests can't mock them with `mock.method`.

**Adding a feature (checklist). AI agents: use the `backend-feature` skill, which has this in full with templates:**
1. **Write the tests first** from the ticket's acceptance criteria (section 4.2). Run them and see them fail.
2. Migration for any new table (section 6)
3. `helpers/postgres/<feature>.helper.js`: queries
4. `services/<feature>.service.js`: rules + validation
5. `controllers/<feature>.controller.js`: req → service → res
6. `routes/<feature>.routes.js`, then **one line** in `routes/index.js`: `router.use('/<path>', require('./<feature>.routes'));`
7. `npm test`: everything green, including the old tests
8. Document the endpoint (section 4 / `tasks/PLAN.md` §3)

### 4.2 Testing (test-first, two levels)

**Rule: for every new feature or bug fix, write the tests BEFORE the code.** Run them to see them fail, then implement until they pass. Tool: Node's built-in `node:test` + `node:assert/strict`, plus `supertest` for HTTP. No other test framework.

| Level | Folder | Scope | DB |
|---|---|---|---|
| **Low (unit)** | `tests/unit/{services,controllers,middleware,utils}/` | One function. Services with helpers mocked (`mock.method`); pure rules (matching, pricing, dates) called directly; controllers with the service mocked + `mockRes()` | none |
| **Mid (integration)** | `tests/integration/<feature>.api.test.js` | Real HTTP request → all 4 layers → real `booking_test` DB (seeded with the data pack) | test DB |

High-level tests (browser end-to-end, load) are out of scope for now.

```
backend/tests/
├── setup/env.js               sets NODE_ENV=test (loaded with --import before tests)
├── setup/prepare-test-db.js   creates booking_test if missing + runs migrations (auto before integration)
├── helpers/http.js            api() and asTraveller('T-001') (adds the X-Traveller-Id header)
├── helpers/db.js              db, truncate(...appTables), closeDb (call in after())
├── helpers/mockRes.js         fake Express res for controller/middleware unit tests
├── unit/                      services/, controllers/, middleware/ (+ utils/ as needed)
└── integration/               health.api.test.js, seed-data.test.js, <feature>.api.test.js
```

What to cover:
- **Low:** every business rule and its boundaries (e.g. 1 vs 2 shared nights, budget diff exactly 40% vs 40% + ₹1, a full group, SAME_GENDER both ways, rooms = ceil(members / max_adults)).
- **Mid:** for each endpoint: the happy path, 400 with `fields`, 401 without `X-Traveller-Id`, 403/404/409 where relevant, and persistence (write → read back). Use the data dictionary's worked examples as expected values.

Integration hygiene:
- Clean only app-created data (`truncate('join_requests')`, or delete IDs ≥ `T-1001` / `G-1001`).
- Never truncate data-pack tables.
- Files run one at a time. Always `after(closeDb)`.

Current suite: 11 unit + 9 integration tests (health, error handling, image serving, seed-data correctness). All pass.

---

## 5. Database schema

Table names match the data-pack file names. Every ID is the stable text ID from the data (`T-001`, `G-01`, `HTL-KYO-001`, `RM-KYO-001-A`, `TEMPLES`), used as the primary key.

### `interests` ← `data/problem-3/interests.json` (16 rows)
| Column | Type | Notes |
|---|---|---|
| `interest` | text PK | e.g. `TEMPLES` |
| `label` | text | display text |
| `category` | text | `CULTURE`, `FOOD`, `SOCIAL`, `HOBBY`, `NATURE`, `ACTIVITY`, `STYLE` |

### `destinations` ← `data/catalog/destinations.json` → `countries[].cities[]` (5 rows)
| Column | Type | Notes |
|---|---|---|
| `city` | text PK | Tokyo, Kyoto, Osaka, Dubai, Abu Dhabi |
| `country_code` | text | `JP`, `AE` |
| `country_name` | text | |
| `timezone` | text | `Asia/Tokyo`, `Asia/Dubai` |
| `airports` | text[] | |

`destinations.json` is a single nested object, not a list. The rest of it is stored in three extra tables:
- **`departure_cities`** (4 rows): `airport` text PK, `city`. These are the Indian home cities (BLR, DEL, BOM, MAA).
- **`destination_links`** (8 rows): `id` serial, `from_city` → destinations, `to_city` → destinations, `transfer_ids` text[]. Not used by Problem 3.
- **`destination_rules`** (1 row, `id = 1`): `min_nights`, `max_nights`, `min_nights_per_city`, `first_night` date, `last_departure` date. Not used by Problem 3, except that the data window is 2027-04-01 → 2027-04-20.

### `travellers` ← `data/problem-3/travellers.json` (24 rows)
| Column | Type | Notes |
|---|---|---|
| `traveller_id` | text PK | Seeded rows use `T-001`… New sign-ups need an ID scheme that cannot collide with these (see section 8). |
| `name` | text | |
| `age` | int, nullable | |
| `gender` | text | CHECK: `FEMALE` or `MALE` |
| `home_city`, `home_airport` | text | |
| `interests` | text[] | interest IDs; no FK (Postgres arrays cannot have one), so validate in code |
| `gender_preference` | text | CHECK: `ANY` or `SAME_GENDER`; default `ANY` |
| `created_at`, `updated_at` | timestamptz | default `now()` |

### `groups` ← `data/problem-3/groups.json` (12 rows)
| Column | Type | Notes |
|---|---|---|
| `group_id` | text PK | |
| `name` | text | |
| `owner_id` | text FK → travellers | |
| `member_ids` | text[] | **The owner is included.** No FK on array items. |
| `city` | text FK → destinations | |
| `check_in`, `check_out` | date | CHECK `check_out > check_in` |
| `max_size` | int | total people **including the owner**; CHECK > 0 |
| `budget_inr` | int | approximate budget per person |
| `itinerary` | text | |
| `created_at`, `updated_at` | timestamptz | |

Index on `city`. `GROUPS` is a non-reserved SQL keyword: `select * from groups` works in Postgres, but quoting it (`"groups"`) in raw SQL is the safe habit. Knex quotes it for you.

### `hotels` ← `data/catalog/hotels.json` (49 rows)
| Column | Type | Notes |
|---|---|---|
| `hotel_id` | text PK | |
| `name`, `area` | text | |
| `aliases` | text[] | always empty in this data |
| `city` | text FK → destinations | indexed |
| `lat`, `lng`, `rating` | double precision | rating is out of 10 |
| `stars` | int | 2–5 |
| `check_in_from`, `check_out_until` | text | e.g. `15:00` |
| `family_friendly` | boolean | |
| `image` | text | **Stored exactly as in the data**, e.g. `images/hotels/HOTEL-TWIN-1.jpg` (see section 7) |

### `rooms` ← `data/catalog/rooms.json` (125 rows)
| Column | Type | Notes |
|---|---|---|
| `room_id` | text PK | |
| `hotel_id` | text FK → hotels (ON DELETE CASCADE) | indexed |
| `room_type` | text | `SINGLE`, `TWIN`, `DOUBLE`, `TRIPLE`, `FAMILY`, `FAMILY_SUITE` |
| `name` | text | |
| `max_adults`, `max_children` | int | |
| `price_per_night_amount` | int | **Flattened** from `price_per_night.amount` (INR, per room per night) |
| `price_per_night_currency` | text | **Flattened** from `price_per_night.currency`; always `INR` |
| `refundable` | boolean | |

### `availability` ← `data/catalog/availability.json` (2,500 rows)
| Column | Type | Notes |
|---|---|---|
| `room_id` | text FK → rooms (ON DELETE CASCADE) | |
| `date` | date | the **night** (the date you sleep there) |
| `rooms_left` | int | `0` = full |

Primary key: (`room_id`, `date`).

### Relationships
```
groups.owner_id ──► travellers.traveller_id
groups.member_ids[] ──► travellers.traveller_id   (enforced in code, not by the DB)
travellers.interests[] ──► interests.interest      (enforced in code, not by the DB)
groups.city / hotels.city ──► destinations.city
hotels.hotel_id ──► rooms.hotel_id ──► availability.room_id
```

---

## 6. Migrations

Migrations are in `backend/migrations/` and are managed by Knex. Knex runs each migration in a transaction and records it in `knex_migrations`.

| File | What it does |
|---|---|
| `20261113000001_create_tables.js` | Creates every table, constraint, and index in section 5. `down` drops them in reverse FK order. |
| `20261113000002_seed_data_pack.js` | Reads the JSON files from `DATA_DIR/data/...` and inserts them. `destinations.json` is split into 4 tables and `price_per_night` is flattened. `availability` is inserted in batches of 500. `down` runs `TRUNCATE` on all seeded tables. |

After `npm run migrate`, the row counts must be: interests 16, travellers 24, groups 12, destinations 5, departure_cities 4, destination_links 8, destination_rules 1, hotels 49, rooms 125, availability 2,500.
Spot check from the data dictionary: `RM-KYO-001-A`, nights 2027-04-10 → 04-14 → `rooms_left` = 6, 2, 4, 3, 3.

### Migration rules (follow these when working with others)

1. **Never edit a migration after it has been pushed.** Other developers have already run it, and Knex will not run it again. To change the schema, add a **new** migration:
   ```bash
   cd backend
   npx knex migrate:make add_join_requests   # creates migrations/<timestamp>_add_join_requests.js
   ```
2. Every migration must have a working `down`. Test both ways before you push: `npm run migrate:rollback && npm run migrate`.
3. Migration file names start with a timestamp, so they run in order. If two people create migrations at the same time, pull, check the order with `npm run migrate:status`, and rename your **unpushed** file to a later timestamp if needed.
4. Schema changes and data loads go in separate migrations.
5. The data-pack seed migration only loads the read-only files. Never use it to insert app-created data or test data.
6. When you pull new migrations, run `npm run migrate`. If your local DB is broken, run `npm run db:reset` (this deletes all local data).
7. When you add or change a table, update **section 5 of this file in the same commit**.

---

## 7. Hotel images

- `hotels.image` keeps the data-pack value as it is (`images/hotels/HOTEL-XXX-N.jpg`). Do not rewrite it in the DB. How the photos will be used is not decided yet.
- `server.js` serves `<DATA_DIR>/images` at `/images`, so the URL is **`http://localhost:4000/` + `hotel.image`**. The photos are not copied into `backend/`.
- There are only 10 generic photos. Hotels of the same type share one photo.
- If the UI shows photos, it must also show the credits from `images/ATTRIBUTIONS.md` (for example on a "Photo credits" page).

---

## 8. Domain rules and conventions

### Dates
- Format `YYYY-MM-DD`. Valid stays: `check_in` ≥ 2027-04-01 and `check_out` ≤ 2027-04-20.
- **Nights** are `check_in` up to the day before `check_out`. A stay from 10 → 15 April has 5 nights (10–14). The check-out day is not a night.
- `knexfile.js` sets the pg type parser for `DATE` (OID 1082) to return the raw string. **Do not turn DATE columns into JS `Date` objects.** That shifts dates by the timezone. Compare dates as strings or do the date logic in SQL.

### Matching rules (M4): a group matches a seeker only if ALL 6 hold
| Rule | Check |
|---|---|
| Same destination | `search.city === group.city` (exact city, not country) |
| Dates overlap | shared nights ≥ 2. `shared = max(0, min(check_out) − max(check_in))` in days |
| Budget | `abs(a − b) ≤ 0.4 × min(a, b)`; exactly 40% still matches (₹60,000 vs ₹84,000 → match) |
| Shared interests | at least 2 shared between the **search's** interests and the **owner's** profile interests |
| Gender preference | both ways: if the seeker is `SAME_GENDER`, the owner's gender must equal the seeker's; if the owner is `SAME_GENDER`, the seeker's gender must equal the owner's |
| Group size | `member_ids.length + 1 ≤ max_size` |

A match that breaks any rule counts as wrong at judging. Correct results matter more than the number of features. Judges will send new requests that are not in the data, so never hard-code results.

### Hotel cost (M6)
- Rooms needed = `ceil(members / max_adults)`
- A room type can be booked only if `rooms_left ≥ rooms needed` on **every** night of the stay
- Total = `price_per_night_amount × rooms × nights`. Per member = `total ÷ members`
- Worked example: G-01, `RM-KYO-001-A`, 2 members, 5 nights → ₹4,760 × 1 × 5 = ₹23,800 → ₹11,900 each

### IDs for new rows
Seeded data uses `T-###` / `G-##`. New rows get IDs from DB sequences: travellers `T-025`… (`next_traveller_id()`), groups `G-1001`… (`next_group_id()`), searches `S-1001`… (`search_id_seq`). They never collide with seeded IDs.

### Identity header
Protected endpoints read `X-Traveller-Id` in `backend/src/middleware/currentTraveller.js` only. The frontend sets it in `frontend/src/lib/api.ts` only.

### Ranking
See README "Group Match: how matching and ranking work" and `backend/src/services/matching.service.ts`.

### Money
All amounts are whole INR integers. There is no currency conversion.

---

## 9. Roadmap / what's left

| ID | Feature | Backend work still needed |
|---|---|---|
| M1 | Sign up | `POST /api/travellers`, `GET /api/travellers/:id`; simple session (for example, the traveller ID kept on the client) |
| M2 | Create group post | `POST /api/groups` with validation (city in `destinations`, dates in window, `max_size` 1–4) |
| M3 | Traveller search | persist searches → new `searches` table |
| M4 | See matches | matching endpoint that uses the 6 rules above and returns the reason for each match |
| M5 | Interest / approve / reject | new `join_requests` table (group, seeker, status `PENDING/APPROVED/REJECTED`); on approve, append to `groups.member_ids` |
| M6 | Common Group Page | hotel search for a group's city/dates with availability + cost split; new `saved_hotel_options` and `group_bookings` tables |
| G1 | Filter results | interests / gender composition filters |
| G2 | Member profiles | profile + groups-a-traveller-is-in endpoint |
| S1 | Chat | `group_messages` table |

Lookup endpoints the forms will need: `GET /api/interests`, `GET /api/destinations`, `GET /api/departure-cities`.

Each new table goes in a **new migration** (section 6).

---

## 10. Frontend (current state)

- Vite + React 19 + TypeScript, Zustand for state, shadcn-style UI (`components.json`, `src/components/ui/button.tsx`), lucide icons, `@` alias → `src/`.
- Home (`/`), discovery (`/group-match`), and details (`/group-match/groups/:group_id`) are implemented. The counter store remains an unused scaffold artifact.
- This frontend-only discovery phase explicitly uses separate sample-data snapshots and a temporary pure matching utility inside `src/services/mock/`. This is an exception for the browser demo; final production matching and persistence must move to the backend. No API calls are made by these pages.
- Zustand stores only the active sample traveller ID. Pending Interested requests persist separately in browser localStorage; no approval or booking workflow exists in this phase.
- See `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, and `frontend/README.md` for frontend architecture and checks.
- **Tailwind is pinned to 3.4.17. Do not upgrade to v4.**
- Dev server: `http://localhost:5173`. This origin is already allowed by backend CORS.
- Put the API base URL in a Vite env var (for example `VITE_API_URL=http://localhost:4000`). Do not hard-code it in components.

---

## 11. Collaboration checklist

- [ ] Pull, then run `npm install` and `npm run migrate` in `backend/`
- [ ] Tests first: write low/mid tests for the feature, see them fail, then code. `npm test` is green before every push (section 4.2).
- [ ] Backend code follows router → controller → service → helper (section 4.1). SQL only in `helpers/postgres/`; only helpers import `helpers/postgres/client.js`. Never create another Knex/pg client.
- [ ] Schema changes go in a new migration; never edit a pushed one; update section 5
- [ ] New env var → update `.env.example` and section 3
- [ ] New endpoint → add it to section 4 (or a routes table)
- [ ] Never commit `.env`, `node_modules/`, or changes to the data pack
- [ ] Small, frequent commits; push at least every hour
- [ ] No AI/LLM calls inside the app
