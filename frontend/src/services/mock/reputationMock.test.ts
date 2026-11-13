import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyVote, buildReputation, compactScore, REPUTATION_STORAGE_KEY, reputationMock, sortReviews, voteScore } from './reputationMock';
import type { TravellerReview } from '@/types/reputation';

// Vitest runs in Node: give the mock an in-memory localStorage.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
});

describe('applyVote (Reddit-style)', () => {
  const none = { up: 10, down: 2, my_vote: null };
  it('upvote / downvote from no vote', () => {
    expect(applyVote(none, 'UP')).toEqual({ up: 11, down: 2, my_vote: 'UP' });
    expect(applyVote(none, 'DOWN')).toEqual({ up: 10, down: 3, my_vote: 'DOWN' });
  });
  it('clicking the same arrow again removes the vote', () => {
    expect(applyVote({ up: 11, down: 2, my_vote: 'UP' }, 'UP')).toEqual(none);
    expect(applyVote({ up: 10, down: 3, my_vote: 'DOWN' }, 'DOWN')).toEqual(none);
  });
  it('switching moves the vote in one step (score changes by 2)', () => {
    const switched = applyVote({ up: 11, down: 2, my_vote: 'UP' }, 'DOWN');
    expect(switched).toEqual({ up: 10, down: 3, my_vote: 'DOWN' });
    expect(voteScore(switched)).toBe(voteScore({ up: 11, down: 2 }) - 2);
  });
  it('never goes below zero', () => {
    expect(applyVote({ up: 0, down: 0, my_vote: 'UP' }, 'DOWN')).toEqual({ up: 0, down: 1, my_vote: 'DOWN' });
  });
});

describe('compactScore', () => {
  it('formats like Reddit', () => {
    expect(compactScore(42)).toBe('42');
    expect(compactScore(-7)).toBe('-7');
    expect(compactScore(1200)).toBe('1.2k');
    expect(compactScore(1000)).toBe('1k');
    expect(compactScore(15400)).toBe('15k');
  });
});

describe('buildReputation (sample data)', () => {
  it('is deterministic per traveller', () => {
    expect(buildReputation('T-002')).toEqual(buildReputation('T-002'));
    expect(buildReputation('T-002').reviews).not.toEqual(buildReputation('T-003').reviews);
  });
  it('has 3–7 reviews, valid ratings and a consistent summary', () => {
    for (const id of ['T-001', 'T-002', 'T-010', 'T-024', 'T-1001']) {
      const rep = buildReputation(id);
      expect(rep.reviews.length).toBeGreaterThanOrEqual(3);
      expect(rep.reviews.length).toBeLessThanOrEqual(7);
      expect(rep.rating_count).toBe(rep.reviews.length);
      expect(Object.values(rep.distribution).reduce((a, b) => a + b, 0)).toBe(rep.reviews.length);
      const avg = rep.reviews.reduce((s, r) => s + r.rating, 0) / rep.reviews.length;
      expect(rep.rating_average).toBeCloseTo(avg, 1);
      for (const r of rep.reviews) {
        expect(r.rating).toBeGreaterThanOrEqual(1);
        expect(r.rating).toBeLessThanOrEqual(5);
        expect(r.created_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(r.votes.my_vote).toBeNull();
      }
    }
  });
});

describe('sortReviews', () => {
  const review = (id: string, rating: number, up: number, down: number, created_at: string) =>
    ({ review_id: id, rating, created_at, votes: { up, down, my_vote: null } }) as TravellerReview;
  const list = [review('a', 3, 50, 0, '2026-01-01'), review('b', 5, 10, 0, '2026-03-01'), review('c', 4, 30, 40, '2026-02-01')];
  it('TOP by score, NEW by date, RATING by stars', () => {
    expect(sortReviews(list, 'TOP').map((r) => r.review_id)).toEqual(['a', 'b', 'c']);
    expect(sortReviews(list, 'NEW').map((r) => r.review_id)).toEqual(['b', 'c', 'a']);
    expect(sortReviews(list, 'RATING').map((r) => r.review_id)).toEqual(['b', 'c', 'a']);
  });
  it('does not mutate the input', () => {
    const before = list.map((r) => r.review_id);
    sortReviews(list, 'NEW');
    expect(list.map((r) => r.review_id)).toEqual(before);
  });
});

describe('reputationMock votes are remembered per viewer in this browser', () => {
  beforeEach(() => localStorage.removeItem(REPUTATION_STORAGE_KEY));

  it('a saved vote is re-applied on the next load, only for that viewer', async () => {
    const first = await reputationMock.getReputation('T-002', 'T-001');
    const voted = await reputationMock.vote('T-002', 'T-001', first.profile_votes, 'UP');
    expect(voted.my_vote).toBe('UP');

    const again = await reputationMock.getReputation('T-002', 'T-001');
    expect(again.profile_votes).toEqual(voted);
    const otherViewer = await reputationMock.getReputation('T-002', 'T-003');
    expect(otherViewer.profile_votes.my_vote).toBeNull();
  });

  it('un-voting clears the stored vote', async () => {
    const rep = await reputationMock.getReputation('T-002', 'T-001');
    const review = rep.reviews[0];
    const up = await reputationMock.vote(review.review_id, 'T-001', review.votes, 'UP');
    await reputationMock.vote(review.review_id, 'T-001', up, 'UP');
    const reloaded = await reputationMock.getReputation('T-002', 'T-001');
    expect(reloaded.reviews[0].votes).toEqual(review.votes);
  });

  it('corrupt storage falls back to no votes', async () => {
    localStorage.setItem(REPUTATION_STORAGE_KEY, '{not json');
    const rep = await reputationMock.getReputation('T-002', 'T-001');
    expect(rep.profile_votes.my_vote).toBeNull();
  });
});
