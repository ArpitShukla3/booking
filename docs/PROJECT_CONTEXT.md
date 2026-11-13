# Group Travel Matcher project context

## Current summary

The app now has a Booking.com-inspired Home Dashboard and a focused Group Match
discovery frontend. It runs without a backend connection. The original backend
and official data pack remain intact. Read `Agent.md` for their architecture and
schema; this file records the separate frontend demo.

The current user request supersedes an earlier, larger frontend brief. Signup,
group creation, approvals, hotel comparison, bookings and secondary booking-category
pages are deliberately outside this delivery. Unfinished files from that earlier
draft were removed before completion; no pre-existing working features were removed.

## Routes and user journey

| Route | Component | Behavior |
| --- | --- | --- |
| `/` | `pages/HomePage.tsx` | Navy promotional hero, yellow hotel-search preview, four informational cards, travel-companions CTA |
| `/group-match` | `features/group-match/GroupDiscoveryPage.tsx` | Validated search filters, eligible results, sorting, loading/error/empty states |
| `/group-match/groups/:group_id` | `features/group-match/GroupDetailsPage.tsx` | Itinerary, owner/members, dates/capacity/budget, compatibility and Interested state |
| Unknown URL | App fallback | Explains available routes and links to discovery |

Search fields and sorting live in query parameters. Detail links carry the search
criteria. The initial view evaluates an explicit Kyoto sample search, using Priya
Shah (`T-002`) if no active traveller has been selected. “Sign in” and “Switch
traveller” choose an existing official sample profile. Register explains that
registration is not connected; no signup flow existed in the baseline.

## Frontend architecture

- `App.tsx`: shared header/footer, Router, lazy discovery/details pages, loading
  fallback, route title/focus handling.
- `components/layout/BookingHeader.tsx`: category navigation, sample-traveller
  selector, help/info dialogs, confirmed clearing of pending demo requests.
- `components/layout/Footer.tsx`: prototype disclosure and photo credits.
- `pages/HomePage.tsx`: `HeroBanner`, `WhyBookingCards`, `TravelCompanionsSection`.
- `components/shared/SearchBar.tsx`: explicitly visual-only hotel-search preview.
- `components/shared/common.tsx`: container, photo fallback, demo notice, interest
  tags, match explanations, loading/error/empty states and route focus.
- `components/ui/`: existing Button retained; Input/native Select, Radix Checkbox,
  Radix Dialog and RHF Form/Field wrappers follow the existing shadcn pattern.
- `features/group-match/forms.tsx`: RHF/Zod search form and official interest choices.
- `features/group-match/GroupCard.tsx`: reusable results card.
- `features/group-match/GroupDetailsPage.tsx`: details and reusable member card.
- `lib/schemas.ts`: dates restricted to 1–20 April 2027, positive integer INR,
  supported cities/interests and enums, checkout after check-in.
- `lib/searchParams.ts`: URL parsing/serialization and documented sample defaults.
- `lib/useAsync.ts`: small promise-state hook; changed keys discard stale reads;
  explicit retry and actor-dependent keys prevent identity data leaking between views.
- `lib/format.ts`: `Intl` currency/date formatting; dates use UTC for display.
- `store/useTravellerStore.ts`: active traveller ID only. The existing unused
  `useCounterStore.ts` is preserved.
- `index.css` and `tailwind.config.js`: reusable Booking palette, compact Arial
  typography, 1140px desktop container, responsive layout and focus/reduced-motion rules.

## Sample data and contracts

`src/data/{travellers,groups,interests}.json` are unchanged development-time
snapshots of official data records: 24 travellers, 12 groups and 16 interests.
Original field names and enum values are preserved. UI code never loads data from
the official repository folder at runtime. Destination photos are downloaded from
Unsplash into `public/images/`; attribution links are in `CREDITS.md`.

Pages depend on the `GroupMatchService` interface in `types/groupMatch.ts`, exposed
by `services/groupMatchService.ts`. All methods return promises:

