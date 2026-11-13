import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { Review, ReviewComment } from '@/features/hotels/reviewThreads';

/**
 * MOCK review interactions (user-requested: no API). Votes, new reviews and comments are
 * kept in this browser only, per traveller. Generated mock threads are not stored.
 */
export const HOTEL_REVIEWS_KEY = 'hotel_reviews_v1';
export type Vote = 1 | -1;

interface ReviewState {
  /** `${voterId}|${targetId}` → vote. A target is a review or a comment id. */
  votes: Record<string, Vote>;
  /** Reviews written in this browser, by hotel. */
  added: Record<string, Review[]>;
  /** Comments written in this browser, by review id. */
  comments: Record<string, ReviewComment[]>;
  vote(voterId: string, targetId: string, dir: Vote): void;
  addReview(hotelId: string, review: Omit<Review, 'id' | 'hotelId' | 'createdAt' | 'baseScore' | 'comments' | 'mine'>): Review;
  addComment(reviewId: string, parentId: string | null, author: string, body: string): ReviewComment;
}

const safeStorage: StateStorage = {
  getItem: (n) => { try { return localStorage.getItem(n); } catch { return null; } },
  setItem: (n, v) => { try { localStorage.setItem(n, v); } catch { /* ignore */ } },
  removeItem: (n) => { try { localStorage.removeItem(n); } catch { /* ignore */ } },
};

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const voteKey = (voterId: string, targetId: string) => `${voterId}|${targetId}`;

export const useHotelReviewStore = create<ReviewState>()(persist((set) => ({
  votes: {},
  added: {},
  comments: {},
  vote(voterId, targetId, dir) {
    set((s) => {
      const key = voteKey(voterId, targetId);
      const votes = { ...s.votes };
      // Clicking the same arrow again removes the vote, like Reddit.
      if (votes[key] === dir) delete votes[key]; else votes[key] = dir;
      return { votes };
    });
  },
  addReview(hotelId, input) {
    const review: Review = { ...input, id: newId('mine'), hotelId, createdAt: new Date().toISOString(), baseScore: 1, comments: [], mine: true };
    set((s) => ({ added: { ...s.added, [hotelId]: [review, ...(s.added[hotelId] ?? [])] } }));
    return review;
  },
  addComment(reviewId, parentId, author, body) {
    const comment: ReviewComment = { id: newId('c'), parentId, author, body, createdAt: new Date().toISOString(), baseScore: 1, mine: true };
    set((s) => ({ comments: { ...s.comments, [reviewId]: [...(s.comments[reviewId] ?? []), comment] } }));
    return comment;
  },
}), { name: HOTEL_REVIEWS_KEY, version: 1, storage: createJSONStorage(() => safeStorage) }));
