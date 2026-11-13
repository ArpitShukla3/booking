# Group Travel Matcher frontend

React 19 + Vite + TypeScript, Tailwind 3.4, shadcn-style controls, Zustand,
React Router, Axios, React Hook Form and Zod. Read `../AGENTS.md` and
`../docs/PROJECT_CONTEXT.md`; the frontend feature skill is at
`../.agents/skills/frontend-features/SKILL.md`.

## Run

Use Node 24 (`nvm use` from the repository root). First time:

```bash
npm ci
cp --update=none .env.example .env.local
```

Start the backend with PostgreSQL (in a separate terminal):

```bash
cd ../backend
npm ci
npm run setup
npm run dev
```

From `frontend/`:

```bash
npm run dev
```

Open http://localhost:5173. `VITE_API_URL` configures the backend (default
http://localhost:4000). Both localhost and 127.0.0.1 frontend origins are allowed
by the example backend configuration. If npm registry connections reset, append
`--registry=https://registry.npmmirror.com` to `npm ci`.

## Account flow

- `/signup`: real PostgreSQL profile creation; interest labels come from the API.
- Success shows the backend-generated Traveller ID with copy and dashboard actions.
- `/login`: Traveller ID only; no password/email/OTP. Seeded `T-001` works.
- `/dashboard`: protected profile summary, ID copy, Group Match link and logout.
- Opening `/` with a valid restored profile redirects to `/dashboard`; guests retain
  the existing Booking.com-inspired homepage.

Only `{traveller_id, expires_at}` is remembered under
`group_match_active_traveller`. Signup/explicit login starts exactly seven days;
refresh validates and fetches the profile without renewing the deadline. Expiry or
logout clears browser identity, not the PostgreSQL account. Outages can be retried.
This is demo identity, not secure authentication.

Home/discovery are preserved. `/group-match` and its group details still use a
clearly labelled sample-data adapter, with separate sample identity and pending
requests. New signup does not pretend that backend group APIs exist.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Oxlint is configured; ESLint is not. Browser tests need the backend running and
create a real demo traveller. Install Playwright Chromium with
`npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`
to an installed Chrome executable. On this system:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e
```

`IDENTITY_TEST_API_URL` can override the API used by the browser test assertions;
set it consistently with the Vite API URL when using a different backend.
