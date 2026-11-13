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
| `npm run db:up` / `db:down` | Start / stop the Postgres container (`postgres:16-alpine`) |
| `npm run migrate` | Run pending migrations (creates tables, then loads the data pack) |
| `npm run migrate:rollback` | Undo all migrations |
| `npm run db:reset` | Delete the DB volume, recreate it, and migrate again |

## Migrations

- `20261113000001_create_tables.js` creates the schema.
- `20261113000002_seed_data_pack.js` loads the JSON files from `DATA_DIR` (default `../hackathon-problem-3-group-travel-matcher`).

Table names match the data files: `interests`, `travellers`, `groups`, `destinations`, `hotels`, `rooms`, `availability`.
`destinations.json` is one nested object, so it is split into `destinations` (one row per city), `departure_cities`, `destination_links`, and `destination_rules`.
`rooms.price_per_night` is split into `price_per_night_amount` and `price_per_night_currency`.

## Hotel images

`hotels.image` is stored as it appears in the data (e.g. `images/hotels/HOTEL-TWIN-1.jpg`). The server serves the data pack's `images/` folder at `/images`, so `http://localhost:4000/<hotel.image>` is the photo URL. Photo credits are in `images/ATTRIBUTIONS.md` of the data pack.

## Endpoints

- `GET /api/health` checks that the API and the database are up.