- `getTravellers()` / `getTraveller(traveller_id)`
- `searchGroups(search, traveller_id, sort)`
- `getGroupDetails(group_id, search, traveller_id)`
- `expressInterest(group_id, search, traveller_id)`

The implementation is `services/mock/groupMatchMockService.ts`, which accepts an
injected storage interface for tests. No Express endpoint is assumed or called.
This is the replacement boundary for future backend integration.

### Eligibility versus ranking

`services/mock/matching.ts` contains the temporary **pure** `evaluateMatch`:
same city, >=2 shared nights, budget difference <=40% of the lower budget,
>=2 distinct search interests shared with the owner, bidirectional gender
compatibility, and capacity for one more person. Current members are excluded
from discovery. Shared nights exclude checkout day; integer cross-multiplication
keeps the exact 40% budget boundary inclusive.

`rankMatches` is separate. Default demo score = 10 × shared nights + 5 × shared
interests + round(20 × (1 − relative budget difference / 0.4)). Scores are explained
as **points**, never random percentages or match probabilities. Users can also
sort by shared nights or budget. Ties break consistently by group ID.

### Temporary persistence

- `gtm.active-traveller-id`: active sample ID only; default `T-002`.
- `gtm.discovery.requests.v1`: `{ version: 1, requests: [...] }`, validated with Zod.
- Requests are idempotent per group/traveller and remain PENDING. They do not add
  members, notify owners or offer an approval flow.
- Corrupt/unavailable storage produces a useful error. The traveller dialog can
  clear requests after confirmation. Local identity and requests are independent.
- This state is local to one browser/origin, untrusted and unauthenticated. Future
  backend work must replace matching and persistence before claiming shared results.

## Dependencies and file inventory

New runtime packages: `react-router-dom`, `react-hook-form`, `zod`,
`@hookform/resolvers`, `@radix-ui/react-dialog`, `@radix-ui/react-checkbox`.
New development tools: `vitest`, `@playwright/test`, `agent-browser`.
Existing React 19, Vite, TypeScript, Tailwind 3.4, Zustand and Lucide are retained.
No Axios, Query, notification package, backend library or other styling framework
was retained from the broader draft.

Modified existing files: root `README.md`, `Agent.md` (frontend notes only),
`frontend/{package.json,package-lock.json,.gitignore,README.md,tailwind.config.js}`,
`frontend/src/{App.tsx,index.css}`. New modules are listed in the architecture
section, plus `frontend/playwright.config.ts`, `frontend/tests/discovery.spec.ts`,
the mock utility/service tests, `AGENTS.md`, this file and the implementation plan.
`backend/` and the official data pack are unchanged.

## Validation

- Matching/service tests: 15 passed, covering all six rules, exact boundaries,
  duplicate interests, sort immutability, persistence, idempotency and storage errors.
- Playwright: 9 passed, covering Home/navigation, search/empty/reset/sort/detail
  links, validation/focus, pending requests/refresh/identity switching, invalid
  records/URLs, images and overflow at 360, 390, 768 and 1440 pixels.
- Initial browser failures exposed mobile hero minimum-width overflow and an
  ambiguous sort label. Both were fixed and all browser tests rerun successfully.
- Agent-browser: details WCAG A/AA audit: zero violations and zero incomplete checks.
- Final typecheck, production build, lint and further page audits are recorded
  below when completed. ESLint is not configured; use the existing Oxlint script.
- No reference screenshot was found in the session or repository; visual direction
  follows the explicit Booking palette/layout brief and was reviewed in Chrome.

## Remaining work / next recommended task

Implement backend discovery endpoints with the same typed search/detail/request
contract and rule tests, then replace the mock adapter. Plan signup reuse/integration
with the teammate before adding it. Approval, booking and other categories require
separate scoped tasks; they are not hidden unfinished features in this prototype.

## Implementation history

- 2026-11-13 · `main` · baseline `735d7dd`: inspected original scaffold, preserved
  teammate backend/test architecture, implemented Home and discovery directly in
  the existing frontend. Latest scope explicitly narrows the earlier full-journey
  brief. Changes remain uncommitted and unpushed as requested.
