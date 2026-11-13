# Group Travel Matcher

Local development uses Node.js 24 (see `.nvmrc`) and Docker with Compose.
Read [Agent.md](Agent.md) for project rules, the database schema, and the roadmap.
The frontend now has a Booking.com-inspired homepage and Group Match discovery
with browser-local sample data. It runs independently of the API. The backend
provides its existing health check and hotel images.
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
