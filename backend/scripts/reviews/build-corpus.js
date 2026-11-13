// TASK-X3: `npm run reviews:corpus` — regenerates data/reviews/corpus.json from the hotels and
// travellers in the dev database (data pack). Deterministic: same input → same file.
const fs = require('fs');
const knex = require('knex')(require('../../knexfile'));
const { buildCorpus } = require('./generate');
const { CORPUS_FILE, DATA_DIR } = require('./lib');

async function main() {
  const hotels = await knex('hotels').select('hotel_id', 'name', 'area', 'city', 'rating', 'check_in_from').orderBy('hotel_id');
  const travellers = await knex('travellers').select('traveller_id', 'name', 'home_city').orderBy('traveller_id');
  const corpus = buildCorpus({ hotels, travellers });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CORPUS_FILE, `${JSON.stringify(corpus, null, 1)}\n`);
  console.log(`corpus: ${corpus.reviews.length} reviews, ${corpus.chunks.length} chunks, ${corpus.questions.length} questions → ${CORPUS_FILE}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => knex.destroy());
