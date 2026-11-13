// TASK-X3: shared by the seed migration, `npm run reviews:corpus` and the offline indexer.
// Vectors are stored in index.json as base64 float32 (compact, exact enough for cosine).
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data/reviews');
const CORPUS_FILE = path.join(DATA_DIR, 'corpus.json');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');
const DIMS = 768;

const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);
const loadCorpus = () => readJson(CORPUS_FILE, null);
const loadIndex = () => readJson(INDEX_FILE, { version: 1, chunks: {}, questions: {} });

function encodeVector(values) {
  return Buffer.from(new Float32Array(values).buffer).toString('base64');
}
function decodeVector(base64) {
  const buf = Buffer.from(base64, 'base64');
  return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
}
/** pgvector text literal: '[0.1,0.2,…]'. */
const toPgVector = (values) => `[${values.map((v) => Number(v.toFixed(7))).join(',')}]`;

/** Writes the corpus (+ any indexed contexts/embeddings) into the three review tables. Idempotent. */
async function seedReviews(knex, corpus, index) {
  await knex('review_chunks').del();
  await knex('reviews').del();
  await knex('review_questions').del();
  for (let i = 0; i < corpus.reviews.length; i += 200) {
    await knex('reviews').insert(corpus.reviews.slice(i, i + 200).map((r) => ({ ...r, meta: JSON.stringify(r.meta) })));
  }
  const rows = corpus.chunks.map((c) => {
    const review = corpus.reviews.find((r) => r.review_id === c.review_id);
    const hit = index.chunks?.[c.chunk_id];
    return {
      chunk_id: c.chunk_id, review_id: c.review_id, subject_type: review.subject_type, subject_id: review.subject_id,
      position: c.position, content: c.content,
      context: hit?.context ?? c.context, context_model: hit?.context ? index.context_model : null,
      embedding: hit?.embedding ? toPgVector(decodeVector(hit.embedding)) : null,
      embed_model: hit?.embedding ? index.embed_model : null,
      indexed_at: hit ? index.generated_at ?? null : null,
    };
  });
  for (let i = 0; i < rows.length; i += 200) await knex('review_chunks').insert(rows.slice(i, i + 200));
  await knex('review_questions').insert(corpus.questions.map((q) => {
    const hit = index.questions?.[q.question_id];
    return { ...q, embedding: hit?.embedding ? toPgVector(decodeVector(hit.embedding)) : null };
  }));
}

module.exports = { DATA_DIR, CORPUS_FILE, INDEX_FILE, DIMS, loadCorpus, loadIndex, encodeVector, decodeVector, toPgVector, seedReviews };
