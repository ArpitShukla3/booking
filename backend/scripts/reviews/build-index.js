// TASK-X3: `npm run reviews:index` — OFFLINE contextual retrieval indexing with Ollama.
//   1. Contextualize: for each review, a local chat model writes one short context per chunk that
//      situates it in the hotel/traveller and the review (Anthropic's "Contextual Retrieval").
//   2. Embed: nomic-embed-text embeds "context + chunk" (search_document:) and the suggested
//      questions (search_query:).
// Output: data/reviews/index.json (committed) + the dev database. The running app NEVER calls a model.
// Resumable: finished chunks are kept; re-run to continue. Flags: --limit N, --force, --no-db.
//   OLLAMA_URL (http://localhost:11434), OLLAMA_CONTEXT_MODEL (gemma3:4b), OLLAMA_EMBED_MODEL (nomic-embed-text)
const fs = require('fs');
const { loadCorpus, loadIndex, encodeVector, seedReviews, INDEX_FILE, DIMS } = require('./lib');

const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const CONTEXT_MODEL = process.env.OLLAMA_CONTEXT_MODEL || 'gemma3:4b';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const args = process.argv.slice(2);
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const FORCE = args.includes('--force');

async function ollama(endpoint, body) {
  const res = await fetch(`${OLLAMA}/api/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Ollama ${endpoint} ${res.status}: ${await res.text()}`);
  return res.json();
}

function describeReview(review, subject) {
  if (review.subject_type === 'HOTEL') {
    return `Hotel: ${subject.name}, in ${subject.area}, ${subject.city}.\n`
      + `Guest review by ${review.author} from ${review.author_from} (${review.meta.travel_type}), rated ${review.rating}/10.\n`
      + `Title: ${review.title}\n${review.body}`;
  }
  return `Traveller profile: ${subject.name} from ${subject.home_city} (a member of group trips).\n`
    + `Review of ${subject.name} written by travel companion ${review.author} from ${review.author_from} after a group trip to `
    + `${review.meta.trip.city} in ${review.meta.trip.month}, rated ${review.rating}/5.\n${review.body}`;
}

async function contextualize(review, subject, chunks) {
  if (!chunks.length) return [];
  const prompt = `<document>\n${describeReview(review, subject)}\n</document>\n`
    + `Here are the chunks of this document:\n${chunks.map((c, i) => `${i + 1}. "${c.content}"`).join('\n')}\n\n`
    + 'For each chunk, write a short, succinct context (one sentence, at most 35 words) that situates the chunk within the overall '
    + 'document for the purposes of improving search retrieval of the chunk. Mention who or what is reviewed, by whom, and the '
    + 'topics the chunk is about in plain words (for example noise, cleanliness, location, value for money, breakfast, staff, '
    + 'room size, punctuality, planning, cost sharing, reliability). Do not repeat the chunk text.\n'
    + `Answer only with JSON: {"contexts": [${chunks.map(() => '"..."').join(', ')}]} with exactly ${chunks.length} string(s).`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const out = await ollama('chat', {
      model: CONTEXT_MODEL, stream: false, format: 'json', think: false,
      messages: [{ role: 'user', content: prompt }], options: { temperature: 0, seed: attempt, num_ctx: 2048 },
    });
    try {
      const contexts = JSON.parse(out.message.content).contexts;
      if (Array.isArray(contexts) && contexts.length === chunks.length && contexts.every((c) => typeof c === 'string' && c.trim())) {
        return contexts.map((c) => c.trim().replace(/\s+/g, ' '));
      }
    } catch { /* retry */ }
  }
  if (chunks.length === 1) throw new Error(`could not contextualize ${chunks[0].chunk_id}`);
  // Fallback: one call per chunk (small models sometimes return the wrong number of contexts).
  const one = [];
  for (const chunk of chunks) {
    const single = await contextualize(review, subject, [chunk]).catch(() => null);
    if (!single) throw new Error(`could not contextualize ${chunk.chunk_id}`);
    one.push(single[0]);
  }
  return one;
}

