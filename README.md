# Group Travel Matcher

Local development uses Node.js 24 (see `.nvmrc`) and Docker with Compose.
Read [Agent.md](Agent.md) for project rules, the database schema, and the roadmap.
The frontend now has a Booking.com-inspired homepage and Group Match discovery
with browser-local sample data. It runs independently of the API. Real signup (`/signup`), Traveller ID login (`/login`) and a protected profile dashboard (`/dashboard`) now use PostgreSQL through the backend. Remembered identity lasts seven days without renewing on refresh.
See [project context](docs/PROJECT_CONTEXT.md) and [frontend instructions](frontend/README.md).

For frontend discovery only: `nvm use && npm run dev --prefix frontend`.

## First-time setup

From the repository root:

```bash
nvm install
nvm use
cp --update=none backend/.env.example backend/.env
npm ci --prefix backend
npm ci --prefix frontend
npm run setup --prefix backend
```

If connections to `registry.npmjs.org` are reset on this system, add
`--registry=https://registry.npmmirror.com` to each `npm ci` command. The lockfiles
still control package versions and integrity checks.

The database persists in the Docker volume. Local backend configuration is in
`backend/.env` (ignored by Git). `COMPOSE_PROJECT_NAME=booking` isolates the
database volume from other projects with a folder named `backend`.
If port 5432 is occupied, change `DB_PORT` in
that file before running setup. Frontend configuration can go in
`frontend/.env.local`; use `VITE_API_URL=http://localhost:4000` when adding API calls.

## Start development

Run these in two terminals from the repository root, after `nvm use` in each:

```bash
npm run setup --prefix backend && npm run dev --prefix backend
```

```bash
npm run dev --prefix frontend -- --host 127.0.0.1 --port 5173 --strictPort
```

- Frontend: http://localhost:5173
- API health: http://localhost:4000/api/health (expected: `{"status":"ok","db":"up"}`)

Stop either dev server with Ctrl+C. Stop PostgreSQL with
`npm run db:down --prefix backend`; this keeps its data.

## Checks

```bash
npm run build --prefix frontend
npm run lint --prefix frontend
npm run migrate:status --prefix backend
```

## Group Match: how matching and ranking work

All matching runs in the backend (`backend/src/services/matching.service.ts`). A group is shown only if **all 6 rules** pass:
same city · ≥ 2 shared nights (the check-out day is not a night) · budgets within 40% of the lower one (exactly 40% passes) ·
≥ 2 interests shared with the **owner** · gender preference allowed both ways · `members + 1 ≤ max_size`.
Groups you own or are already in are never shown.

**Score (0–100)** = shared interests `min(n, 4) / 4 × 50` + budget closeness `(1 − diff / (0.4 × lower budget)) × 30`
+ date overlap `shared nights / your nights × 20`, rounded.
Ties: more shared interests → smaller budget difference → earlier check-in → group ID.

## Common Group Page (M6)

Members of a group (owner included) see **Stays in <city> for your group** under *Who's going* on `/groups/:groupId`.
All pricing runs in the backend (`backend/src/services/hotelPricing.service.ts`):
rooms needed = `ceil(members / max_adults)`, available only if `rooms_left ≥ rooms needed` on **every** night
(check-in up to the day before check-out), total = `price × rooms × nights`, per member = `total ÷ members` (nearest rupee).
Example: G-01 with Sarah and Priya, Gion Corner Twin `RM-KYO-001-A` → 1 room × 5 nights × ₹4,760 = **₹23,800**, **₹11,900** each.

- Search bar (name/area), sort, star/free-cancellation filters and a per-night price filter (histogram, slider, quick ranges, min/max).
  Filtering/sorting only changes what is shown; the numbers come from the API.
- Heart = save to the group shortlist (who saved it, "x/y prefer this", cost vs budget). **Finalise** opens a confirmation
  popup and creates one booking (`BK-…`); after that the group is locked.
- **See inside** (`/groups/:groupId/hotels/:hotelId`): photos, details, every room priced for the group, an OpenStreetMap map,
  and Reddit-style guest reviews (votes, nested replies, new reviews).
- Hotel photo credits: `/credits` (read from the data pack's `images/ATTRIBUTIONS.md` through the backend).

### Known limitations

- Booking does not reduce `availability`; the catalog stays read-only. No payment, cancellation or changes after booking.
- Guest reviews are **mock** data generated in the browser (no API). Votes, replies and new reviews are stored only in that
  browser's localStorage, per traveller ID.
- Shortlist and booking are in PostgreSQL; the frontend also caches the last response and filters in localStorage
  (`group_hotels_v1`) so pages paint instantly, then revalidates.
- The map is an OpenStreetMap embed and needs internet access.
