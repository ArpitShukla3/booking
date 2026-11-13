// TASK-X3: pgvector similarity over review_chunks.embedding (cosine; `<=>` is cosine distance).
// Query vectors never leave Postgres: they are a stored question embedding or the mean of stored
// chunk embeddings. No model is called.
const db = require('../postgres/client');

function nearest(queryVectorSql, bindings, subjectType, subjectId, limit, trx) {
  return trx.raw(`WITH q AS (${queryVectorSql})
    SELECT c.chunk_id AS id, 1 - (c.embedding <=> q.embedding) AS similarity
    FROM review_chunks c, q
    WHERE q.embedding IS NOT NULL AND c.embedding IS NOT NULL AND c.subject_type = ? AND c.subject_id = ?
    ORDER BY c.embedding <=> q.embedding, c.chunk_id
    LIMIT ?`, [...bindings, subjectType, subjectId, limit])
    .then(({ rows }) => rows.map((r) => ({ id: r.id, similarity: Number(r.similarity) })));
}

/** Chunks of one subject closest to a suggested question's precomputed embedding. */
function nearestToQuestion(questionId, subjectType, subjectId, limit, trx = db) {
  return nearest('SELECT embedding FROM review_questions WHERE question_id = ?', [questionId], subjectType, subjectId, limit, trx);
}

/** Chunks of one subject closest to the mean embedding of `chunkIds` (pseudo-relevance feedback). */
function nearestToCentroid(chunkIds, subjectType, subjectId, limit, trx = db) {
  return nearest('SELECT avg(embedding) AS embedding FROM review_chunks WHERE chunk_id = ANY(?)', [chunkIds], subjectType, subjectId, limit, trx);
}

module.exports = { nearestToQuestion, nearestToCentroid };
