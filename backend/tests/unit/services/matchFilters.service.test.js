const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../../../src/services/matchFilters.service.ts');

const m = (id, shared, kind) => ({ id, reasons: { shared_interests: shared }, composition: { female: 0, male: 0, kind } });
const NONE = { min_shared: null, must: [], composition: null };
const list = [
  m('A', ['TEMPLES', 'STREET_FOOD'], 'WOMEN_ONLY'),
  m('B', ['TEMPLES', 'STREET_FOOD', 'ADVENTURE'], 'MIXED'),
  m('C', ['STREET_FOOD', 'ADVENTURE', 'HIKING', 'NATURE'], 'MEN_ONLY'),
];
const ids = (xs) => xs.map((x) => x.id);

describe('matchFilters.compositionOf', () => {
  it('women only, men only, mixed (owner included)', () => {
    assert.deepEqual(service.compositionOf(['FEMALE']), { female: 1, male: 0, kind: 'WOMEN_ONLY' });
    assert.deepEqual(service.compositionOf(['MALE', 'MALE']), { female: 0, male: 2, kind: 'MEN_ONLY' });
    assert.deepEqual(service.compositionOf(['FEMALE', 'MALE', 'FEMALE']), { female: 2, male: 1, kind: 'MIXED' });
  });
});

describe('matchFilters.applyFilters', () => {
  it('no filters keeps everything in order', () => {
    assert.deepEqual(ids(service.applyFilters(list, NONE)), ['A', 'B', 'C']);
  });
  it('minimum shared interests (inclusive)', () => {
    assert.deepEqual(ids(service.applyFilters(list, { ...NONE, min_shared: 3 })), ['B', 'C']);
    assert.deepEqual(ids(service.applyFilters(list, { ...NONE, min_shared: 4 })), ['C']);
    assert.deepEqual(ids(service.applyFilters(list, { ...NONE, min_shared: 5 })), []);
  });
  it('"must share" needs ALL chosen interests', () => {
    assert.deepEqual(ids(service.applyFilters(list, { ...NONE, must: ['TEMPLES'] })), ['A', 'B']);
    assert.deepEqual(ids(service.applyFilters(list, { ...NONE, must: ['TEMPLES', 'ADVENTURE'] })), ['B']);
  });
  it('gender mix, and filters combine with AND', () => {
    assert.deepEqual(ids(service.applyFilters(list, { ...NONE, composition: 'WOMEN_ONLY' })), ['A']);
    assert.deepEqual(ids(service.applyFilters(list, { min_shared: 3, must: ['ADVENTURE'], composition: 'MEN_ONLY' })), ['C']);
    assert.deepEqual(ids(service.applyFilters(list, { min_shared: 3, must: [], composition: 'WOMEN_ONLY' })), []);
  });
});

describe('matchFilters.buildFacets', () => {
  it('counts gender mixes and shared interests over all matches, most common first', () => {
    const facets = service.buildFacets(list, new Map([['TEMPLES', 'Temples'], ['STREET_FOOD', 'Street food']]));
    assert.deepEqual(facets.composition, { WOMEN_ONLY: 1, MEN_ONLY: 1, MIXED: 1 });
    assert.equal(facets.max_shared, 4);
    assert.deepEqual(facets.interests[0], { interest: 'STREET_FOOD', label: 'Street food', count: 3 });
    assert.equal(facets.interests.find((i) => i.interest === 'HIKING').label, 'HIKING'); // no label → id
  });
  it('empty list', () => {
    assert.deepEqual(service.buildFacets([], new Map()), { composition: { WOMEN_ONLY: 0, MEN_ONLY: 0, MIXED: 0 }, interests: [], max_shared: 0 });
  });
});
