/** Traveller reputation (reviews, ratings, Reddit-style votes). DEMO ONLY: served by a mock adapter. */
export type VoteDirection = 'UP' | 'DOWN';
export type MyVote = VoteDirection | null;

export interface VoteTally { up: number; down: number; my_vote: MyVote }

export interface TravellerReview {
  review_id: string;
  author: { name: string; home_city: string };
  trip: { city: string; month: string };
  rating: number; // 1–5
  text: string;
  created_at: string; // YYYY-MM-DD
  votes: VoteTally;
}

export interface TravellerReputation {
  traveller_id: string;
  rating_average: number; // one decimal
  rating_count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  trips_completed: number;
  profile_votes: VoteTally;
  reviews: TravellerReview[];
}
