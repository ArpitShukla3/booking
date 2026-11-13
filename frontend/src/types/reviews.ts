/** TASK-X3: reviews served by the backend + "Ask the reviews" retrieval results. */
export type ReviewSubjectPath = 'hotels' | 'travellers';
export type SearchMode = 'HYBRID_QUESTION' | 'HYBRID_FEEDBACK' | 'BM25_ONLY';

export interface ReviewSubject { type: 'HOTEL' | 'TRAVELLER'; id: string; name: string }

export interface ApiReviewComment { id: string; parentId: string | null; author: string; body: string; createdAt: string; baseScore: number }

export interface ApiReview {
  review_id: string; author: string; author_from: string; rating: number; rating_scale: number; title: string | null;
  body: string; base_score: number; created_at: string;
  travel_type: string | null; comments: ApiReviewComment[];
  trip: { city: string; month: string } | null; votes: { up: number; down: number } | null;
}

export interface ReviewList { subject: ReviewSubject; summary: { count: number; average: number | null; scale: number }; reviews: ApiReview[] }

export interface IndexStatus { chunks: number; contextualized: number; embedded: number; context_model: string | null; embed_model: string | null }

export interface QuestionList { subject: ReviewSubject; questions: { question_id: string; text: string }[]; index: IndexStatus }

export interface SearchResult {
  rank: number; chunk_id: string; score: number; relevance: number;
  content: string; context: string; contextualized: boolean; matched_terms: string[];
  bm25: { rank: number; score: number } | null;
  vector: { rank: number; similarity: number } | null;
  review: {
    review_id: string; author: string; author_from: string; rating: number; rating_scale: number; title: string | null;
    created_at: string; travel_type: string | null; trip: { city: string; month: string } | null;
  };
}

export interface SearchResponse {
  subject: ReviewSubject; query: string; mode: SearchMode; terms: string[];
  question_id: string | null; took_ms: number; results: SearchResult[];
}
