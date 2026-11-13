# Group Travel Matcher contributor guide

Read [Agent.md](Agent.md) for the original project rules and backend architecture,
then [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) for the current frontend.
Preserve existing contributors' work and inspect Git status before editing.

## Current feature scopes

The discovery prototype implements only Home, Group Match search/results, group
details and a minimal mock Interested state. Other navigation categories are
visual items with explanatory dialogs. Hotel search is a disabled visual preview.
The subsequent M1 task adds real PostgreSQL signup, ID sign-in, seven-day identity and a protected dashboard. Do not add booking, approvals, chat, passwords, JWT, OTP or OAuth under these scopes.

- Keep React/Vite/TypeScript, Tailwind **3.4.17**, existing shadcn-style controls,
  Zustand, Router, React Hook Form and Zod.
- Backend changes require an explicitly authorized backend task (M1 is authorized); the official data pack stays unchanged. Use `.agents/skills/backend-feature/` for backend work and `.agents/skills/frontend-features/` for frontend work.
- The user explicitly authorized temporary frontend fixtures and matching for this
  phase. Never import the official data directory at runtime. Keep eligibility and
  ranking in the mock service, outside components/hooks/stores.
- Components call `src/services/groupMatchService.ts`; replace this adapter when
  the backend matching API is ready. No AI/LLM calls.
- Real identity uses `useTravellerStore`, Axios and PostgreSQL. Store only `{traveller_id, expires_at}` under `group_match_active_traveller` for seven days after signup/explicit login; restoration never extends it.
- `useDemoTravellerStore` and `gtm.discovery.requests.v1` are separate, explicitly labelled discovery-demo state. Never use a sample profile as a real signed-in account.
- M5 join requests (approve/reject) are implemented for real. X1 traveller reviews, ratings and votes are user-authorized **display-only mock data** (`src/services/mock/reputationMock.ts`, key `gtm.demo.reputation-votes.v1`); keep them labelled as sample data and behind `reputationService` until a backend exists. See `tasks/TASK-X1-traveller-profile-reviews.md`.
- S1 team chat is real (PostgreSQL, `/groups/:groupId/chat`, opens after M6 booking). Keep the simple owner/member access model and polling (no websockets) unless a task asks otherwise. See `tasks/TASK-S1-group-chat.md`.
- Use theme tokens, accessible labels, keyboard controls, visible focus and local
  travel photos with meaningful alt text. Keep errors and empty states recoverable.
- Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` in `frontend/`;
  run `npm run test:e2e` for UI changes. This repository uses Oxlint, not ESLint.
- Update project context with decisions, routes, dependencies and actual test results.
- Do not commit or push unless explicitly requested for the current work.

## History

- 2026-11-13, branch `main`, starting commit `735d7dd`: added this guide for the
  frontend discovery implementation. The original `Agent.md` and backend history
  are preserved. Current frontend changes are uncommitted.

- 2026-11-13, branch `main`, implementation commit `2b658a4`: M1 signup/login and seven-day identity added; documentation completed afterwards. Prior discovery history is retained.
