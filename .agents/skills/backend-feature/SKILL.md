---
name: backend-feature
description: Use for ANY change in /backend of the Group Travel Matcher — a new endpoint or feature (a TASK-M* ticket), a bug fix, a new table, or changing business rules. Enforces the test-first workflow (write low/mid tests first, see them fail, then code) and the router → controller → service → helper layering with Postgres helpers.
---

# Backend feature workflow (test-first, layered)

You are working in `backend/` (Node.js CommonJS, Express 5, PostgreSQL through Knex).
Follow this workflow exactly. **Tests are written BEFORE the implementation.**

## 0. Read first
1. `Agent.md`: §4.1 (layer rules), §5 (schema), §6 (migrations), §8 (domain rules: dates, matching, cost).
2. The ticket in `tasks/TASK-M*.md` and the API contract + file ownership in `tasks/PLAN.md` (§2–§4). Stay inside your track's files.
3. The reference implementation: `src/{routes,controllers,services}/health.*.js` + `src/helpers/postgres/health.helper.js` and their tests.

If the request is unclear (endpoint shape, a rule), check the ticket and `PLAN.md` before you guess. If they don't answer it, ask.

## 1. Plan the slice
Write down (in your reply, briefly):
- Endpoints: method, path, auth (`X-Traveller-Id`?), request body, success response, error codes (400/401/403/404/409).
- The functions in each layer: `<f>.helper.js` queries → `<f>.service.js` rules → `<f>.controller.js` handlers → `<f>.routes.js`.
- New tables/columns → a new migration (never edit a pushed one).
- A test list taken from the ticket's **acceptance criteria and edge cases** (each criterion → at least one test).

## 2. Write the tests FIRST (levels: low + mid only)

| Level | Folder | What it tests | DB? |
|---|---|---|---|
| **Low (unit)** | `tests/unit/services/`, `tests/unit/utils/`, `tests/unit/controllers/` | Service rules with helpers **mocked**; pure utils (dates, matching rules, pricing maths) with no mocks; controller status/shape with the service mocked | No |
| **Mid (integration)** | `tests/integration/<feature>.api.test.js` | Real HTTP through all 4 layers against the **test DB** (`booking_test`, seeded with the data pack) | Yes |

No end-to-end/browser tests and no load tests (out of scope).

**What goes where:**
- Every business rule and boundary → **low** (fast, many cases). Example: shared nights 1 vs 2, budget diff exactly 40% vs just above, a full group.
- Every endpoint → **mid**: the happy path, validation 400 with `fields`, 401 without the traveller header, 403/404/409 where the ticket says, and **persistence** (write, then read back).
- Use the worked examples from `DATA_DICTIONARY.md` / the tickets as expected values (G-01 + Priya match; ₹23,800 / ₹11,900).

**Run them and confirm they FAIL** (`npm run test:unit`, `npm run test:integration`), for the right reason: missing module/route, not a typo. Only then start coding.

### Test templates
Low: service with the helper mocked (`node:test` + `node:assert/strict`):
```js
const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const groupsHelper = require('../../../src/helpers/postgres/groups.helper');
const groupsService = require('../../../src/services/groups.service');
const HttpError = require('../../../src/utils/HttpError');

describe('groups.service.createGroup', () => {
  afterEach(() => mock.restoreAll());

  it('rejects max_size 5 with a field error', async () => {
    const insert = mock.method(groupsHelper, 'insert', async () => {});
    await assert.rejects(
      groupsService.createGroup('T-001', { ...valid, max_size: 5 }),
      (err) => err instanceof HttpError && err.status === 400 && 'max_size' in err.fields,
    );
    assert.equal(insert.mock.callCount(), 0);
  });
});
```
Mid: HTTP against the test DB:
```js
const { describe, it, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, asTraveller } = require('../helpers/http');
const { db, truncate, closeDb } = require('../helpers/db');

describe('POST /api/groups', () => {
  beforeEach(async () => { await db('groups').where('group_id', '>=', 'G-1000').del(); });
  after(closeDb);

  it('creates a group with the owner as first member', async () => {
    const res = await asTraveller('T-001').post('/api/groups').send(validBody);
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.member_ids, ['T-001']);
  });

  it('401 without X-Traveller-Id', async () => {
    const res = await api().post('/api/groups').send(validBody);
    assert.equal(res.status, 401);
  });
});
```
Test helpers: `tests/helpers/http.js` (`api()`, `asTraveller(id)`), `tests/helpers/db.js` (`db`, `truncate(...appTables)`, `closeDb`), `tests/helpers/mockRes.js` (fake `res` for controller tests).

