# Group Travel Matcher contributor guide

Read [Agent.md](Agent.md) for the original project rules and backend architecture,
then [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) for the current frontend.
Preserve existing contributors' work and inspect Git status before editing.

## Current frontend scope

The discovery prototype implements only Home, Group Match search/results, group
details and a minimal mock Interested state. Other navigation categories are
visual items with explanatory dialogs. Hotel search is a disabled visual preview.
Do not add booking, approvals, chat, or new authentication under this scope.

- Keep React/Vite/TypeScript, Tailwind **3.4.17**, existing shadcn-style controls,
  Zustand, Router, React Hook Form and Zod.
- Backend files, migrations and the official data pack stay unchanged for frontend tasks.
- The user explicitly authorized temporary frontend fixtures and matching for this
  phase. Never import the official data directory at runtime. Keep eligibility and
  ranking in the mock service, outside components/hooks/stores.
- Components call `src/services/groupMatchService.ts`; replace this adapter when
  the backend matching API is ready. No AI/LLM calls.
- Active identity and versioned pending requests have separate localStorage keys.
  They are browser-local demo state, not shared or authenticated persistence.
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
