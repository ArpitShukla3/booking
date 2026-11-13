# TASK-M5: Express interest and approve or reject (join requests)

| Field | Value |
|---|---|
| Deliverable | M5 (Must have) |
| Track | **B: Group / Owner** |
| Priority | P0 |
| Depends on | M2 (Group Details page, My Groups). Current traveller (M1, or a seeded traveller until M1 is done). |
| Blocks | M6. A seeker becomes a member only through approval. |

## Goal
A seeker clicks **"Interested"** on a group. The group owner sees the pending requests and approves or rejects them. Every state is saved.

## Requirements

### Seeker side (on the Group Details page)
- An **"Interested"** button sends a join request with status `PENDING`.
- The button is **disabled**, with a reason, when:
  - the group is full (`member_ids.length ≥ max_size`)
  - the seeker is already a member or the owner
  - the seeker already has a `PENDING` request, which shows as "Request pending"
  - the seeker was `REJECTED` (show "Request declined")
- "My Requests" view: the seeker's requests with group name and status (Pending / Approved / Rejected).

### Owner side
- My Groups shows a **notification badge** with the number of pending requests on each owned group.
- On their own group's page, the owner sees the pending requests: seeker name, age, gender, home city, interests (shared interests highlighted), and gender preference.
- **Approve** → status `APPROVED`. The seeker is **added to `groups.member_ids`**, so the group has one less free spot.
- **Reject** → status `REJECTED`.
- Only the owner can approve or reject. The backend checks this.

### Backend rules
- Approval must **re-check the group size** at approval time. If the group became full, approval fails with a clear message.
- Approval updates the request and `member_ids` together **in one transaction**, so the group can never go over its size.
- One active request per (group, seeker). A repeated click must not create duplicates.
- ~~Membership is final once joined.~~ **Changed 2026-11-13 (user request):** the owner can **remove a member** (see below). Members still cannot leave on their own.

### Owner removes a member (added 2026-11-13)
- On their group page the owner sees **Remove** on every member card except their own, with a confirmation dialog.
- `DELETE /api/groups/:groupId/members/:travellerId` (owner only, 403 otherwise; 400 for the owner themselves; 404 if not a member).
- One transaction: take the traveller out of `member_ids` (the spot opens again) and set their join request to **`REMOVED`**
  (a row is created for seeded members that never had a request).
- A removed traveller sees **"Removed from group"** (disabled) on the group page and **Removed** in My requests, and cannot request that group again (409).

## Acceptance criteria
- [x] Demo Scenario B: Priya clicks Interested on G-01 → Sarah (as `T-001`) sees a badge with "1" → approves → Priya appears in the G-01 members (2/3), and G-01 shows 2/3 in matching.
- [x] Reject saves the status. The seeker sees "Declined" and cannot request again.
- [x] Every state survives a refresh and a backend restart.
- [x] A full group cannot receive new requests, and an approval that would go over `max_size` is refused.
- [x] Someone who is not the owner cannot approve or reject (403).
- [x] After approval, the seeker can open the Common Group Page (M6).

## Data
- New table **`join_requests`**: request ID, group_id (FK → groups), seeker_id (FK → travellers), status (`PENDING`/`APPROVED`/`REJECTED`), created_at, decided_at. Unique (group_id, seeker_id).
- Updates `groups.member_ids` on approval
- Migration: new file. Track B owns it.

### Request lifecycle follow-ups (added 2026-11-13, user request)
1. **Note with the request.** "Interested" opens a dialog with an optional note (≤ 500 chars, blank → none). The owner sees it
   on the request card and in My groups notifications; the seeker sees it in My requests.
2. **Seeker cancels** their own PENDING request (`POST /api/join-requests/:id/cancel`, 403 for others, 409 if decided) →
   `CANCELLED`. They can ask again later.
3. **Member leaves** (`POST /api/groups/:groupId/leave`; the owner can't, 400; non-member 404) → `LEFT`, spot reopens,
   they lose hotels/chat access and can ask again later.
4. **Group fills up → other requests close.** When an approval takes the last spot, every other PENDING request of that group
   becomes `CLOSED` in the same transaction; the owner's message says how many were closed. A closed request can be sent
   again if a spot opens.
5. **Removal / leaving after booking.** The dialog warns that the hotel is booked and shows the new per-person share. In the
   same transaction the booking keeps its rooms and total; `members_count` and `per_member_inr = round(total ÷ members)`
   are recalculated. The API returns `booking_update {per_member_before, per_member_after, …}`.

Re-requesting after `CANCELLED` / `LEFT` / `CLOSED` re-opens the **same row** (still one row per group + seeker).
`REJECTED` and `REMOVED` still block for good. Migration `20261113000013_join_request_lifecycle.js` adds the 3 statuses and
`join_requests.message`.

- [ ] Note, cancel + ask again, leave + ask again, auto-close when full, and booking re-split work end to end (tick after
      `joinRequests.api.test.js` and Playwright `memberLifecycle.spec.ts` pass).

## Out of scope
- Waitlists (automatic promotion when a spot opens), re-inviting a removed member, refunds when the cost split changes

## Execution plan / implementation (2026-11-13)
- Backend: migration `20261113000007_create_join_requests.js`; `joinRequests.helper.js` → `joinRequests.service.ts` → `joinRequests.controller.ts` → `joinRequests.routes.js` (+ two routes in `groups.routes.js`). `groups.helper` gained `lockById` (SELECT … FOR UPDATE) and `addMember` (conditional `array_append`). Approval locks the group row, re-checks size and updates request + `member_ids` in one transaction.
- Extra endpoint `GET /api/join-requests/incoming` feeds the owner notifications (header bell count, My groups panel).
- Frontend: `joinRequestService.ts`, `features/groups/joinRequests.ts` (button state rules), `requestParts.tsx` (Interested panel, owner request cards with shared interests highlighted + decline confirmation, notifications panel), `MyRequestsPage.tsx` at `/my-requests`.
- Tests: backend unit `joinRequests.service/controller` + updated `groups.service`, integration `joinRequests.api.test.js` (Scenario B, 409s, 403s, overflow, concurrent approvals); frontend Vitest `joinRequests.test.ts`, Playwright `tests/joinRequests.spec.ts`.

### Removal follow-up (2026-11-13), tests passing
- Migration `20261113000009_join_requests_removed_status.js` (adds `REMOVED` to the status check; `down` maps REMOVED → REJECTED).
- Backend: `groups.helper.removeMember`, `joinRequests.helper.markRemoved`, `groups.service.removeMember`, `groups.controller.removeMember`, route in `groups.routes.js`; `REMOVED` blocker in `joinRequests.service`.
- Frontend: Remove button + confirm on member cards (`GroupPage.tsx`), `groupService.removeMember`, `REMOVED` status label/pill/button state, My requests filter.
- Tests: backend unit `groups.service.test.js` (removeMember), `joinRequests.service.test.js` (REMOVED blocker), `groups.controller.test.js`; integration `joinRequests.api.test.js` (3 cases); frontend `joinRequests.test.ts`; Playwright `tests/joinRequests.spec.ts` (2 cases).
- [x] Owner removes an approved member → spot reopens, request `REMOVED`, member sees "Removed from group" and cannot request again (backend 129/54 and Playwright `joinRequests.spec.ts` passing, 2026-11-13).
