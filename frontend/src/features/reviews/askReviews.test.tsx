import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StateStorage } from 'zustand/middleware';
import { answerKey, createReviewSearchStore, normalizeQuery, subjectKey } from '@/store/useReviewSearchStore';
import type { ReviewApi } from '@/services/reviewService';
import { createReputationService, summarise, toTravellerReview } from '@/services/reputationService';
import type { ApiReview, SearchResponse } from '@/types/reviews';
import { Highlighted } from './AskReviews';

// TASK-X3: "Ask the reviews" client state, highlighting and the traveller reputation adapter.
const memory = (): StateStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
};
const answer = (query: string): SearchResponse => ({
  subject: { type: 'HOTEL', id: 'HTL-KYO-001', name: 'Gion Corner Hotel' }, query, mode: 'HYBRID_QUESTION', terms: ['quiet'],
  question_id: 'HQ-1', took_ms: 3, results: [],
});
const api = (over: Partial<ReviewApi> = {}): ReviewApi => ({
  listReviews: vi.fn(), listQuestions: vi.fn(), search: vi.fn(async (_t, _i, q) => answer(q)), ...over,
});

describe('useReviewSearchStore', () => {
  it('normalises questions so case and punctuation share one cached answer', () => {
    expect(normalizeQuery('  Is it QUIET at night?? ')).toBe('is it quiet at night');
    expect(answerKey('hotels', 'H1', 'Quiet?')).toBe(answerKey('hotels', 'H1', 'quiet'));
    expect(subjectKey('travellers', 'T-002')).toBe('travellers:T-002');
  });

  it('asks once per question: concurrent and repeated asks reuse the answer', async () => {
    const reviews = api();
    const store = createReviewSearchStore(reviews, memory());
    await Promise.all([store.getState().ask('hotels', 'H1', 'Is it quiet?'), store.getState().ask('hotels', 'H1', 'is it quiet')]);
    await store.getState().ask('hotels', 'H1', 'IS IT QUIET!');
    expect(reviews.search).toHaveBeenCalledTimes(1);
    expect(store.getState().answers[answerKey('hotels', 'H1', 'is it quiet')].data?.query).toBe('Is it quiet?');
    await store.getState().ask('hotels', 'H2', 'is it quiet');
    expect(reviews.search).toHaveBeenCalledTimes(2);
  });

  it('keeps an error per question and recovers on retry', async () => {
    const search = vi.fn().mockRejectedValueOnce(new Error('Cannot reach the backend.')).mockResolvedValueOnce(answer('wifi'));
    const store = createReviewSearchStore(api({ search }), memory());
    await store.getState().ask('hotels', 'H1', 'wifi');
    expect(store.getState().answers[answerKey('hotels', 'H1', 'wifi')]).toMatchObject({ loading: false, error: 'Cannot reach the backend.' });
    await store.getState().ask('hotels', 'H1', 'wifi');
    expect(store.getState().answers[answerKey('hotels', 'H1', 'wifi')]).toMatchObject({ error: null, data: { query: 'wifi' } });
  });

  it('ignores blank questions', async () => {
    const reviews = api();
    await createReviewSearchStore(reviews, memory()).getState().ask('hotels', 'H1', ' ?! ');
    expect(reviews.search).not.toHaveBeenCalled();
  });

  it('remembers only submitted questions, newest first, max 4, persisted', () => {
    const storage = memory();
    const store = createReviewSearchStore(api(), storage);
    for (const q of ['a1', 'b2', 'c3', 'd4', 'e5', 'B2']) store.getState().remember('hotels', q);
    expect(store.getState().recent.hotels).toEqual(['B2', 'e5', 'd4', 'c3']);
    store.getState().forgetRecent('hotels', 'e5');
    expect(store.getState().recent.hotels).toEqual(['B2', 'd4', 'c3']);
    const saved = Object.values(storage.data)[0];
    expect(saved).toContain('B2');
    expect(saved).not.toContain('answers');
  });
});

describe('Highlighted', () => {
  it('marks whole matched words in any case', () => {
    expect(renderToStaticMarkup(<p><Highlighted text="Super quiet at night; Nights are calm." words={['quiet', 'nights']} /></p>))
      .toBe('<p>Super <mark>quiet</mark> at night; <mark>Nights</mark> are calm.</p>');
  });
  it('does not mark inside other words and escapes regex characters', () => {
    expect(renderToStaticMarkup(<p><Highlighted text="Unquiet (a+b) quiet" words={['quiet', 'a+b']} /></p>))
      .toBe('<p>Unquiet (<mark>a+b</mark>) <mark>quiet</mark></p>');
  });
});

describe('reputation adapter (traveller reviews from the API)', () => {
  const review = (over: Partial<ApiReview> = {}): ApiReview => ({
    review_id: 'T-002-RV-1', author: 'Kavya Nair', author_from: 'Kochi', rating: 5, rating_scale: 5, title: null,
    body: 'Split every bill fairly.', base_score: 10, created_at: '2026-01-05', travel_type: null, comments: [],
    trip: { city: 'Kyoto', month: 'Jan 2026' }, votes: { up: 12, down: 2 }, ...over,
  });

  it('maps API reviews and recomputes the rating summary', () => {
    const mapped = toTravellerReview(review());
    expect(mapped).toMatchObject({ text: 'Split every bill fairly.', author: { name: 'Kavya Nair', home_city: 'Kochi' }, votes: { up: 12, down: 2, my_vote: null } });
    expect(summarise([mapped, toTravellerReview(review({ review_id: 'x', rating: 4 }))])).toEqual({
      rating_average: 4.5, rating_count: 2, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    });
    expect(summarise([]).rating_count).toBe(0);
  });

  it('uses the API reviews and keeps the sample profile votes', async () => {
    const service = createReputationService({ listReviews: vi.fn(async () => ({
      subject: { type: 'TRAVELLER' as const, id: 'T-002', name: 'Priya Shah' }, summary: { count: 1, average: 3, scale: 5 }, reviews: [review({ rating: 3 })],
    })) });
    const rep = await service.getReputation('T-002', null);
    expect(rep.reviews.map((r) => r.review_id)).toEqual(['T-002-RV-1']);
    expect(rep.rating_average).toBe(3);
    expect(rep.profile_votes.up).toBeGreaterThan(0);
  });
});
