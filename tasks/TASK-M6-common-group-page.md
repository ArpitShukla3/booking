# TASK-M6: Common Group Page (hotel search, cost split, and booking)

| Field | Value |
|---|---|
| Deliverable | M6 (Must have) |
| Track | **B: Group / Owner** |
| Priority | P0 |
| Depends on | M2 (groups), M5 (members join through approval). Seeded groups can be used to build it before M5 is done. |
| Blocks | Nothing. This is the end of both flows. |

## Goal
Members of a group search hotels for the group's city and dates. They see the total and per-person cost, save and compare options, and finally confirm **one** booking for the whole group.

## Requirements

### Access
- Only group members, owner included, can open the Common Group Page. Everyone else gets a "members only" message, and the backend returns 403.
- The page shows the group summary (city, dates, nights, members list, budget).

### Hotel search (uses the group's context)
- The search uses the **group's city and dates** automatically. Optional controls: sort (price per member, rating, stars) and filters (stars, refundable).
- Nights = `check_in` up to the day before `check_out`.
- For each hotel and room type:
  - Rooms needed = `ceil(members / max_adults)`
  - An option is **available** only if `rooms_left ≥ rooms needed` on **every** night of the stay. Hide unavailable options, or show them as "Not available".
  - **Total** = `price_per_night_amount × rooms × nights`
  - **Per member** = `total ÷ members count`
- Each result shows: hotel name, area, stars, rating, room type/name, rooms needed, refundable, price per night, **total and per-member cost**, and the hotel photo.
- Photo URL = API base URL + `/` + `hotels.image`. If photos are shown, also show the photo credits (from `images/ATTRIBUTIONS.md`), for example on a Credits page.
- All calculation runs in the backend.

### Save and compare
- Any member can **save** an option to the group's shortlist.
- The shortlist shows each saved option, **who saved it**, and how many members prefer it ("group alignment"). Show the per-member cost next to each member's budget.
- Members can remove their own saved option.

### Finalize booking
- Any member can click **"Book"** on a saved option. A **confirmation popup** shows the hotel, room, rooms, nights, total, and per-member cost.
- On confirm: create **one** booking for the group with a **generated booking ID**. It stores the hotel option, total, and per-member cost.
- After booking: the group page shows the booking as **locked**. No more booking for that group, and the booking cannot be edited. The group's total trip cost and per-person split are shown.
- Re-check availability when booking is confirmed. No real hotel API and no real payment.

## Acceptance criteria
- [x] G-01 with 2 members (Sarah and Priya), Gion Corner Hotel Twin Room `RM-KYO-001-A`: 1 room × 5 nights × ₹4,760 = **₹23,800 total, ₹11,900 per member**.
- [x] An option where any night has fewer free rooms than needed is not offered as available.
- [x] Saved options and the booking survive a refresh and a backend restart.
- [x] Only one booking per group. A second attempt is refused.
- [x] Someone who is not a member cannot see or use the page (403).
- [x] Results are correct for any group (any city, dates, or member count in the data).

## Data
- Reads: `hotels`, `rooms`, `availability`, `groups`, `travellers`
- New tables (Track B migration):
  - **`saved_hotel_options`**: id, group_id, room_id (FK → rooms), saved_by (FK → travellers), rooms_count, nights, total_inr, per_member_inr, created_at. Unique (group_id, room_id, saved_by).
  - **`group_bookings`**: booking_id (generated), group_id (**unique**), room_id, rooms_count, nights, total_inr, per_member_inr, members_count, booked_by, created_at
- Booking does **not** change `availability`, which stays the read-only catalog. Mention this as a known limitation in the README.

## Out of scope
- Chat (S1)
- Payments, cancellations, changing a booking

## Execution plan (done 2026-11-13)
- Migration `20261113000008_create_group_hotels.js`; `groupHotels.{routes,controller,service,helper}` + pure `hotelPricing.service.ts`, tests first (unit + `groupHotels.api.test.js`).
- Frontend: `src/features/hotels/` (section under members, See inside page, Reddit-style mock reviews, credits page), `useGroupHotelStore` / `useHotelReviewStore` (Zustand persist), e2e `tests/groupHotels.spec.ts`.
- Decision: any available room can be finalised directly; saving to the shortlist first is optional.
