# Traveller signup and seven-day identity plan

Spec: the current user request. Execute directly in this checkout, preserving all
uncommitted Home/discovery work. Do not commit or push.

1. Write failing backend unit/integration tests for signup, sign-in, profile/catalog
   reads, validation, errors, seeded-record preservation, seed reruns and concurrency.
2. Add only new migrations: database-generated padded `T-025` onward IDs and an
   idempotent missing-seed backfill. Preserve `text[]` interests and existing tables.
3. Implement typed validation/service/controller modules over existing Knex helpers,
   thin routes, Zod, existing error response, and TypeScript checks. Keep CommonJS
   entrypoints and migrations; use tsx for typed modules.
4. Write failing frontend tests for exact seven-day expiry, malformed/expired IDs,
   404 clearing, temporary outage retry, stale responses/logout races and action expiry.
5. Add Axios services, one Zustand identity store and shared restoration/expiry gate.
   Signup and login remember a new deadline; restoration never changes the deadline.
6. Add `/signup`, `/login`, signup success and protected `/dashboard`; integrate real
   account links/header. Preserve sample discovery under a separate demo-only store.
7. Browser tests: actual API/Postgres signup/login/refresh/logout/expiry, seeded and
   new IDs, server errors and mobile. Re-run backend tests, typechecks and builds.
8. Update M1 and PLAN, Agent/AGENTS/context and READMEs. Add a concise repository-local
   `frontend-features` skill and validate it. Keep previous history.

Decisions: no Prisma replacement; no password/JWT/OTP. IDs are demo identity only.
Retain existing router/controller/service/helper boundaries. Names may repeat.
Home city is required free text and home airport a three-letter uppercase code;
interests allow zero or more per the existing ticket, with a matching hint.
Age is required as requested (integer 1–120); existing nullable seeded rows remain valid.
No lookup/group/approval/hotel feature expansion.
