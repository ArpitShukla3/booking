# Group Match frontend implementation plan

**Goal:** Implement the supplied frontend-only specification directly in the existing repository; no commits or pushes.
**Spec:** The complete user brief in this session; Agent.md remains the backend reference.
**Architecture:** React Router pages use TanStack Query against a promise-based service interface. A versioned browser-local mock adapter owns temporary matching, membership, sample hotel calculations and reservations. Zustand holds only active identity. Axios is prepared for future integration and performs no live requests in mock mode.
**Stack:** Existing React 19, Vite, TypeScript, Tailwind 3.4, shadcn-style controls, Zustand; add Router, Axios, RHF, Zod, Query, Radix controls and Sonner.

## Constraints and design
- Keep backend and official data pack unchanged; frontend fixtures are documented development-time snapshots, never runtime filesystem reads.
- Preserve existing button and project configuration. No reference screenshot was found.
- Palette: Booking #003B95, navy #061B42, action #006CE4, yellow #FFB700, white #FFFFFF, neutral #F5F5F5.
- Typography: compact Arial/Helvetica sans-serif, 14–16px body, 24px section titles, 44px desktop hero. Left alignment, 1140px container.
- Layout: full-width blue header / scrollable outlined navigation / navy hero / overlapping yellow search / practical content grids. Group pages retain the global header and content width.
- Chosen approach: extend the existing app with feature pages and one mock boundary. Backend integration and separate dashboard styling would conflict with the brief.

## Tasks
- [ ] 1. Contracts, versioned mock storage, adapter tests: six matching rules and boundaries; actor permissions, capacity, request transitions, room-night sample inventory, cost calculations, refresh persistence, idempotent booking.
- [ ] 2. Shared theme, accessible controls, header, navigation, static homepage, demo category pages and downloaded travel image fallbacks.
- [ ] 3. Validated signup/profile, identity switching, creation, search/filter/sort, details, request approval/rejection and My Groups.
- [ ] 4. Member-only shared page, sample hotel search, saved comparison and votes, booking confirmation and receipt.
- [ ] 5. Production build, lint, service tests, desktop/mobile browser flows, guideline review, project context and frontend documentation.

## Review focus
- Arbitrary searches must respect all six rules; no fixed or random compatibility scores.
- Traveller switching must invalidate cached data and preserve independent identity/storage keys.
- Owners alone manage requests; only members use shared pages; capacity enforced by mock adapter.
- Hotel inventory covers every requested night; sample pricing and demo booking labels stay visible.
- Invalid dates, full groups, unknown routes/records, rejected requests and storage failure need useful states.

## Execution record
- Initial branch main, clean tree, baseline 735d7dd. Work is requested directly in this checkout.
- No existing signup or API calls. Backend already has independent health tests and architecture; it is outside scope.
- No commits/pushes authorized for this task. Native inline implementation and browser verification.
