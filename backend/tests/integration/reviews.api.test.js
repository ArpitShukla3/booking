// TASK-X3: reviews + "Ask the reviews" through all layers against the test DB (no model is called).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, asTraveller } = require('../helpers/http');
const { db, closeDb } = require('../helpers/db');
const { loadCorpus, loadIndex, seedReviews } = require('../../scripts/reviews/lib');
const bm25Helper = require('../../src/helpers/bm25/reviewBm25.helper');

const HOTEL = 'HTL-KYO-001';
const search = (q, extra = '') => api().get(`/api/reviews/hotels/${HOTEL}/search?q=${encodeURIComponent(q)}${extra}`);

describe('reviews API', () => {
  // Same state as a fresh clone: the committed corpus + offline index.
  before(async () => { await db.transaction((trx) => seedReviews(trx, loadCorpus(), loadIndex())); bm25Helper.clearCache(); });
  after(closeDb);

  it('lists a hotel\'s reviews newest first with a rating summary (persisted in Postgres)', async () => {
    const res = await api().get(`/api/reviews/hotels/${HOTEL}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.subject, { type: 'HOTEL', id: HOTEL, name: 'Gion Corner Hotel' });
    const { reviews, summary } = res.body;
    assert.ok(reviews.length >= 4 && reviews.length <= 6);
    assert.equal(summary.count, reviews.length);
    assert.equal(summary.scale, 10);
    assert.ok(reviews.every((r) => r.review_id.startsWith(`${HOTEL}-r`) && Array.isArray(r.comments) && r.travel_type));
    const dates = reviews.map((r) => r.created_at);
    assert.deepEqual(dates, [...dates].sort().reverse());
    const stored = await db('reviews').where({ subject_type: 'HOTEL', subject_id: HOTEL }).count({ n: '*' }).first();
    assert.equal(Number(stored.n), reviews.length);
  });

  it('lists a traveller\'s reviews with trip and votes', async () => {
    const res = await api().get('/api/reviews/travellers/T-002');
    assert.equal(res.status, 200);
    assert.equal(res.body.summary.scale, 5);
    assert.ok(res.body.reviews.length >= 3);
    assert.ok(res.body.reviews.every((r) => r.trip?.city && r.votes && r.rating >= 1 && r.rating <= 5));
  });

  it('404 for an unknown hotel, traveller or subject type', async () => {
    assert.equal((await api().get('/api/reviews/hotels/HTL-NOPE')).status, 404);
    assert.equal((await api().get('/api/reviews/travellers/T-9999/search?q=late')).status, 404);
    assert.equal((await api().get(`/api/reviews/groups/${HOTEL}`)).status, 404);
  });

  it('suggested questions come with the index status', async () => {
    const res = await api().get(`/api/reviews/hotels/${HOTEL}/questions`);
    assert.equal(res.status, 200);
    assert.equal(res.body.questions.length, 8);
    assert.ok(res.body.questions.some((q) => q.text === 'Is it quiet at night?'));
    assert.ok(res.body.index.chunks > 0);
    const t = await api().get('/api/reviews/travellers/T-002/questions');
    assert.ok(t.body.questions.some((q) => q.text === 'Do they split costs fairly?'));
  });

  it('a suggested question runs hybrid and returns ranked chunks of this hotel only', async () => {
    const res = await search('is it quiet at night?', '&limit=10');
    assert.equal(res.status, 200);
    assert.equal(res.body.mode, 'HYBRID_QUESTION');
    assert.equal(res.body.question_id, 'HQ-1');
    const { results } = res.body;
    assert.ok(results.length > 0);
    assert.deepEqual(results.map((r) => r.rank), results.map((_, i) => i + 1));
    assert.ok(results.every((r) => r.review.review_id.startsWith(`${HOTEL}-r`)));
    assert.ok(results.every((r, i) => i === 0 || results[i - 1].score >= r.score));
    assert.ok(results.every((r) => r.bm25 || r.vector));
    assert.match(results[0].content, /quiet|night/i);
    assert.ok(results[0].matched_terms.length > 0);
  });

  it('free text with keyword hits fuses BM25 with the feedback vector; no hits → BM25_ONLY, empty', async () => {
    const res = await search('front desk check-in');
    assert.equal(res.status, 200);
    assert.ok(['HYBRID_FEEDBACK', 'BM25_ONLY'].includes(res.body.mode));
    assert.ok(res.body.results.length > 0 && res.body.results.length <= 5);
    assert.ok(res.body.results[0].bm25);

    const none = await search('zzzz qqqq');
    assert.equal(none.status, 200);
    assert.equal(none.body.mode, 'BM25_ONLY');
    assert.deepEqual(none.body.results, []);
  });

  it('400 for an empty or too long question, or a bad limit', async () => {
    const empty = await search('   ');
    assert.equal(empty.status, 400);
    assert.ok('q' in empty.body.error.fields);
    assert.equal((await search('x'.repeat(201))).status, 400);
    assert.equal((await search('quiet', '&limit=50')).status, 400);
  });

  it('hotel search cards carry the stored review count', async () => {
    const res = await asTraveller('T-001').get('/api/groups/G-01/hotels');
    assert.equal(res.status, 200);
    const gion = res.body.hotels.find((h) => h.hotel_id === HOTEL);
    const list = await api().get(`/api/reviews/hotels/${HOTEL}`);
    assert.equal(gion.review_count, list.body.reviews.length);
  });
});
