// TASK-X3: SQL for reviews and their retrieval chunks (tables reviews, review_chunks, review_questions).
// Vector similarity lives in helpers/vector, BM25 in helpers/bm25. No business rules here.
const db = require('./client');

const REVIEW_COLUMNS = ['review_id', 'subject_type', 'subject_id', 'author', 'author_from', 'rating', 'rating_scale', 'title', 'body', 'base_score', 'created_at', 'meta'];

function listReviews(subjectType, subjectId, trx = db) {
  return trx('reviews').select(REVIEW_COLUMNS).where({ subject_type: subjectType, subject_id: subjectId }).orderBy('review_id');
}

/** { [subject_id]: count } for many subjects in one query. */
async function countBySubjects(subjectType, subjectIds, trx = db) {
  if (!subjectIds.length) return {};
  const rows = await trx('reviews').where('subject_type', subjectType).whereIn('subject_id', subjectIds)
    .groupBy('subject_id').select('subject_id').count({ count: '*' });
  return Object.fromEntries(rows.map((r) => [r.subject_id, Number(r.count)]));
}

/** Every chunk of a subject type, for the BM25 index (stable order). */
function listChunksForIndex(subjectType, trx = db) {
  return trx('review_chunks').where('subject_type', subjectType).orderBy('chunk_id')
    .select('chunk_id', 'subject_id', 'content', 'context');
}

/** Changes whenever chunks are re-seeded or re-indexed, so caches know to rebuild. */
async function indexVersion(subjectType, trx = db) {
  const row = await trx('review_chunks').where('subject_type', subjectType)
    .first(trx.raw('count(*)::int as n'), trx.raw("coalesce(max(indexed_at), '') as at"), trx.raw('count(context_model)::int as ctx'),
      trx.raw("coalesce(sum(length(context)), 0)::bigint as len"));
  return `${row.n}:${row.at}:${row.ctx}:${row.len}`;
}

/** Chunks with the review they belong to, in the order of `chunkIds`. */
async function findChunks(chunkIds, trx = db) {
  if (!chunkIds.length) return [];
  const rows = await trx({ c: 'review_chunks' }).join({ r: 'reviews' }, 'r.review_id', 'c.review_id')
    .whereIn('c.chunk_id', chunkIds)
    .select('c.chunk_id', 'c.review_id', 'c.content', 'c.context', 'c.context_model', trx.raw('(c.embedding IS NOT NULL) as has_embedding'),
      'r.author', 'r.author_from', 'r.rating', 'r.rating_scale', 'r.title', 'r.created_at', 'r.meta');
  const byId = new Map(rows.map((r) => [r.chunk_id, r]));
  return chunkIds.map((id) => byId.get(id)).filter(Boolean);
}

function listQuestions(subjectType, trx = db) {
  return trx('review_questions').where('subject_type', subjectType).orderBy('position')
    .select('question_id', 'text', trx.raw('(embedding IS NOT NULL) as has_embedding'));
}

async function indexStatus(subjectType, subjectId, trx = db) {
  const row = await trx('review_chunks').where({ subject_type: subjectType, subject_id: subjectId })
    .first(trx.raw('count(*)::int as chunks'), trx.raw('count(context_model)::int as contextualized'), trx.raw('count(embedding)::int as embedded'),
      trx.raw('max(context_model) as context_model'), trx.raw('max(embed_model) as embed_model'));
  return row;
}

module.exports = { listReviews, countBySubjects, listChunksForIndex, indexVersion, findChunks, listQuestions, indexStatus };
