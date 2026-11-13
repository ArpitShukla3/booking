import { reputationMock } from '@/services/mock/reputationMock';
import { reviewService } from '@/services/reviewService';
import type { ReviewApi } from '@/services/reviewService';
import type { ApiReview } from '@/types/reviews';
import type { TravellerReputation, TravellerReview, VoteDirection, VoteTally } from '@/types/reputation';

/**
 * Traveller reviews, ratings and votes. Components call this service only.
 * TASK-X3: the reviews themselves (sample content) come from PostgreSQL via
 * GET /api/reviews/travellers/:id; profile votes, trip count and every vote are still DEMO data
 * from the mock adapter (votes saved in this browser).
 */
export interface ReputationApi {
  getReputation(travellerId: string, viewerId: string | null): Promise<TravellerReputation>;
  vote(targetId: string, viewerId: string | null, current: VoteTally, direction: VoteDirection): Promise<VoteTally>;
}

/** API review → profile review, keeping the viewer's stored vote from the mock (same review IDs). */
export function toTravellerReview(review: ApiReview, stored?: TravellerReview): TravellerReview {
  return {
    review_id: review.review_id,
    author: { name: review.author, home_city: review.author_from },
    trip: review.trip ?? { city: '—', month: '' },
    rating: review.rating,
    text: review.body,
    created_at: review.created_at,
    votes: stored?.votes ?? { up: review.votes?.up ?? 0, down: review.votes?.down ?? 0, my_vote: null },
  };
}

/** Rating summary from the reviews actually shown. */
export function summarise(reviews: TravellerReview[]): Pick<TravellerReputation, 'rating_average' | 'rating_count' | 'distribution'> {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as TravellerReputation['distribution'];
  for (const r of reviews) distribution[Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5] += 1;
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  return { rating_average: Math.round(average * 10) / 10, rating_count: reviews.length, distribution };
}

export function createReputationService(api: Pick<ReviewApi, 'listReviews'>): ReputationApi {
  return {
    async getReputation(travellerId, viewerId) {
      const [sample, list] = await Promise.all([reputationMock.getReputation(travellerId, viewerId), api.listReviews('travellers', travellerId)]);
      const byId = new Map(sample.reviews.map((r) => [r.review_id, r]));
      const reviews = list.reviews.map((r) => toTravellerReview(r, byId.get(r.review_id)));
      return { ...sample, ...summarise(reviews), reviews };
    },
    vote: reputationMock.vote,
  };
}

export const reputationService: ReputationApi = createReputationService(reviewService);
