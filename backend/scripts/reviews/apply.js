// TASK-X3: `npm run reviews:apply` — reloads corpus.json + index.json into the review tables of the
// current database (dev by default; NODE_ENV=test for the test DB). No model calls.
const knex = require('knex')(require('../../knexfile'));
const { loadCorpus, loadIndex, seedReviews } = require('./lib');

knex.transaction((trx) => seedReviews(trx, loadCorpus(), loadIndex()))
  .then(() => console.log('review tables reloaded from data/reviews/'))
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => knex.destroy());
