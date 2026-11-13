# Group Travel Matcher

Intern Hackathon · Problem 3. Solo travellers either **post a group trip** and approve who joins, or **search for groups**
that fit their dates, budget and interests. Once a group forms, members pick a hotel together, see the **cost per person**
and book once for everyone.

## Quick start

Needs **Node.js 22+** (`.nvmrc` pins 24) and **Docker** running.

```bash
./start.sh
```

That one command:
1. checks Node and Docker, and creates `backend/.env` from `.env.example` if it is missing,
2. installs npm packages only if they are missing or out of date,
3. starts PostgreSQL (with pgvector) and MinIO in Docker,
4. applies any **pending** migrations (tables + the read-only data pack are loaded on first run),
5. runs the API and the web app together. **Ctrl+C** stops both.

| | URL |
|---|---|
| Web app | http://127.0.0.1:5173 |
| API health | http://localhost:4000/api/health → `{"status":"ok","db":"up"}` |

Sign in with a Traveller ID from the data pack (**T-001** Sarah, **T-002** Priya) or register a new traveller at `/signup`.
Data survives restarts (Docker volumes). Stop the containers with `npm run db:down --prefix backend`.

<details><summary>Manual start (two terminals)</summary>

```bash
cp --update=none backend/.env.example backend/.env
npm ci --prefix backend && npm ci --prefix frontend
npm run setup --prefix backend && npm run dev --prefix backend     # terminal 1: Docker + migrations + API
npm run dev --prefix frontend -- --host 127.0.0.1 --port 5173      # terminal 2: web app
```
If port 5432 is taken, change `DB_PORT` in `backend/.env`.
</details>

## Architecture

```
React 19 + Vite + TypeScript + Tailwind 3.4 (frontend/)
   │  Axios · identity header X-Traveller-Id · Zustand caches · React Router
   ▼
Express 5 API (backend/)   route → controller → service → helper
   │                       all business rules live in services (matching, ranking, approvals, pricing)
   ├── PostgreSQL 16 + pgvector  (Knex migrations; data pack loaded read-only)
   └── MinIO (S3)               group trip photos
```

- The frontend never reads the data files; everything comes from the API.
- SQL only lives in `backend/src/helpers/postgres/`. Services are unit-tested with helpers mocked; integration tests hit a
  separate `booking_test` database.
- **No AI/LLM is called by the app.** (Review contexts and embeddings for "Ask the reviews" were computed offline once and
  committed as data; see below.)

More detail: [Agent.md](Agent.md) (rules, schema, endpoints, migrations) · [tasks/](tasks/) (one ticket per feature) ·
[docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) (history and decisions).

## What is finished

| ID | Feature | Status |
|---|---|---|
| M1 | Sign up / sign in with a Traveller ID (no passwords, remembered 7 days) | ✅ |
| M2 | Create a group post (city, dates in 1–20 Apr 2027, size 1–4, itinerary, budget) + My groups | ✅ |
| M3 | Traveller search (home city, destination, dates, interests, budget, gender preference), saved | ✅ |
| M4 | Matches: all 6 rules, ranked with a score and plain-language reasons | ✅ |
| M5 | "Interested" → owner notified → approve / reject (+ notes, cancel, leave, remove member) | ✅ |
| M6 | Common group page: hotels for the group's city and dates, total + per-member cost, shortlist, one locked booking | ✅ |
| G1 | Filter results by shared interests / gender composition | ❌ not done |
| G2 | Member profile pages (interests, home city, age, ratings and reviews) | 🟡 partly (no "groups they are in" list) |
| S1 | Team chat for booked groups (messages, announcements, polls) | ✅ |
| X1–X4 | Extras: traveller reviews, live trip status on My groups, **Ask the reviews** search, group photo gallery | ✅ |

### Matching (backend `matching.service.ts`)
A group is shown only if **all 6 rules** hold: same city · ≥ 2 shared nights · budgets differ by ≤ 40 % of the lower one
(exactly 40 % passes) · ≥ 2 interests shared with the owner · gender preference allowed both ways · `members + 1 ≤ size`.
Groups you own or are in are never shown.

**Score (0–100)** = shared interests `min(n,4)/4 × 50` + budget closeness `(1 − diff / (0.4 × lower)) × 30`
+ date overlap `shared nights / your nights × 20`.
Ties → more shared interests → smaller budget gap → earlier check-in → group ID.

### Cost split (backend `hotelPricing.service.ts`)
Rooms = `ceil(members / max adults)`, bookable only if every night has enough rooms left; total = `price × rooms × nights`;
per member = `total ÷ members`. Example: Sarah + Priya, Gion Corner Twin, 5 nights → ₹4,760 × 1 × 5 = **₹23,800**, **₹11,900** each.

### Ask the reviews (X3)
On a hotel page or a traveller profile, ask a question ("Is it quiet at night?") and get the most relevant review passages.
Ranking = BM25 keyword search + pgvector similarity, merged with Reciprocal Rank Fusion. Each passage was given a short
context by a local model **offline** (`npm run reviews:index --prefix backend`, Ollama); the running app only reads stored
vectors.

## Tests

```bash
cd backend  && npm run typecheck && npm test            # unit + integration (needs Docker up)
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
cd frontend && npm run test:e2e                         # Playwright, needs ./start.sh running
```

## Known limitations

- Identity is a Traveller ID only (as the brief allows): no passwords or OAuth.
- Booking does not reduce hotel availability (the catalog is read-only) and there is no payment or cancellation after booking.
- Hotel and traveller **reviews are sample data** (stored in Postgres); votes and replies are saved in the browser only.
- The offline review index currently covers part of the reviews; the rest use keyword search with a template context.
- G1 filters are not built; G2 profiles do not list a member's groups.
- The hotel map uses OpenStreetMap and needs internet access.
- `start.sh` targets Linux/macOS (bash). On Windows use WSL or the manual steps.
- Some older `discovery.spec.ts` Playwright tests predate the sign-in guard on `/group-match` and fail.
