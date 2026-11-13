import type { ApiReview } from '@/types/reviews';

/**
 * Guest review threads. TASK-X3: the reviews (sample content) now come from PostgreSQL via
 * GET /api/reviews/hotels/:id; votes, new posts and replies still live in useHotelReviewStore
 * (this browser only).
 */
export interface ReviewComment {
  id: string;
  parentId: string | null;
  author: string;
  body: string;
  createdAt: string;
  baseScore: number;
  mine?: boolean;
}

export interface Review {
  id: string;
  hotelId: string;
  author: string;
  from: string;
  travelType: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  baseScore: number;
  comments: ReviewComment[];
  mine?: boolean;
}

/** TASK-X3: a review from GET /api/reviews/hotels/:id as a thread for this UI. */
export function fromApi(review: ApiReview, hotelId: string): Review {
  return {
    id: review.review_id, hotelId, author: review.author, from: review.author_from, travelType: review.travel_type ?? 'Guest',
    rating: review.rating, title: review.title ?? '', body: review.body, createdAt: review.created_at, baseScore: review.base_score,
    comments: review.comments,
  };
}

const DAY = 86_400_000;

/** "3 months ago" style, like Reddit. */
export function timeAgo(iso: string, now = Date.now()): string {
  const secs = Math.max(1, Math.round((now - new Date(iso).getTime()) / 1000));
  const units: [number, string][] = [[31_536_000, 'year'], [2_592_000, 'month'], [604_800, 'week'], [86_400, 'day'], [3_600, 'hour'], [60, 'minute']];
  for (const [size, name] of units) {
    const n = Math.floor(secs / size);
    if (n >= 1) return `${n} ${name}${n === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

/** Reddit-style "Best": Wilson-ish blend of score and recency. */
export function rankBest(score: number, createdAt: string, now = Date.now()) {
  const ageDays = (now - new Date(createdAt).getTime()) / DAY;
  return score / Math.pow(ageDays + 2, 0.6);
}
