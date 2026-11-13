# TASK-X1: Traveller profile with reviews, rating and votes (demo)

| Field | Value |
|---|---|
| Deliverable | Extra (user-requested, not in M1–M6). Related to roadmap G2 "Member profiles". |
| Track | **B: Group / Owner** (entry point is the owner's join-request list) |
| Priority | P2 |
| Depends on | M1 (`GET /api/travellers/:id`), M5 (join-request cards and owner notifications) |
| Blocks | Nothing. A real reviews backend can replace the mock later. |
| Status | **Implemented (frontend, demo data), 2026-11-13.** Tick the criteria below once `npm test` and `tests/profile.spec.ts` pass. |

## Goal
When an owner reviews a join request, they can click **View profile** to see the seeker's details, the
reviews and star rating other travellers gave them, and Reddit-style up/down votes. Reviews, ratings and votes
use **mock data for display only**. They are not a full feature.

## Requirements

### Entry points
- **View profile** link on every join-request card (owner's group page, pending and past decisions).
- The seeker's name in the **My groups** notification panel links to the same profile.
- The profile shows **Back to &lt;group name&gt;** (or "My groups") using router state, returning to `#join-requests`.

### Profile page `/travellers/:travellerId` (public route, like the group page)
- Real profile from the backend: name, ID, age, gender, home city, home airport, gender preference, interests.
- Interests the viewer shares with the traveller are highlighted ("N in common with you").
- **Profile votes**: ▲ score ▼ like Reddit.
- **Rating card**: average (one decimal) with stars, review count, 5★→1★ breakdown bars, trips completed.
- **Reviews list**: author, home city, which trip (city + month), star rating, text, and per-review ▲ score ▼.
  Sort by **Top** (score), **Newest**, **Highest rated**.
- A visible note says ratings, reviews and votes are **sample data** and votes are saved only in this browser.
- Loading skeleton, "Traveller not found" for 404, retryable error state, no horizontal scroll at 360 px.

### Voting rules (Reddit-style)
- Anyone can vote, signed in or not (guests share one "guest" slot in this browser).
- Click ▲ → +1 and highlighted. Click ▲ again → vote removed. Click ▼ while ▲ is active → moves the vote (score −2).
- Counts never go below 0. Scores ≥ 1000 show as `1.2k`.
- A viewer's votes are remembered per viewer in `localStorage` key `gtm.demo.reputation-votes.v1`;
  storage failures are ignored (votes then just don't persist).

### Mock data rules
- Generated deterministically from the traveller ID (seeded PRNG), so the same traveller always shows the same
  3–7 reviews. Ratings skew positive; the summary (average, count, distribution) is computed from the reviews.
- Lives only in `src/services/mock/reputationMock.ts`. Components call `src/services/reputationService.ts`
  (`getReputation`, `vote`), so a real API later only replaces that adapter.

## Acceptance criteria
- [ ] Owner clicks **View profile** on Priya's request → `/travellers/T-002` shows her real profile, rating summary and reviews.
- [ ] Back link returns to the group's join requests.
- [ ] Upvote / toggle off / switch to downvote update the score correctly on the profile and on each review.
- [ ] The viewer's votes survive a page reload in the same browser; another viewer does not see them.
- [ ] Reviews can be sorted; an unknown ID shows "Traveller not found".
- [ ] The page clearly labels the data as sample data.
- [ ] Fits a 360 px phone screen.

## Files
| Layer | File |
|---|---|
| Types | `frontend/src/types/reputation.ts` |
| Mock adapter (pure rules + sample data + browser votes) | `frontend/src/services/mock/reputationMock.ts` |
| Service seam | `frontend/src/services/reputationService.ts` |
| Page + styles | `frontend/src/features/profile/TravellerProfilePage.tsx`, `profile.css` |
| Entry links | `frontend/src/features/groups/requestParts.tsx` (`SeekerCard`, `IncomingRequestsPanel`), `groups.css` (`.gp-view-profile`) |
| Route / title / header | `frontend/src/App.tsx`, `frontend/src/components/layout/BookingHeader.tsx` (demo strip hidden) |

No backend, database or migration changes.

## Tests
- Vitest `frontend/src/services/mock/reputationMock.test.ts`: `applyVote` (up, down, toggle, switch, floor at 0),
  `compactScore`, deterministic sample data and consistent summary, `sortReviews` (and no mutation),
  per-viewer stored votes, un-vote clears storage, corrupt storage fallback.
- Playwright `frontend/tests/profile.spec.ts` (backend running): View profile from a join request + Back link;
  vote up / toggle / switch / reload; sort + not-found; 360 px overflow.
- Status: written; run by the developer (`npm test`, `npm run test:e2e -- tests/profile.spec.ts`).
  Typecheck and Oxlint pass.

## Out of scope
- Writing reviews, leaving ratings after a trip, moderation/reporting.
- Server-side votes, vote counts shared between users, anti-abuse (one vote per account).
- Any backend endpoint or table for reputation.

## Later: making it real
1. Tables `traveller_reviews` (review_id, traveller_id, author_id, group_id, rating 1–5, text, created_at; unique
   author+traveller+group, only after a completed trip together) and `votes` (voter_id, target_type, target_id,
   direction; unique voter+target).
2. Endpoints `GET /api/travellers/:id/reputation`, `PUT/DELETE /api/votes/:targetType/:targetId` (🔒).
3. Replace `reputationService` with Axios calls; keep `applyVote` for optimistic UI with rollback on error.
