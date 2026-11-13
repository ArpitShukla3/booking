---
name: frontend-features
description: Use when implementing or changing React frontend features in the Group Travel Matcher repository, including forms, routes, traveller identity, API integration, and responsive UI. Not for backend-only work.
---

# Group Travel Matcher frontend features

Read `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `Agent.md` §10 and the relevant
`tasks/TASK-M*.md` first. Inspect Git status and recent commits. Preserve
uncommitted teammate work and existing routes; the current user request wins over
older ticket scope. Do not commit/push or add unrelated features unless requested.

## Boundaries that matter here

- Retain React/Vite/TypeScript, Tailwind 3.4, Zustand, Router, Axios, RHF/Zod and the
  existing shadcn-style controls. Extend the Booking palette in `index.css` and
  Tailwind tokens; do not replace the homepage or introduce another UI framework.
- Put route UI in `src/features/<feature>/`, typed promise-based API access in
  `src/services/`, and DTOs in `src/types/`. Components do not query PostgreSQL or
  import the official data pack. Backend changes require their own authorized scope.
- Signup/catalog/profile APIs are real. Load signup interests from `/api/interests`;
  never generate traveller IDs in the client or substitute a fake successful profile.
- Existing Group Match discovery uses an explicitly labelled, separate sample-data
  adapter and `useDemoTravellerStore`. Do not treat that sample identity as a logged-in
  database account or silently change the discovery feature during an identity task.

## Traveller identity integration

Use `useTravellerStore`, `travellerService`, and `lib/identityStorage.ts` instead of
creating another session implementation. PostgreSQL is the profile source of truth.

- Only successful signup or explicit Traveller ID sign-in starts a new seven-day
  deadline. Store only `{ traveller_id, expires_at }` under
  `group_match_active_traveller`; restoration must not extend the deadline.
- Profile restoration validates storage and calls the backend. Expired/malformed
  identities and backend 404s clear identity. Temporary backend/storage-read failures
  stay retryable; do not erase a valid record or manufacture an active traveller.
- Check `ensureValidSession()` before identity-dependent actions. Keep the shared
  lifecycle timer, focus/visibility checks and cross-tab storage handling. Protect
  personal routes with `RequireTraveller` and discard late async results after logout.
- Report persistence failures. If saving a new identity fails, invalidate any older
  saved identity where possible; do not silently restore another traveller later.
  If storage cannot be cleared, explain that logout only succeeded in the current tab.
- IDs are demo identity, not secure credentials. No passwords, JWT, OTP or OAuth.

## Implement and verify the slice

Write tests for the behavior before implementing it. Keep RHF form state local and
validate on both client and backend. Preserve form input on errors, show field errors,
focus the first invalid field, disable submit only while pending, and show useful
loading/empty/retry states. Use labelled controls, accessible dialogs, visible focus,
semantic links, meaningful image alt text, and layouts without mobile overflow.

Use the existing Vitest tests for pure client/state/service behavior and Playwright
for connected user journeys. When a task requires real persistence, execute its
happy path against the actual API/PostgreSQL; network interception is appropriate
for error cases. Use the isolated backend test database for integration tests,
and never delete seeded profiles or unrelated user records.

Run from `frontend/`:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The linter is Oxlint, not ESLint. Browser tests need the backend running for identity
flows. Read command output before reporting success. Test expiry by injecting time,
not waiting seven days. Include refresh, exact expiry, logout, 404 vs outage, corrupt
storage, request races, desktop/mobile and unchanged prior features as applicable.

Update the relevant task acceptance criteria and append an implementation-history
entry in `docs/PROJECT_CONTEXT.md`: architecture, routes/contracts, changed files,
decisions, actual tests and remaining limitations. Preserve prior history.
