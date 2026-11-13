/** TASK-X3: reviews + "Ask the reviews" contextual retrieval. */
export type SubjectType = 'HOTEL' | 'TRAVELLER';
export type SearchMode = 'HYBRID_QUESTION' | 'HYBRID_FEEDBACK' | 'BM25_ONLY';

export interface Subject { type: SubjectType; id: string; name: string }

export interface ReviewComment { id: string; parentId: string | null; author: string; body: string; createdAt: string; baseScore: number }

export interface ReviewRow {
  review_id: string; subject_type: SubjectType; subject_id: string; author: string; author_from: string;
  rating: string | number; rating_scale: number; title: string | null; body: string; base_score: number; created_at: string;
  meta: { travel_type?: string; comments?: ReviewComment[]; trip?: { city: string; month: string }; votes?: { up: number; down: number } };
}

export interface Review {
  review_id: string; author: string; author_from: string; rating: number; rating_scale: number; title: string | null;
  body: string; base_score: number; created_at: string;
  travel_type: string | null; comments: ReviewComment[]; trip: { city: string; month: string } | null; votes: { up: number; down: number } | null;
}

export interface ReviewList { subject: Subject; summary: { count: number; average: number | null; scale: number }; reviews: Review[] }

export interface QuestionRow { question_id: string; text: string; has_embedding: boolean }

export interface IndexStatus { chunks: number; contextualized: number; embedded: number; context_model: string | null; embed_model: string | null }

export interface QuestionList { subject: Subject; questions: { question_id: string; text: string }[]; index: IndexStatus }

export interface ChunkRow {
  chunk_id: string; review_id: string; content: string; context: string; context_model: string | null; has_embedding: boolean;
  author: string; author_from: string; rating: string | number; rating_scale: number; title: string | null; created_at: string;
  meta: ReviewRow['meta'];
}

export interface Ranked { id: string; score?: number; similarity?: number }

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
  subject: Subject; query: string; mode: SearchMode; terms: string[];
  question_id: string | null; took_ms: number; results: SearchResult[];
}
