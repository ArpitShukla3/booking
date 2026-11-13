import { apiClient } from '@/lib/api';
import type { QuestionList, ReviewList, ReviewSubjectPath, SearchResponse } from '@/types/reviews';

/** TASK-X3: public reviews API (no model runs on the server; see tasks/TASK-X3). */
export interface ReviewApi {
  listReviews(type: ReviewSubjectPath, id: string): Promise<ReviewList>;
  listQuestions(type: ReviewSubjectPath, id: string): Promise<QuestionList>;
  search(type: ReviewSubjectPath, id: string, q: string, limit?: number): Promise<SearchResponse>;
}

const base = (type: ReviewSubjectPath, id: string) => `/api/reviews/${type}/${encodeURIComponent(id)}`;

export const reviewService: ReviewApi = {
  async listReviews(type, id) { return (await apiClient.get<ReviewList>(base(type, id))).data; },
  async listQuestions(type, id) { return (await apiClient.get<QuestionList>(`${base(type, id)}/questions`)).data; },
  async search(type, id, q, limit = 5) {
    return (await apiClient.get<SearchResponse>(`${base(type, id)}/search`, { params: { q, limit } })).data;
  },
};
