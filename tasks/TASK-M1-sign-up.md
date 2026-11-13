# TASK-M1: Sign-up flow and traveller identity

| Field | Value |
|---|---|
| Deliverable | M1 (Must have) |
| Track | **A: Traveller / Seeker** |
| Priority | P0. Every other flow needs a "current traveller". |
| Depends on | Shared foundation (see `PLAN.md` §1) |
| Blocks | M2, M3, M5, M6 need the current traveller ID. Track B uses seeded travellers (e.g. `T-001`) until this ticket is done. |

## Delivery status (2026-11-13)

Signup/login is implemented in `2b658a4`; documentation follows that commit.
The latest user request supersedes the earlier T-1001, optional-age and picker
proposals: use T-025 onward, required age 1–120, home city + three-letter airport,
ID-only login and exactly seven-day remembered identity. General destination and
departure-city lookup APIs remain deferred outside this scoped delivery.

## Goal
A user creates a traveller profile and becomes the "current traveller" of the app. No email or password. A basic identity linked to the session is enough. The profile stays saved after a page refresh and a backend restart.

## Requirements

### Profile fields (sign-up form)
| Field | Rule |
|---|---|
| Name | Required, non-empty, trimmed |
| Gender | Required: `FEMALE` or `MALE` |
| Home city / origin city | Required home city text and three-letter airport code; preserve `home_city` and `home_airport`, normalizing airport to uppercase. |
| Interests | Choose valid IDs from the backend catalog and show labels. Zero/one is allowed per the existing edge-case rule, with a matching hint. |
| Gender preference | Required: `ANY` or `SAME_GENDER`. Show "Same gender only" with a short explanation. |
| Age | Required whole number, 1–120; existing nullable DB values preserved |

### Identity / session
- When sign-up succeeds, the new traveller becomes the current traveller. The client keeps the ID in persistent storage, so it survives a refresh.
- **Returning traveller:** enter any existing database Traveller ID at `/login`, including seeded IDs such as Sarah `T-001`. This endpoint never creates a traveller.
- "Switch user / log out" clears the current traveller.
- The header shows the current traveller's name.
- If the stored ID no longer exists in the DB (for example after a DB reset), clear it and send the user to sign-up. The app must not crash.

### Lookup data for every form (owned by this ticket)
The frontend must get these from the backend. It must not read the data files.
- Interest tags (`interests`)
- Destination cities with country (`destinations`): used by the M2 and M3 forms
- Departure cities (`departure_cities`)

### Backend
- Traveller IDs are allocated by a PostgreSQL sequence/default: T-025 onward, minimum three digits. Seed reruns and concurrent registrations do not collide or rewind allocation.
- Validation runs in the backend: gender/preference enum values, interest IDs that exist, required home city and three-letter airport. An invalid request gets a 400 with a clear message for each field.
- Endpoints: see the API contract in `PLAN.md` §3 (traveller and lookup endpoints).

## Acceptance criteria
- [x] A new user signs up and sees their profile. After refresh they are still signed in with the same data.
- [x] After a backend restart, the profile still exists.
- [x] A user can choose an existing seeded traveller (e.g. Sarah Thomas `T-001`) and act as them.
- [x] Signup interest IDs/labels come from the real `/api/interests` endpoint.
- [x] General destination/departure lookups: `GET /api/destinations` and `GET /api/departure-cities` (added with M2/M3 in `938b633`, covered by `groups.api.test.js` and `searches.api.test.js`).
- [x] Invalid input (empty name, unknown interest, bad gender value) is rejected by the backend with a readable message, and the form shows it.
- [x] The judges' flow works: "add a new traveller" with any valid values from the data.

## Edge cases
- The same name as an existing traveller is allowed. Names are not unique; the ID is the identity.
- Selecting 0 or 1 interest is allowed, but show a hint: matching needs at least 2 interests shared with a group owner.

## Data
- Tables: `travellers` (exists), `interests`, `destinations`, `departure_cities` (all exist, read-only)
- New migrations: `20261113000003_traveller_id_sequence.js` and `20261113000004_backfill_missing_travellers.js`. Existing migrations/field types are preserved.

## Out of scope
- Passwords, email, OAuth
- Editing a profile (nice to have, not required)

## Execution plan
- [x] Inspect context/dictionary/seeds and preserve existing Home/discovery work.
- [x] Write failing low/mid tests, then implement validation/helper/service/controller/routes.
- [x] Add DB sequence/default and idempotent missing-seed backfill; verify concurrent IDs.
- [x] Add `/signup`, `/login`, signup-success ID/copy and protected `/dashboard`.
- [x] Restore via GET profile without extending expiry; handle malformed/expired data,
  missing IDs, temporary outages, storage failures and late responses after logout.
- [x] Check expiry on load, timer, focus/visibility, cross-tab changes and actions.
- [x] Verify real API browser journeys, desktop/mobile, backend restart persistence,
  and rollback/reapply of only the new migrations in `booking_test`.
- [x] Create/validate `.agents/skills/frontend-features/SKILL.md` and update context.

### Delivered API

- POST `/api/travellers` → 201 complete profile with generated ID.
- POST `/api/travellers/sign-in` → 200 existing profile, never creates one.
- GET `/api/travellers/:traveller_id` → 200 saved profile.
- GET `/api/interests` → 200 official catalog from PostgreSQL.
- Validation: 400 with `error.fields`; missing ID: 404 `Traveller ID not found`;
  ID conflict: 409; database failure: 503. No password/email/OTP/JWT.

### Seven-day identity

`group_match_active_traveller` stores `{traveller_id, expires_at}`. Only successful
signup/explicit login starts a seven-day period. Refresh preserves it. Expiry,
malformed identity and backend 404 clear it; outages remain retryable. Logout
clears the client without deleting PostgreSQL accounts. Storage failures are
reported; separate sample discovery state is not treated as a real account.

### Verification

27 backend unit tests, 16 integration tests; 30 frontend unit/service tests and
20 Playwright browser tests. Includes concurrent IDs, seed preservation, IDs after
999, real signup/login, refresh/logout, injected expiry and mobile. Final commands
and known limitations are recorded in `docs/PROJECT_CONTEXT.md`.
