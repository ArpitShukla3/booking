# TASK-M1: Sign-up flow and traveller identity

| Field | Value |
|---|---|
| Deliverable | M1 (Must have) |
| Track | **A: Traveller / Seeker** |
| Priority | P0. Every other flow needs a "current traveller". |
| Depends on | Shared foundation (see `PLAN.md` §1) |
| Blocks | M2, M3, M5, M6 need the current traveller ID. Track B uses seeded travellers (e.g. `T-001`) until this ticket is done. |

## Goal
A user creates a traveller profile and becomes the "current traveller" of the app. No email or password. A basic identity linked to the session is enough. The profile stays saved after a page refresh and a backend restart.

## Requirements

### Profile fields (sign-up form)
| Field | Rule |
|---|---|
| Name | Required, non-empty, trimmed |
| Gender | Required: `FEMALE` or `MALE` |
| Home city / origin city | Required. Choose from `departure_cities` (Bengaluru BLR, Delhi DEL, Mumbai BOM, Chennai MAA). Store `home_city` and `home_airport`. |
| Interests | Choose one or more from `interests` (16 tags), grouped by `category`, shown by `label` |
| Gender preference | Required: `ANY` or `SAME_GENDER`. Show "Same gender only" with a short explanation. |
| Age | Optional, whole number |

### Identity / session
- When sign-up succeeds, the new traveller becomes the current traveller. The client keeps the ID in persistent storage, so it survives a refresh.
- **"Continue as an existing traveller":** pick any traveller from the DB, including the 24 seeded ones. The demo needs this: the owner, e.g. Sarah `T-001`, approves requests while another person acts as the seeker.
- "Switch user / log out" clears the current traveller.
- The header shows the current traveller's name.
- If the stored ID no longer exists in the DB (for example after a DB reset), clear it and send the user to sign-up. The app must not crash.

### Lookup data for every form (owned by this ticket)
The frontend must get these from the backend. It must not read the data files.
- Interest tags (`interests`)
- Destination cities with country (`destinations`): used by the M2 and M3 forms
- Departure cities (`departure_cities`)

### Backend
- New traveller IDs follow the scheme in `PLAN.md` §1 (sequence-based `T-1001`… / `G-1001`…). They must never collide with the seeded `T-001` … `T-024`.
- Validation runs in the backend: gender/preference enum values, interest IDs that exist, a home city from the list. An invalid request gets a 400 with a clear message for each field.
- Endpoints: see the API contract in `PLAN.md` §3 (traveller and lookup endpoints).

## Acceptance criteria
- [ ] A new user signs up and sees their profile. After refresh they are still signed in with the same data.
- [ ] After a backend restart, the profile still exists.
- [ ] A user can choose an existing seeded traveller (e.g. Sarah Thomas `T-001`) and act as them.
- [ ] The interest, destination, and home-city lists come from the API.
- [ ] Invalid input (empty name, unknown interest, bad gender value) is rejected by the backend with a readable message, and the form shows it.
- [ ] The judges' flow works: "add a new traveller" with any valid values from the data.

## Edge cases
- The same name as an existing traveller is allowed. Names are not unique; the ID is the identity.
- Selecting 0 or 1 interest is allowed, but show a hint: matching needs at least 2 interests shared with a group owner.

## Data
- Tables: `travellers` (exists), `interests`, `destinations`, `departure_cities` (all exist, read-only)
- Migration: none. The ID sequence is created in Phase 0 (`PLAN.md` §1).

## Out of scope
- Passwords, email, OAuth
- Editing a profile (nice to have, not required)

## Execution plan
_To be added later._
