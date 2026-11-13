// TASK-X3: reviews.service — subject checks, query-vector choice, fusion and result shape (helpers mocked).
const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const reviewsHelper = require('../../../src/helpers/postgres/reviews.helper');
const groupHotelsHelper = require('../../../src/helpers/postgres/groupHotels.helper');
const travellersHelper = require('../../../src/helpers/postgres/travellers.helper');
const vectorsHelper = require('../../../src/helpers/vector/reviewVectors.helper');
const bm25Helper = require('../../../src/helpers/bm25/reviewBm25.helper');
const HttpError = require('../../../src/utils/HttpError');
const service = require('../../../src/services/reviews.service.ts');

const is = (status, field) => (err) => err instanceof HttpError && err.status === status && (!field || field in (err.fields ?? {}));
const hotel = { hotel_id: 'HTL-KIX-001', name: 'Gion Corner Hotel', area: 'Gion', city: 'Kyoto' };
const QUESTIONS = [
  { question_id: 'HQ-1', text: 'Is it quiet at night?', has_embedding: true },
  { question_id: 'HQ-2', text: 'How clean are the rooms?', has_embedding: false },
];
const chunk = (id, over = {}) => ({
  chunk_id: id, review_id: id.replace(/-k\d+$/, ''), content: `Content of ${id}`, context: `Context of ${id}`,
  context_model: 'gemma3:4b', has_embedding: true, author: 'Neha', author_from: 'Pune', rating: '9.2', rating_scale: 10,
  title: 'Quiet, clean, friendly', created_at: '2026-06-01T00:00:00.000Z', meta: { travel_type: 'Couple' }, ...over,
});

/** Hotel HTL-KIX-001 exists; chunks load from `rows`. */
function setup({ bm25 = [], question, centroid, rows = {} } = {}) {
  mock.method(groupHotelsHelper, 'findHotel', async (id) => (id === hotel.hotel_id ? hotel : undefined));
  mock.method(reviewsHelper, 'listQuestions', async () => QUESTIONS);
  mock.method(reviewsHelper, 'findChunks', async (ids) => ids.map((id) => rows[id] ?? chunk(id)));
  const bm25Search = mock.method(bm25Helper, 'search', async () => bm25);
  const nearQuestion = mock.method(vectorsHelper, 'nearestToQuestion', async () => question ?? []);
  const nearCentroid = mock.method(vectorsHelper, 'nearestToCentroid', async () => centroid ?? []);
  return { bm25Search, nearQuestion, nearCentroid };
}

describe('reviews.service pure rules', () => {
  afterEach(() => mock.restoreAll());

  it('maps URL subject types and rejects others with 404', () => {
    assert.equal(service.parseSubjectType('hotels'), 'HOTEL');
    assert.equal(service.parseSubjectType('travellers'), 'TRAVELLER');
    assert.throws(() => service.parseSubjectType('groups'), is(404));
  });

  it('normalizeQuestion ignores case, punctuation and spacing', () => {
    assert.equal(service.normalizeQuestion('  Is it QUIET at night ?? '), 'is it quiet at night');
    assert.equal(service.normalizeQuestion('Wi-Fi fast?'), 'wi fi fast');
  });

  it('matchQuestion only matches a suggested question that has a precomputed embedding', () => {
    assert.equal(service.matchQuestion(QUESTIONS, 'is it quiet at night')?.question_id, 'HQ-1');
    assert.equal(service.matchQuestion(QUESTIONS, 'How clean are the rooms?'), undefined);
    assert.equal(service.matchQuestion(QUESTIONS, 'quiet?'), undefined);
  });

  it('filterVector keeps hits above the floor and within 0.1 of the best', () => {
    const hits = [{ id: 'a', similarity: 0.72 }, { id: 'b', similarity: 0.66 }, { id: 'c', similarity: 0.59 }];
    assert.deepEqual(service.filterVector(hits, 'HYBRID_QUESTION').map((h) => h.id), ['a', 'b']);
    assert.deepEqual(service.filterVector([{ id: 'x', similarity: 0.58 }], 'HYBRID_QUESTION'), []);
    const fb = [{ id: 'a', similarity: 1 }, { id: 'b', similarity: 0.91 }, { id: 'c', similarity: 0.88 }];
    assert.deepEqual(service.filterVector(fb, 'HYBRID_FEEDBACK').map((h) => h.id), ['a', 'b']);
    assert.deepEqual(service.filterVector([{ id: 'x', similarity: 0.84 }], 'HYBRID_FEEDBACK'), []);
  });

  it('relevance is the fused score relative to rank 1 in both lists', () => {
    assert.equal(service.relevance(2 / 61), 1);
    assert.equal(service.relevance(1 / 61), 0.5);
  });
});

