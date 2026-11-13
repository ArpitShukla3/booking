# TASK-G2: Member profile pages

| Field | Value |
|---|---|
| Deliverable | G2 (Good to have) |
| Track | B (implemented by Adil, 2026-11-13) |
| Depends on | M1 (profiles), M2 (groups), X1/X3 (profile page with ratings and reviews) |
| Status | **Implemented 2026-11-13.** Tick the criteria once the tests below pass. |

## Goal
A traveller's profile shows who they are **and the group trips they're part of**, and every member on a group page links
to their profile.

## What was already there (X1 + X3)
`/travellers/:travellerId`: name, age, gender, home city and airport, gender preference, interests (shared ones
highlighted), rating summary, reviews (from the X3 reviews API) and demo up/down votes.

## Added in G2
- **Group trips** section on the profile: two lists, **Organising (n)** and **Joined (n)**. Each trip shows city photo,
  name, city/country, dates, seat bar + members/size and trip stage, and links to `/groups/:groupId`. Empty and error
  states with retry.
- **Member names link to profiles** in "Who's going" on the group page (`/travellers/:id`).
- API: `GET /api/travellers/:travellerId/groups` (public, like `GET /api/groups/:id`): groups the traveller owns or is a
  member of, each a `Group` + `role` (`OWNER`/`MEMBER`). Join requests and booking details are **not** included.
  Unknown traveller → 404.

## Implementation
- `groups.service.listTravellerGroups()` (reuses `groups.helper.listForTraveller` + hotel status for the stage),
  `groups.controller.listTravellerGroups`, one route line in `travellers.routes.js`; type `TravellerGroup`.
- Frontend: `features/profile/TravellerTrips.tsx` (+ `profile.css`), `groupService.listTravellerGroups`,
  `TravellerProfilePage.tsx`, `GroupPage.tsx` (member links), `groups.css`.

## Acceptance criteria
- [ ] The profile lists the groups the traveller organises and has joined, with working links.
- [ ] Member names on a group page open their profile.
- [ ] The endpoint is public, has no private fields, and returns 404 for an unknown traveller.

## Tests
Backend unit (`groups.service.test.js`, listTravellerGroups), integration `tests/integration/travellerGroups.api.test.js`;
Playwright `tests/filtersAndProfiles.spec.ts` (G2 journey).
