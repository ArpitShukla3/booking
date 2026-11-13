// TASK-X3: in-memory BM25 index over the contextualized review chunks ("context + content"),
// one per subject type so IDF uses the whole hotel (or traveller) corpus. Rebuilt when the
// chunk table changes (re-seed / re-index).
const reviewsHelper = require('../postgres/reviews.helper');
const bm25 = require('../../utils/bm25');
const { tokenize } = require('../../utils/text');

const cache = new Map(); // subjectType → { version, index, bySubject, building }

async function build(subjectType, version) {
  const rows = await reviewsHelper.listChunksForIndex(subjectType);
  const bySubject = new Map();
  for (const row of rows) {
    if (!bySubject.has(row.subject_id)) bySubject.set(row.subject_id, new Set());
    bySubject.get(row.subject_id).add(row.chunk_id);
  }
  const index = bm25.buildIndex(rows.map((row) => ({ id: row.chunk_id, tokens: tokenize(`${row.context} ${row.content}`) })));
  return { version, index, bySubject };
}

async function indexFor(subjectType) {
  const version = await reviewsHelper.indexVersion(subjectType);
  const current = cache.get(subjectType);
  if (current?.version === version) return current.ready;
  const ready = build(subjectType, version);
  cache.set(subjectType, { version, ready });
  ready.catch(() => cache.delete(subjectType));
  return ready;
}

/** BM25-ranked chunks of one subject for already-tokenized query terms: [{ id, score }]. */
async function search(subjectType, subjectId, queryTokens, limit = 20) {
  if (!queryTokens.length) return [];
  const { index, bySubject } = await indexFor(subjectType);
  const allowed = bySubject.get(subjectId);
  if (!allowed) return [];
  return bm25.search(index, queryTokens, allowed).slice(0, limit);
}

/** Tests only. */
function clearCache() { cache.clear(); }

module.exports = { search, clearCache };