describe('reviews.service.search', () => {
  afterEach(() => mock.restoreAll());

  it('400 for an empty or too long question, without touching the index', async () => {
    const { bm25Search } = setup();
    await assert.rejects(service.search('hotels', hotel.hotel_id, { q: '   ' }), is(400, 'q'));
    await assert.rejects(service.search('hotels', hotel.hotel_id, { q: 'x'.repeat(201) }), is(400, 'q'));
    await assert.rejects(service.search('hotels', hotel.hotel_id, { q: ['a', 'b'] }), is(400, 'q'));
    assert.equal(bm25Search.mock.callCount(), 0);
  });

  it('400 for a limit outside 1–20', async () => {
    setup();
    await assert.rejects(service.search('hotels', hotel.hotel_id, { q: 'quiet', limit: '0' }), is(400, 'limit'));
    await assert.rejects(service.search('hotels', hotel.hotel_id, { q: 'quiet', limit: '21' }), is(400, 'limit'));
  });

  it('404 for an unknown hotel', async () => {
    setup();
    await assert.rejects(service.search('hotels', 'HTL-NOPE', { q: 'quiet' }), is(404));
  });

  it('a suggested question uses its precomputed embedding and fuses both rankings (HYBRID_QUESTION)', async () => {
    const { bm25Search, nearQuestion, nearCentroid } = setup({
      bm25: [{ id: 'A-k0', score: 3.2 }, { id: 'B-k0', score: 1.1 }],
      question: [{ id: 'C-k0', similarity: 0.71 }, { id: 'A-k0', similarity: 0.69 }],
    });
    const out = await service.search('hotels', hotel.hotel_id, { q: 'Is it quiet at night?' });
    assert.equal(out.mode, 'HYBRID_QUESTION');
    assert.deepEqual(bm25Search.mock.calls[0].arguments.slice(0, 3), ['HOTEL', hotel.hotel_id, ['quiet', 'night']]);
    assert.equal(nearQuestion.mock.calls[0].arguments[0], 'HQ-1');
    assert.equal(nearCentroid.mock.callCount(), 0);
    assert.deepEqual(out.results.map((r) => r.chunk_id), ['A-k0', 'C-k0', 'B-k0']);
    const [a] = out.results;
    assert.equal(a.rank, 1);
    assert.ok(Math.abs(a.score - (1 / 61 + 1 / 62)) < 1e-9);
    assert.deepEqual(a.bm25, { rank: 1, score: 3.2 });
    assert.deepEqual(a.vector, { rank: 2, similarity: 0.69 });
    assert.equal(out.results[1].bm25, null);
    assert.deepEqual(out.subject, { type: 'HOTEL', id: hotel.hotel_id, name: 'Gion Corner Hotel' });
    assert.equal(out.query, 'Is it quiet at night?');
    assert.equal(typeof out.took_ms, 'number');
  });

  it('free text with keyword hits uses the centroid of the top 3 BM25 chunks (HYBRID_FEEDBACK)', async () => {
    const { nearQuestion, nearCentroid } = setup({
      bm25: [{ id: 'A-k0', score: 3 }, { id: 'B-k0', score: 2 }, { id: 'C-k0', score: 1 }, { id: 'D-k0', score: 0.5 }],
      centroid: [{ id: 'E-k0', similarity: 0.9 }],
    });
    const out = await service.search('hotels', hotel.hotel_id, { q: 'noise from the street' });
    assert.equal(out.mode, 'HYBRID_FEEDBACK');
    assert.equal(nearQuestion.mock.callCount(), 0);
    assert.deepEqual(nearCentroid.mock.calls[0].arguments[0], ['A-k0', 'B-k0', 'C-k0']);
    assert.ok(out.results.some((r) => r.chunk_id === 'E-k0' && r.bm25 === null && r.vector.rank === 1));
  });

  it('no keyword hits on free text → BM25_ONLY with no results (not an error)', async () => {
    const { nearCentroid } = setup();
    const out = await service.search('hotels', hotel.hotel_id, { q: 'zzz qqq' });
    assert.equal(out.mode, 'BM25_ONLY');
    assert.deepEqual(out.results, []);
    assert.equal(nearCentroid.mock.callCount(), 0);
  });

  it('respects the limit and returns the review behind each chunk with highlighted words', async () => {
    setup({
      bm25: [{ id: 'A-k0', score: 2 }, { id: 'B-k0', score: 1 }],
      rows: { 'A-k0': chunk('A-k0', { content: 'Super quiet at night even though Gion is busy.', context: 'About noise at night.' }) },
    });
    const out = await service.search('hotels', hotel.hotel_id, { q: 'quiet nights', limit: '1' });
    assert.equal(out.results.length, 1);
    const [r] = out.results;
    assert.deepEqual(r.matched_terms, ['quiet', 'night']);
    assert.deepEqual(r.review, {
      review_id: 'A', author: 'Neha', author_from: 'Pune', rating: 9.2, rating_scale: 10, title: 'Quiet, clean, friendly',
      created_at: '2026-06-01T00:00:00.000Z', travel_type: 'Couple', trip: null,
    });
    assert.equal(r.contextualized, true);
  });
});