Integration hygiene:
- Always `after(closeDb)`.
- Clean only **app-created** data: `truncate('join_requests')`, or delete rows with IDs ≥ `T-1001`/`G-1001`. **Never** truncate data-pack tables (travellers, groups, hotels, rooms, availability, …).
- Files run one at a time (`--test-concurrency=1`). Don't depend on test order across files.

## 3. Implement bottom-up: helper → service → controller → route

**Helper** `src/helpers/postgres/<f>.helper.js`: the ONLY place with SQL/Knex.
```js
const db = require('./client');
async function findById(groupId, trx = db) {
  return trx('groups').where({ group_id: groupId }).first();
}
async function insert(row, trx = db) {
  const [created] = await trx('groups').insert(row).returning('*');
  return created;
}
module.exports = { findById, insert };
```
- Optional `trx = db` as the **last** parameter on every function.
- Return plain rows / `undefined`. No HTTP errors, no business decisions.
- Only touch tables your track owns. For the other track's tables, call their helper's read functions.

**Service** `src/services/<f>.service.js`: all business logic.
```js
const groupsHelper = require('../helpers/postgres/groups.helper');   // import the MODULE…
const { withTransaction } = require('../helpers/postgres/transaction.helper');
const HttpError = require('../utils/HttpError');

async function getGroup(groupId) {
  const group = await groupsHelper.findById(groupId);                 // …and call module.fn()
  if (!group) throw HttpError.notFound('Group not found');
  return group;
}
module.exports = { getGroup };
```
- **Import helpers as module objects and call `helper.fn()`. Never destructure them** (`const { findById } = require(...)`). Destructuring breaks `mock.method` in the unit tests.
- Validate input here (use `src/utils/` validators). Throw `HttpError.badRequest(msg, { field: reason })`.
- Multi-write operations → `withTransaction(async (trx) => { ... })`, passing `trx` to each helper.
- Put pure maths (matching rules, pricing, date nights) in exported functions with no I/O, or in `src/utils/`, so low tests can call them directly.
- No `req`/`res`, no Knex.

**Controller** `src/controllers/<f>.controller.js`: thin.
```js
const groupsService = require('../services/groups.service');
async function createGroup(req, res) {
  const group = await groupsService.createGroup(req.traveller.traveller_id, req.body);
  res.status(201).json(group);
}
module.exports = { createGroup };
```
- Read `req.params/query/body/traveller` → call ONE service → `res.status(...).json(...)`.
- No try/catch: Express 5 sends rejected promises to `errorHandler`.

**Route** `src/routes/<f>.routes.js` + one line in `src/routes/index.js`:
```js
const { Router } = require('express');
const groupsController = require('../controllers/groups.controller');
const router = Router();
router.post('/', /* requireTraveller, */ groupsController.createGroup);
router.get('/:groupId', groupsController.getGroup);
module.exports = router;
```
```js
// routes/index.js: add exactly one line
router.use('/groups', require('./groups.routes'));
```

## 4. Make it green
- `npm run test:unit`, then `npm run test:integration`, then `npm test`: **all** must pass, including tests that existed before.
- Don't weaken or delete a test to make it pass. If a test was wrong, say why in your reply.
- If you add a migration: `npm run migrate` (dev DB) and `npm run migrate:rollback && npm run migrate` to check `down`. The test DB migrates automatically before integration tests.

## 5. Finish
- Update `Agent.md`: §4 (endpoints implemented), §5 (new tables), and §6 (new migrations).
- Tick the satisfied acceptance criteria in the ticket file.
- If the API contract changed, update `tasks/PLAN.md` §3 (agree with the other dev first).
- Report: what was added, test counts (unit/integration), anything not done.

## Hard rules (never break)
- SQL only in `src/helpers/postgres/`. Only helpers import `helpers/postgres/client.js`.
- Business rules only in services, never in controllers, helpers, or the frontend.
- Dates are `YYYY-MM-DD` strings. Never convert DATE columns to JS `Date`.
- Never modify `hackathon-problem-3-group-travel-matcher/`. Never edit a pushed migration.
- No AI/LLM calls inside the app.
- CommonJS (`require` / `module.exports`), Express 5, `node:test`. Don't add another test framework.
