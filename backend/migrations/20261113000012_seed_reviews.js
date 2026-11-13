// TASK-X3: loads the committed review corpus (data/reviews/corpus.json) and, when present, the offline
// Ollama index (data/reviews/index.json: contexts + embeddings). No model is called here.
const { loadCorpus, loadIndex, seedReviews } = require('../scripts/reviews/lib');

exports.up = async function up(knex) {
  const corpus = loadCorpus();
  if (!corpus) throw new Error('backend/data/reviews/corpus.json is missing');
  await seedReviews(knex, corpus, loadIndex());
};

exports.down = async function down(knex) {
  await knex('review_chunks').del();
  await knex('reviews').del();
  await knex('review_questions').del();
};
