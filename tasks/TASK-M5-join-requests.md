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
- Membership is final once joined. There is no leave or remove step.

## Acceptance criteria
- [ ] Demo Scenario B: Priya clicks Interested on G-01 → Sarah (as `T-001`) sees a badge with "1" → approves → Priya appears in the G-01 members (2/3), and G-01 shows 2/3 in matching.
- [ ] Reject saves the status. The seeker sees "Declined" and cannot request again.
- [ ] Every state survives a refresh and a backend restart.
- [ ] A full group cannot receive new requests, and an approval that would go over `max_size` is refused.
- [ ] Someone who is not the owner cannot approve or reject (403).
- [ ] After approval, the seeker can open the Common Group Page (M6).

## Data
- New table **`join_requests`**: request ID, group_id (FK → groups), seeker_id (FK → travellers), status (`PENDING`/`APPROVED`/`REJECTED`), created_at, decided_at. Unique (group_id, seeker_id).
- Updates `groups.member_ids` on approval
- Migration: new file. Track B owns it.

## Out of scope
- Waitlists, cancelling a request, leaving a group

## Execution plan
_To be added later._