async function embed(inputs) {
  const out = await ollama('embed', { model: EMBED_MODEL, input: inputs });
  if (out.embeddings.some((e) => e.length !== DIMS)) throw new Error(`${EMBED_MODEL} returned a non-${DIMS}-d vector`);
  return out.embeddings;
}

function save(index) {
  const tmp = `${INDEX_FILE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ ...index, generated_at: new Date().toISOString() })}\n`);
  fs.renameSync(tmp, INDEX_FILE); // atomic: readers never see half a file
}

async function main() {
  const corpus = loadCorpus();
  if (!corpus) throw new Error('data/reviews/corpus.json is missing: run `npm run reviews:corpus` first');
  const index = FORCE ? { version: 1, chunks: {}, questions: {} } : loadIndex();
  if (index.context_model && index.context_model !== CONTEXT_MODEL) console.warn(`note: index was built with ${index.context_model}, continuing with ${CONTEXT_MODEL}`);
  Object.assign(index, { version: 1, context_model: CONTEXT_MODEL, embed_model: EMBED_MODEL, dims: DIMS });
  const chunksByReview = new Map();
  for (const c of corpus.chunks) chunksByReview.set(c.review_id, [...(chunksByReview.get(c.review_id) ?? []), c]);

  const todo = corpus.reviews.filter((r) => chunksByReview.get(r.review_id).some((c) => !index.chunks[c.chunk_id]?.embedding)).slice(0, LIMIT);
  console.log(`contextualizing ${todo.length} review(s) with ${CONTEXT_MODEL}, embedding with ${EMBED_MODEL}`);
  const started = Date.now();
  const failed = [];
  for (const [i, review] of todo.entries()) {
    const chunks = chunksByReview.get(review.review_id);
    const subject = corpus.subjects[review.subject_type][review.subject_id];
    let contexts;
    try { contexts = await contextualize(review, subject, chunks); } catch (e) {
      failed.push(review.review_id);
      console.warn(`  skipped ${review.review_id}: ${e.message} (re-run to retry; it keeps its template context meanwhile)`);
      continue;
    }
    const vectors = await embed(chunks.map((c, k) => `search_document: ${contexts[k]}\n${c.content}`));
    chunks.forEach((c, k) => { index.chunks[c.chunk_id] = { context: contexts[k], embedding: encodeVector(vectors[k]) }; });
    if ((i + 1) % 10 === 0 || i === todo.length - 1) {
      save(index);
      const eta = Math.round(((Date.now() - started) / (i + 1)) * (todo.length - i - 1) / 1000);
      console.log(`  ${i + 1}/${todo.length} reviews · ETA ${Math.floor(eta / 60)}m${eta % 60}s · e.g. ${chunks[0].chunk_id}: ${contexts[0]}`);
    }
  }

  const questions = corpus.questions.filter((q) => FORCE || !index.questions?.[q.question_id]);
  if (questions.length) {
    const vectors = await embed(questions.map((q) => `search_query: ${q.text}`));
    index.questions = index.questions ?? {};
    questions.forEach((q, k) => { index.questions[q.question_id] = { text: q.text, embedding: encodeVector(vectors[k]) }; });
  }
  save(index);
  const done = corpus.chunks.filter((c) => index.chunks[c.chunk_id]?.embedding).length;
  if (failed.length) console.warn(`${failed.length} review(s) skipped: ${failed.join(', ')}`);
  console.log(`index: ${done}/${corpus.chunks.length} chunks, ${Object.keys(index.questions).length} questions → ${INDEX_FILE}`);

  if (!args.includes('--no-db')) {
    const knex = require('knex')(require('../../knexfile'));
    try {
      await knex.transaction((trx) => seedReviews(trx, corpus, loadIndex()));
      console.log('dev database updated (reviews, review_chunks, review_questions)');
    } catch (e) {
      console.warn(`database not updated (${e.message}). Run \`npm run migrate\`, then \`npm run reviews:apply\`.`);
    } finally { await knex.destroy(); }
  }
}
main().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
