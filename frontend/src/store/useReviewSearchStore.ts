import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { reviewService } from '@/services/reviewService';
import type { ReviewApi } from '@/services/reviewService';
import type { QuestionList, ReviewList, ReviewSubjectPath, SearchResponse } from '@/types/reviews';

/**
 * TASK-X3: reviews, suggested questions and "Ask the reviews" answers, cached per subject so
 * re-asking or revisiting is instant. Concurrent requests for the same key share one call.
 * Only the last few questions asked are persisted (a per-browser convenience).
 */
export const REVIEW_SEARCH_KEY = 'review_search_v1';
const RECENT_MAX = 4;

export interface Loadable<T> { data?: T; loading: boolean; error: string | null }
const IDLE = { loading: false, error: null };

export const subjectKey = (type: ReviewSubjectPath, id: string) => `${type}:${id}`;
/** Same normalisation idea as the backend: case, punctuation and spacing don't matter. */
export const normalizeQuery = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const answerKey = (type: ReviewSubjectPath, id: string, q: string) => `${subjectKey(type, id)}|${normalizeQuery(q)}`;

interface ReviewSearchState {
  reviews: Record<string, Loadable<ReviewList>>;
  questions: Record<string, Loadable<QuestionList>>;
  answers: Record<string, Loadable<SearchResponse>>;
  /** Recently asked questions per subject type (hotels / travellers), newest first. */
  recent: Record<string, string[]>;
  loadReviews(type: ReviewSubjectPath, id: string, force?: boolean): Promise<void>;
  loadQuestions(type: ReviewSubjectPath, id: string): Promise<void>;
  /** Fetches (or reuses) the answer for a question. Typing calls this, debounced. */
  ask(type: ReviewSubjectPath, id: string, q: string): Promise<void>;
  /** Adds an explicitly submitted question to the recent list. */
  remember(type: ReviewSubjectPath, q: string): void;
  forgetRecent(type: ReviewSubjectPath, q: string): void;
}

const safeStorage: StateStorage = {
  getItem: (n) => { try { return localStorage.getItem(n); } catch { return null; } },
  setItem: (n, v) => { try { localStorage.setItem(n, v); } catch { /* convenience only */ } },
  removeItem: (n) => { try { localStorage.removeItem(n); } catch { /* ignore */ } },
};

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

export function createReviewSearchStore(api: ReviewApi, storage: StateStorage = safeStorage) {
  const inFlight = new Map<string, Promise<void>>();
  const once = (key: string, work: () => Promise<void>) => {
    const running = inFlight.get(key);
    if (running) return running;
    const p = work().finally(() => inFlight.delete(key));
    inFlight.set(key, p);
    return p;
  };

  return create<ReviewSearchState>()(persist((set, get) => {
    /** Fetches into one of the three caches, keeping old data visible while it refreshes. */
    function load<K extends 'reviews' | 'questions' | 'answers'>(
      slice: K, key: string, fetcher: () => Promise<NonNullable<ReviewSearchState[K][string]['data']>>,
    ) {
      return once(`${slice}|${key}`, async () => {
        const patch = (entry: Partial<Loadable<unknown>>) =>
          set((s) => ({ [slice]: { ...s[slice], [key]: { ...IDLE, ...s[slice][key], ...entry } } }) as Partial<ReviewSearchState>);
        patch({ loading: true, error: null });
        try { patch({ data: await fetcher(), loading: false }); } catch (e) { patch({ loading: false, error: message(e) }); }
      });
    }

    return {
      reviews: {}, questions: {}, answers: {}, recent: {},
      loadReviews(type, id, force = false) {
        const key = subjectKey(type, id);
        if (!force && get().reviews[key]?.data) return Promise.resolve();
        return load('reviews', key, () => api.listReviews(type, id));
      },
      loadQuestions(type, id) {
        const key = subjectKey(type, id);
        if (get().questions[key]?.data) return Promise.resolve();
        return load('questions', key, () => api.listQuestions(type, id));
      },
      ask(type, id, q) {
        const query = q.trim();
        if (!normalizeQuery(query)) return Promise.resolve();
        const key = answerKey(type, id, query);
        if (get().answers[key]?.data) return Promise.resolve();
        return load('answers', key, () => api.search(type, id, query));
      },
      remember(type, q) {
        const query = q.trim().replace(/\s+/g, ' ');
        if (!normalizeQuery(query)) return;
        set((s) => {
          const list = [query, ...(s.recent[type] ?? []).filter((r) => normalizeQuery(r) !== normalizeQuery(query))].slice(0, RECENT_MAX);
          return { recent: { ...s.recent, [type]: list } };
        });
      },
      forgetRecent(type, q) {
        set((s) => ({ recent: { ...s.recent, [type]: (s.recent[type] ?? []).filter((r) => r !== q) } }));
      },
    };
  }, {
    name: REVIEW_SEARCH_KEY,
    version: 1,
    storage: createJSONStorage(() => storage),
    partialize: (s) => ({ recent: s.recent }),
  }));
}

export const useReviewSearchStore = createReviewSearchStore(reviewService);
