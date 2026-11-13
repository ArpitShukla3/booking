# TASK-M2: Create a group post (group owner)

| Field | Value |
|---|---|
| Deliverable | M2 (Must have) |
| Track | **B: Group / Owner** |
| Priority | P0 |
| Depends on | Shared foundation (`PLAN.md` §1). Current traveller from M1. Until M1 is done, develop as a seeded traveller (e.g. `T-001`). Lookup endpoints from M1; until they exist, use a temporary list of the 5 cities in your branch and remove it before merge. |
| Blocks | M5 (requests need a group), M6 (group page) |

## Goal
A signed-in traveller creates a group trip post. The post becomes visible to seekers (M4) at once, and the owner can manage it.

## Requirements

### Create form fields
| Field | Rule |
|---|---|
| Group name | Required, non-empty |
| Destination | Required. One of the 5 cities (from `destinations`). Show it as "Kyoto, Japan". |
| Check-in / check-out | Required. `check_in` ≥ 2027-04-01, `check_out` ≤ 2027-04-20, `check_out` > `check_in` |
| Number of people wanted | Total including the owner, **1–4**. Store it as `max_size`. Show "you + N more". |
| Approx budget (INR per person) | Required, positive whole number |
| Proposed itinerary | Free text |

### Behaviour
- The owner is the current traveller. The backend sets `owner_id` and **puts the owner in `member_ids`**.
- New group IDs follow the scheme in `PLAN.md` §1 (sequence-based `T-1001`… / `G-1001`…). They must never collide with `G-01` … `G-12`.
- The backend validates every field. A city or date outside the data gives a clear message.
- **My Groups** page: lists the groups the current traveller owns or is a member of, with members count, dates, and city. Show a **pending-requests badge** on owned groups (the count comes from M5; show 0 until M5 is done).
- **Group Details page** (`/groups/:groupId`): name, city/country, dates and nights, budget, itinerary, owner, member list (name, age, home city, interests), and free spots. The seeker's match card (M4) links here, and M5 adds actions to it.
- A new group is saved and appears in seekers' matches with no extra work. M4 reads `groups`.

## Acceptance criteria
- [ ] Sarah's post can be created: Kyoto, 2027-04-10 → 2027-04-15, 3 people, ₹60,000, itinerary text.
- [ ] After creation, `member_ids = [owner]` and the group appears in My Groups.
- [ ] The group still exists after a refresh and a backend restart.
- [ ] Invalid input is rejected with readable messages: size 0 or 5, dates outside the window, check-out before check-in, an unknown city.
- [ ] A seeker whose search fits the new group sees it in M4 results with no code change.
- [ ] The Group Details page works for seeded groups (e.g. `G-01`) and new groups.

## Data
- Table: `groups` (exists)
- Migration: none. The ID sequence is created in Phase 0 (`PLAN.md` §1).

## Out of scope
- Editing or deleting a group after creation (nice to have)
- Join requests (M5)

## Execution plan
_To be added later._
