// TASK-X3: pure retrieval maths (tokenizer, chunking, BM25, Reciprocal Rank Fusion).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const text = require('../../../src/utils/text');
const bm25 = require('../../../src/utils/bm25');
const { reciprocalRankFusion, RRF_K } = require('../../../src/utils/rankFusion');

describe('text.tokenize', () => {
  it('lowercases, drops stopwords and punctuation, and stems lightly', () => {
    assert.deepEqual(text.tokenize('The rooms were QUIET at night!'), ['room', 'quiet', 'night']);
    assert.deepEqual(text.tokenize('Planned trips, running late, cities'), ['plan', 'trip', 'run', 'late', 'city']);
  });
  it('keeps short or ambiguous words intact', () => {
    assert.deepEqual(text.tokenize('family bus wifi'), ['family', 'bus', 'wifi']);
    assert.deepEqual(text.tokenize('Wi-Fi'), ['wi', 'fi']);
  });
  it('folds accents and keeps numbers', () => {
    assert.deepEqual(text.tokenize('Café 10/10'), ['cafe', '10', '10']);
  });
  it('the same word always gives the same stem (query and document agree)', () => {
    assert.equal(text.stem('quietly'), text.stem('quiet'));
    assert.equal(text.stem('splits'), text.stem('split'));
  });
});

describe('text.matchedWords', () => {
  it('returns the original words in a passage whose stems are in the query', () => {
    assert.deepEqual(text.matchedWords('Super quiet at night; nights are calm.', ['night', 'quiet']), ['quiet', 'night', 'nights']);
  });
});

describe('text.chunkReview', () => {
  it('splits a review into sentences', () => {
    assert.deepEqual(text.chunkReview('Great location near the station. Rooms were spotless and comfy!'), [
      'Great location near the station.', 'Rooms were spotless and comfy!',
    ]);
  });
  it('merges a very short sentence into its neighbour', () => {
    assert.deepEqual(text.chunkReview('10/10. Organised, friendly and calm under pressure.'), ['10/10. Organised, friendly and calm under pressure.']);
    assert.deepEqual(text.chunkReview('Really fun trip with good food. Loved it.'), ['Really fun trip with good food. Loved it.']);
  });
  it('a one-sentence review is one chunk; blank text gives none', () => {
    assert.deepEqual(text.chunkReview('Cancelled on the group two days before the trip.'), ['Cancelled on the group two days before the trip.']);
    assert.deepEqual(text.chunkReview('   '), []);
  });
});

describe('bm25', () => {
  // Hand-computed example: 3 documents, k1 = 1.2, b = 0.75.
  const docs = [
    { id: 'a', tokens: ['quiet', 'room', 'quiet'] }, // dl 3
    { id: 'b', tokens: ['noisy', 'room'] },          // dl 2
    { id: 'c', tokens: ['great', 'breakfast', 'staff', 'room'] }, // dl 4
  ];
  const index = bm25.buildIndex(docs);

  it('stores N, avgdl and document frequencies', () => {
    assert.equal(index.N, 3);
    assert.equal(index.avgdl, 3);
    assert.equal(index.df.get('room'), 3);
    assert.equal(index.df.get('quiet'), 1);
  });

  it('idf uses ln(1 + (N - n + 0.5) / (n + 0.5))', () => {
    assert.ok(Math.abs(bm25.idf(index, 'quiet') - Math.log(1 + 2.5 / 1.5)) < 1e-12);
    assert.ok(Math.abs(bm25.idf(index, 'room') - Math.log(1 + 0.5 / 3.5)) < 1e-12);
    assert.equal(bm25.idf(index, 'unknown'), 0);
  });

  it('scores a document with the BM25 formula', () => {
    // tf = 2, dl = avgdl → 2 * 2.2 / (2 + 1.2) = 1.375
    const expected = Math.log(1 + 2.5 / 1.5) * 1.375;
    const [top] = bm25.search(index, ['quiet']);
    assert.equal(top.id, 'a');
    assert.ok(Math.abs(top.score - expected) < 1e-12);
  });

  it('ranks by score, only returns matching docs, and can be limited to some ids', () => {
    assert.deepEqual(bm25.search(index, ['quiet', 'room']).map((r) => r.id), ['a', 'b', 'c']);
    assert.deepEqual(bm25.search(index, ['breakfast']).map((r) => r.id), ['c']);
    assert.deepEqual(bm25.search(index, ['room'], new Set(['b', 'c'])).map((r) => r.id), ['b', 'c']);
    assert.deepEqual(bm25.search(index, ['pool']), []);
  });

  it('a repeated query term counts once', () => {
    assert.deepEqual(bm25.search(index, ['quiet', 'quiet']), bm25.search(index, ['quiet']));
  });

  it('ties keep the original document order (stable)', () => {
    const tie = bm25.buildIndex([{ id: 'x', tokens: ['pool'] }, { id: 'y', tokens: ['pool'] }]);
    assert.deepEqual(bm25.search(tie, ['pool']).map((r) => r.id), ['x', 'y']);
  });
});

describe('reciprocalRankFusion', () => {
  it('scores each id with the sum of 1 / (k + rank) over the lists it appears in', () => {
    assert.equal(RRF_K, 60);
    const fused = reciprocalRankFusion([['a', 'b', 'c'], ['b', 'd']]);
    assert.deepEqual(fused.map((f) => f.id), ['b', 'a', 'd', 'c']);
    const b = fused.find((f) => f.id === 'b');
    assert.ok(Math.abs(b.score - (1 / 62 + 1 / 61)) < 1e-12);
    assert.deepEqual(b.ranks, [2, 1]);
    assert.deepEqual(fused.find((f) => f.id === 'd').ranks, [null, 2]);
  });

  it('breaks ties by the best rank, then by first appearance', () => {
    const fused = reciprocalRankFusion([['a', 'b'], ['b', 'a']]);
    assert.deepEqual(fused.map((f) => f.id), ['a', 'b']);
    assert.equal(fused[0].score, fused[1].score);
  });

  it('an empty list contributes nothing', () => {
    assert.deepEqual(reciprocalRankFusion([['a'], []]).map((f) => f.id), ['a']);
    assert.deepEqual(reciprocalRankFusion([]), []);
  });
});
