# TASK-S1: Team chat for a booked group

| Field | Value |
|---|---|
| Deliverable | S1 (Stretch: chat), user-requested |
| Track | **B: Group / Owner** |
| Priority | P2 |
| Depends on | M5 (members), M6 (booking: the chat opens once the group has booked its hotel) |
| Blocks | Nothing |
| Status | **Done 2026-11-13.** Backend 179 unit + 68 integration, Vitest 103, Playwright `chat.spec.ts` (4) all passing. |

## Goal
After the owner and members have decided and **booked their hotel**, the group page shows **Chat with team**.
Every group has one chat (its own **chat ID**). Members post messages, the organiser posts announcements, anyone allowed
can create polls, and everyone votes. The organiser controls who can post in **Group settings**. Each message shows its
**message ID, content and timestamp**.

## Requirements

### Opening the chat
- Group page sidebar: **Chat with team** button for members. Before booking it is disabled with the reason
  "The team chat opens once the group books its hotel"; after booking it links to `/groups/:groupId/chat`.
- Backend gate (authoritative): group exists (404) → caller is a member (403, so removed members lose access) → the group
  has a booking (409). The chat row is created on first open (`C-1001`, `C-1002`, …; one per group).

### Access system (kept simple)
| Action | Owner | Member |
|---|---|---|
| Send messages | always | if `messaging = ALL_MEMBERS` (default) |
| Create polls | always | if `polls = ALL_MEMBERS` (default) |
| Post announcements | always | never |
| Vote in polls | always | always |
| Change group settings | always | never |

**Group settings** (owner only, dialog on the chat page): "Who can send messages" and "Who can create polls", each
*All members* or *Only the organiser*. Members' composers update within one refresh cycle; a member with nothing allowed
sees "Only the organiser can post in this chat right now. You can still vote in polls."

### Messages
- Types: `TEXT`, `ANNOUNCEMENT` (highlighted card, organiser only), `POLL` (content = question).
- IDs `M-1001`, `M-1002`, … from a sequence; every message shows **message ID**, **content**, **time** (today: `14:05`,
  yesterday, or date), sender name and an *Organiser* tag. Day separators (Today / Yesterday / date).
- Content 1–2,000 characters, trimmed. Enter sends, Shift+Enter adds a new line.
- New messages, updated poll counts and setting changes appear by **polling every 4 s** (the latest page of
  `GET …/messages` plus `GET …/chat`), paused while the tab is hidden and while the user's own vote is saving.
  `?after=<message_id>` is available for incremental fetches. No websockets.

### Polls
- Question (≤ 300 chars) + 2–6 distinct options (≤ 100 chars each). Created in one transaction with its options.
- One vote per person per poll; voting again **moves** the vote. Shows votes, %, total and "your vote".
- Optimistic vote in the UI, rolled back if the request fails.

## API (all 🔒 `X-Traveller-Id`, mounted at `/api/groups/:groupId/chat`)
| Method | Path | Result |
|---|---|---|
| GET | `/` | `{chat_id, group_id, group_name, settings, my_permissions, members}` |
| PATCH | `/settings` | owner only; `{messaging?, polls?}` each `ALL_MEMBERS`/`OWNER_ONLY` → updated chat |
| GET | `/messages?after=M-…` | messages oldest first (latest 200 without `after`) |
| POST | `/messages` | `{type: 'TEXT'|'ANNOUNCEMENT', content}` → 201 message |
| POST | `/polls` | `{question, options[]}` → 201 poll message |
| POST | `/polls/:messageId/vote` | `{option_id}` → updated poll message |

Errors: 400 (validation, not a poll, option not in poll), 401, 403 (non-member, no permission, non-owner settings),
404 (group/message), 409 (no booking yet).

## Data (migration `20261113000010_create_group_chat.js`)
- `group_chats`: `chat_id` PK (`C-` + `group_chat_id_seq` from 1001), `group_id` unique FK → groups (cascade),
  `messaging`, `polls` (CHECK `ALL_MEMBERS`/`OWNER_ONLY`), timestamps.
- `chat_messages`: `seq` bigserial (from 1001, ordering/cursor), `message_id` generated `'M-' || seq` (unique),
  `chat_id` FK (cascade), `sender_id` FK, `type` CHECK, `content` CHECK 1–2000, `created_at`.
- `chat_poll_options`: `option_id` serial, `message_id` FK (cascade), `label`, `position` (unique per poll).
- `chat_poll_votes`: PK (`message_id`, `voter_id`), `option_id` FK, `voted_at`.

## Files
| Layer | File |
|---|---|
| Migration | `backend/migrations/20261113000010_create_group_chat.js` |
| Helper (SQL) | `backend/src/helpers/postgres/groupChat.helper.js` |
| Validation | `backend/src/validation/groupChat.validation.ts` |
| Service (rules) | `backend/src/services/groupChat.service.ts` (`permissionsFor`, `seqOf`, use cases) |
| Controller / route | `backend/src/controllers/groupChat.controller.ts`, `backend/src/routes/groupChat.routes.js` (+1 line in `routes/index.js`) |
| Types | `backend/src/types/groupChat.ts`, `frontend/src/types/chat.ts` |
| Frontend service | `frontend/src/services/chatService.ts` |
| Page + logic + styles | `frontend/src/features/chat/GroupChatPage.tsx`, `chatLogic.ts`, `chat.css` |
| Entry point | `frontend/src/features/groups/GroupPage.tsx` (Chat with team), `groups.css`, route in `App.tsx` |

## Acceptance criteria
- [x] Before booking, the button is disabled and the API answers 409; after booking, both members open the same chat ID.
- [x] Messages show message ID, content and time, survive a refresh/restart, and arrive at the other member within ~4 s.
- [x] Only the organiser can post announcements (403 for members; the tab is disabled with a reason).
- [x] Polls: create with 2–6 distinct options, vote, change vote (total unchanged), results visible to everyone.
- [x] Group settings: organiser-only messaging/polls block members (403, composer locked) but members can still vote.
- [x] Non-members and removed members get 403 / "Members only"; unknown group 404.
- [x] Chat page fits a 360 px phone screen.

## Tests
- Backend unit: `tests/unit/services/groupChat.service.test.js` (permissions, cursor parsing, DTO, access gate,
  message/poll/vote/settings rules), `tests/unit/controllers/groupChat.controller.test.js`.
- Backend integration: `tests/integration/groupChat.api.test.js` (booking gate, chat per group, messages + `after`,
  announcements, polls/votes, settings, 403/404/401).
- Frontend: `src/features/chat/chatLogic.test.ts` (composer modes, merge/order, poll maths, validation, time labels),
  Playwright `tests/chat.spec.ts` (locked before booking, full two-user conversation, settings, members-only, 360 px).

### Fixed while testing
- Message IDs could restart at `M-1` after `TRUNCATE … RESTART IDENTITY`: the migration now sets the sequence **START** to 1001.
- Other members didn't see new vote counts on an existing poll: the page now refreshes the latest page every 4 s
  (pausing while the user's own vote is saving).

## Out of scope
- Real-time push (websockets), typing indicators, read receipts, unread counts
- Editing/deleting messages, attachments, reactions, mentions, threads
- Multi-choice or anonymous polls, closing polls, per-member roles beyond owner/member
