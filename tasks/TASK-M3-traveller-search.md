# TASK-M3: Traveller search (seeker search form)

| Field | Value |
|---|---|
| Deliverable | M3 (Must have) |
| Track | **A: Traveller / Seeker** |
| Priority | P0 |
| Depends on | M1 (current traveller, lookup endpoints) |
| Blocks | M4 (matches are computed for a saved search) |

## Goal
A seeker enters what trip they want. The search is saved, so the matches (M4) can be computed and shown again after a refresh.

## Requirements

### Search form fields
| Field | Rule |
|---|---|
| Home city | Choose from `departure_cities`. Pre-fill from the profile. |
| Destination | Required. One of the 5 cities: Tokyo, Kyoto, Osaka, Dubai, Abu Dhabi (from `destinations`). Show it as "Kyoto, Japan". |
| Check-in / check-out | Required. `check_in` ≥ 2027-04-01, `check_out` ≤ 2027-04-20, `check_out` > `check_in` |
| Interests | Multi-select from `interests`. Pre-fill from the profile; the seeker can change them for this search. |
| Budget (INR per person) | Required, positive whole number |
| Gender preference | `ANY` / `SAME_GENDER`. Pre-fill from the profile. |
| Gender | Taken from the profile. Not editable in the search. |

### Behaviour
- The backend validates every field. A city or date outside the data gives a **clear message**, for example "Only 1–20 April 2027 is available" or "City not available". It must never return a silent empty result.
- Each submitted search is **saved** (seeker, all fields above, created time).
- After submitting, the seeker goes to the matches view (M4) for that search.
- The seeker can see their recent searches and open one again.
- The date picker should limit choices to 1–20 April 2027. The backend still validates anyway.
- Show the number of nights for the chosen dates (check-out day not counted).

## Acceptance criteria
- [ ] Priya's search (Kyoto, 2027-04-09 → 2027-04-16, ₹62,000, TEMPLES/STREET_FOOD/ADVENTURE, SAME_GENDER) can be entered and saved.
- [ ] A search with dates outside 1–20 April 2027, `check_out ≤ check_in`, or a city not in the data is rejected with a clear message.
- [ ] A saved search still exists after a refresh and a backend restart.
- [ ] The form accepts **any** valid combination. Nothing is hard-coded to the demo scenario.

## Data
- New table **`searches`**: seeker (FK → travellers), home_city, city (FK → destinations), check_in, check_out, budget_inr, interests text[], gender, gender_preference, created_at
- Migration: new file. Track A owns it.

## Out of scope
- Computing the matches (M4)
- Filters on the results (G1)

## Execution plan
_To be added later._
