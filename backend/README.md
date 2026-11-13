# Backend: Node.js + Express + PostgreSQL

## Run

```bash
cp .env.example .env   # first time only
npm install
npm run setup          # starts Postgres in Docker and runs the migrations
npm run dev            # API on http://localhost:4000
```

## Scripts

| Script | What it does |
|---|---|
| `npm run db:up` / `db:down` | Start / stop the Postgres container (`pgvector/pgvector:pg16`: Postgres 16 + pgvector) |
| `npm run migrate` | Run pending migrations (creates tables, then loads the data pack) |
| `npm run migrate:rollback` | Undo all migrations |
| `npm run db:reset` | Delete the DB volume, recreate it, and migrate again |
| `npm run reviews:corpus` | X3: regenerate `data/reviews/corpus.json` (sample hotel + traveller reviews, deterministic) |
| `npm run reviews:index` | X3, **offline only**: Ollama contextualizes each review chunk (`OLLAMA_CONTEXT_MODEL`, default `gemma3:4b`) and embeds it (`nomic-embed-text`) → `data/reviews/index.json` + dev DB. Resumable (`--limit N`, `--force`, `--no-db`) |
| `npm run reviews:apply` | X3: reload corpus + index into the review tables (`NODE_ENV=test` for the test DB). No model |

> **Upgrading from `postgres:16-alpine`** (X3): `npm run db:up` recreates the container on the same volume with the
> pgvector image. Run `docker exec booking-postgres psql -U booking -d booking -c "REINDEX DATABASE booking"` once
> (and for `booking_test`), because the Debian image sorts text differently from Alpine. Then `npm run migrate`.

## Migrations

- `20261113000001_create_tables.js` creates the schema.
- `20261113000002_seed_data_pack.js` loads the JSON files from `DATA_DIR` (default `../hackathon-problem-3-group-travel-matcher`).

Table names match the data files: `interests`, `travellers`, `groups`, `destinations`, `hotels`, `rooms`, `availability`.
`destinations.json` is one nested object, so it is split into `destinations` (one row per city), `departure_cities`, `destination_links`, and `destination_rules`.
`rooms.price_per_night` is split into `price_per_night_amount` and `price_per_night_currency`.

## Hotel images

`hotels.image` is stored as it appears in the data (e.g. `images/hotels/HOTEL-TWIN-1.jpg`). The server serves the data pack's `images/` folder at `/images`, so `http://localhost:4000/<hotel.image>` is the photo URL. Photo credits are in `images/ATTRIBUTIONS.md` of the data pack.

## Tests (written before the feature code)

```bash
npm test                  # unit + integration (Postgres must be running)
npm run test:unit         # low level: services/controllers with mocks, no DB
npm run test:integration  # mid level: real HTTP + test DB "booking_test" (auto-created and migrated)
```

Tests live in `tests/unit/` and `tests/integration/`. The workflow and templates are in `../Agent.md` §4.2 and `.agents/skills/backend-feature/SKILL.md`.

## Architecture

Requests flow **router → controller → service → helper**:

```
src/routes/<f>.routes.js           method + path → controller
src/controllers/<f>.controller.js  req → service → res (no SQL, no business rules)
src/services/<f>.service.js        business rules, validation, transactions; throws HttpError
src/helpers/postgres/<f>.helper.js all SQL (Knex); the only layer that touches the DB
```

`/api/health` is the reference example. The full rules are in `../Agent.md` §4.1.

## Endpoints

- `GET /api/health` checks that the API and the database are up.
- X3 "Ask the reviews": `GET /api/reviews/:hotels|travellers/:id`, `…/questions`, `…/search?q=` (BM25 + pgvector + RRF; no model at runtime). See `../tasks/TASK-X3-contextual-review-retrieval.md`.


## Traveller signup / ID login (M1)

The new validation/service/controller modules are TypeScript loaded by `tsx`;
existing CommonJS routes/helpers/Knex migrations stay compatible. No Prisma, passwords,
JWT, OAuth or OTP are introduced. Node 24 is recommended (`nvm use` at repo root).

| Method | Path | Success |
|---|---|---|
| POST | `/api/travellers` | 201 exact profile with DB-generated ID |
| POST | `/api/travellers/sign-in` | 200 existing profile for `{traveller_id}` |
| GET | `/api/travellers/:traveller_id` | 200 persisted profile |
| GET | `/api/interests` | 200 official catalog from PostgreSQL |

Validation returns 400 `error.fields`, missing IDs 404, ID conflict 409 and database
failure 503. IDs are demo identity, not credentials. Seven-day remembrance is a client
policy; expiry/logout does not delete profiles.

Migrations 00003/00004 add a sequence/default and idempotent missing-seed backfill.
`travellers` retains its schema and `text[]` interests. New IDs continue T-025 onward
with at least three digits; gaps are normal, values past 999 are not truncated.
Old migrations are unchanged. Seed backfill rollback intentionally retains data.

```bash
npm run migrate
npm run seed:travellers  # optional idempotent repair; never overwrites profiles
npm run typecheck
npm test
```

Use `booking_test` for rollback/integration verification. Do not reset the development
DB to run tests or expect exactly 24 travellers after users have registered.