describe('reviews.service.listReviews / listQuestions', () => {
  afterEach(() => mock.restoreAll());

  it('returns reviews newest first with a rating summary', async () => {
    mock.method(travellersHelper, 'findById', async () => ({ traveller_id: 'T-002', name: 'Priya Shah' }));
    mock.method(reviewsHelper, 'listReviews', async () => [
      { review_id: 'T-002-RV-1', rating: '5', rating_scale: 5, created_at: '2026-01-05', meta: { trip: { city: 'Kyoto', month: 'Jan 2026' }, votes: { up: 4, down: 1 } }, title: null, body: 'x', author: 'A', author_from: 'B', base_score: 3 },
      { review_id: 'T-002-RV-2', rating: '4', rating_scale: 5, created_at: '2026-03-01', meta: { trip: { city: 'Osaka', month: 'Mar 2026' }, votes: { up: 1, down: 0 } }, title: null, body: 'y', author: 'C', author_from: 'D', base_score: 1 },
    ]);
    const out = await service.listReviews('travellers', 'T-002');
    assert.deepEqual(out.subject, { type: 'TRAVELLER', id: 'T-002', name: 'Priya Shah' });
    assert.deepEqual(out.summary, { count: 2, average: 4.5, scale: 5 });
    assert.deepEqual(out.reviews.map((r) => r.review_id), ['T-002-RV-2', 'T-002-RV-1']);
    assert.equal(out.reviews[0].rating, 4);
    assert.deepEqual(out.reviews[0].trip, { city: 'Osaka', month: 'Mar 2026' });
  });

  it('404 for an unknown traveller', async () => {
    mock.method(travellersHelper, 'findById', async () => undefined);
    await assert.rejects(service.listReviews('travellers', 'T-999'), is(404));
  });

  it('questions come with the index status of the subject', async () => {
    setup();
    mock.method(reviewsHelper, 'indexStatus', async () => ({ chunks: 6, contextualized: 6, embedded: 5, context_model: 'gemma3:4b', embed_model: 'nomic-embed-text' }));
    const out = await service.listQuestions('hotels', hotel.hotel_id);
    assert.deepEqual(out.questions, [{ question_id: 'HQ-1', text: 'Is it quiet at night?' }, { question_id: 'HQ-2', text: 'How clean are the rooms?' }]);
    assert.equal(out.index.embedded, 5);
  });
});
