# TASK-X2: Live trip status on My groups

| Field | Value |
|---|---|
| Deliverable | Extra (user-requested, not in M1–M6). Follow-up to M2 (My groups) and M6 (hotels + booking). |
| Track | **B: Group / Owner** |
| Priority | P1 |
| Depends on | M2 (`GET /api/groups/mine`), M6 (`saved_hotel_options`, `group_bookings`) |
| Blocks | Nothing |
| Status | **Implemented 2026-11-13.** |

## Problem
`/my-groups` shows each group's status pill and trip progress from the backend `stage`, but the backend only
knows `LOBBY_OPEN` / `LOBBY_FULL` (members vs `max_size`). After M6 a group can have a hotel shortlist or a
locked booking, yet My groups still says "Lobby open". The status is not derived from the real data, and the
page never refreshes while it is open.

## Goal
The status on **My groups** (and the group page pill) always reflects the backend: lobby open → lobby complete
→ hotel shortlisted → booked, and it updates live while the page is open.

## Requirements

### Backend (router → controller → service → helper → Postgres)
- `stage` becomes one of `LOBBY_OPEN`, `LOBBY_FULL`, `HOTEL_SHORTLISTED`, `BOOKED`, derived in the **service**
  by a pure function, most advanced first:
  1. a row in `group_bookings` → `BOOKED`
  2. at least one row in `saved_hotel_options` → `HOTEL_SHORTLISTED`
  3. `members ≥ max_size` → `LOBBY_FULL`
  4. otherwise `LOBBY_OPEN`
- Every Group DTO gets `hotel_status: { shortlisted: number /* distinct rooms */, booked: boolean }`.
  This is safe for the public group page (no prices, no booking ID).
- `GET /api/groups/mine` 🔒 (caller is a member) also returns `booking: null | { booking_id, hotel_id, hotel_name,
  room_name, rooms_count, nights, total_inr, per_member_inr, booked_at }`.
- One new helper read (SQL only in `groupHotels.helper.js`): shortlist count + booking summary for many groups in
  two queries (no N+1).
- No new tables, no migration.

### Frontend
- Status pill: four labels/colours (Lobby open, Lobby complete, Hotel shortlisted, Booked 🔒).
- Trip progress (compact on cards, full on the group page) follows the backend status.
- Status filter on My groups has all four statuses.
- Booked cards show the hotel, booking ID and **your share** (per member) instead of the budget, and link to the hotel.
- Shortlisted cards show "N stays on the shortlist" and link to `#hotels`.
- **Live**: a Zustand store (`useMyGroupsStore`, persisted per traveller) paints the last list instantly,
  revalidates on open, when the tab regains focus/visibility, every 20 s while visible, and right after this
  browser saves/books a hotel. A pill that changes animates. Background refreshes never flash a skeleton.

## Acceptance criteria
- [x] Booking a group's hotel → `GET /api/groups/mine` returns `stage: "BOOKED"` with the booking summary for every member.
- [x] Saving a hotel (no booking) → `HOTEL_SHORTLISTED`, `hotel_status.shortlisted = 1`.
- [x] Groups without hotel activity keep `LOBBY_OPEN` / `LOBBY_FULL` as before.
- [x] `GET /api/groups/:id` (public) shows the same `stage` and `hotel_status`, but no booking ID or prices.
- [x] With My groups open in one tab, booking in another tab updates the card without a reload (focus/poll).
- [x] Unit tests for the stage rule and service; integration test through the real API; Playwright journey.
