import reviewsHelper = require('../helpers/postgres/reviews.helper');
import groupHotelsHelper = require('../helpers/postgres/groupHotels.helper');
import travellersHelper = require('../helpers/postgres/travellers.helper');
import vectorsHelper = require('../helpers/vector/reviewVectors.helper');
import bm25Helper = require('../helpers/bm25/reviewBm25.helper');
import text = require('../utils/text');
import rankFusion = require('../utils/rankFusion');
import HttpError = require('../utils/HttpError');
import type {
  ChunkRow, IndexStatus, QuestionList, QuestionRow, Ranked, Review, ReviewList, ReviewRow, SearchMode, SearchResponse, SearchResult, Subject, SubjectType,
} from '../types/reviews.ts';

/**
 * TASK-X3 "Ask the reviews": contextual retrieval over hotel and traveller reviews.
 * BM25 (keywords over "LLM context + chunk") and pgvector (cosine) rankings are fused with RRF.
 * No model runs here: the query vector is a suggested question's precomputed embedding or the
 * mean embedding of the top BM25 chunks (pseudo-relevance feedback).
 */

const MAX_QUERY = 200;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const CANDIDATES = 20; // per ranking, before fusion
const FEEDBACK_DOCS = 3; // top BM25 chunks whose mean embedding is the free-text query vector
/**
 * Vector hits are kept only if they clear an absolute floor AND sit within MARGIN of the best hit.
 * Calibrated on the nomic-embed-text index: question→chunk is ~0.65–0.72 when relevant and ~0.45–0.59
 * otherwise; chunk centroid→chunk runs high for every chunk of one hotel (shared context), so it is stricter.
 */
const MIN_SIMILARITY = { HYBRID_QUESTION: 0.6, HYBRID_FEEDBACK: 0.85 } as const;
const MARGIN = 0.1;
const VECTOR_K = 6;

/* ---------- pure rules (no I/O) ---------- */

function parseSubjectType(value: unknown): SubjectType {
  if (value === 'hotels') return 'HOTEL';
  if (value === 'travellers') return 'TRAVELLER';
  throw HttpError.notFound('Reviews exist for hotels and travellers only');
}

function normalizeQuestion(q: string): string {
  return text.words(q).join(' ');
}

/** A suggested question that matches exactly (ignoring case/punctuation) and has an embedding. */
function matchQuestion(questions: QuestionRow[], q: string): QuestionRow | undefined {
  const wanted = normalizeQuestion(q);
  return questions.find((question) => question.has_embedding && normalizeQuestion(question.text) === wanted);
}

/** Drops weak vector hits (see MIN_SIMILARITY); keeps the order. */
function filterVector(hits: Ranked[], mode: Exclude<SearchMode, 'BM25_ONLY'>): Ranked[] {
  if (!hits.length) return hits;
  const best = Math.max(...hits.map((h) => Number(h.similarity)));
  const cut = Math.max(MIN_SIMILARITY[mode], best - MARGIN);
  return hits.filter((h) => Number(h.similarity) >= cut);
}

/** Fused score as a share of the best possible (rank 1 in both rankings). */
function relevance(score: number): number {
  return Math.round((score / (2 / (rankFusion.RRF_K + 1))) * 1000) / 1000;
}

function parseQuery(input: { q?: unknown; limit?: unknown }): { q: string; limit: number } {
  const q = typeof input.q === 'string' ? input.q.trim().replace(/\s+/g, ' ') : '';
  if (!q) throw HttpError.badRequest('Ask a question about the reviews', { q: 'Required' });
  if (q.length > MAX_QUERY) throw HttpError.badRequest('Question is too long', { q: `At most ${MAX_QUERY} characters` });
  let limit = DEFAULT_LIMIT;
  if (input.limit !== undefined) {
    limit = Number(input.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw HttpError.badRequest('Invalid limit', { limit: `1 to ${MAX_LIMIT}` });
  }
  return { q, limit };
}

const num = (v: string | number) => Number(v);

function toReview(row: ReviewRow): Review {
  return {
    review_id: row.review_id, author: row.author, author_from: row.author_from, rating: num(row.rating), rating_scale: row.rating_scale,
    title: row.title, body: row.body, base_score: row.base_score, created_at: row.created_at,
    travel_type: row.meta.travel_type ?? null, comments: row.meta.comments ?? [], trip: row.meta.trip ?? null, votes: row.meta.votes ?? null,
  };
}

function toResult(row: ChunkRow, rank: number, score: number, ranks: (number | null)[], bm25: Ranked[], vector: Ranked[], terms: string[]): SearchResult {
  const [bm25Rank, vectorRank] = ranks;
  return {
    rank, chunk_id: row.chunk_id, score, relevance: relevance(score),
    content: row.content, context: row.context, contextualized: Boolean(row.context_model),
    matched_terms: text.matchedWords(`${row.content} ${row.context}`, terms),
    bm25: bm25Rank ? { rank: bm25Rank, score: Number(bm25[bm25Rank - 1].score) } : null,
    vector: vectorRank ? { rank: vectorRank, similarity: Math.round(Number(vector[vectorRank - 1].similarity) * 1000) / 1000 } : null,
    review: {
      review_id: row.review_id, author: row.author, author_from: row.author_from, rating: num(row.rating), rating_scale: row.rating_scale,
      title: row.title, created_at: row.created_at, travel_type: row.meta.travel_type ?? null, trip: row.meta.trip ?? null,
    },
  };
}

/* ---------- subject ---------- */

async function findSubject(typeParam: unknown, subjectId: string): Promise<Subject> {
  const type = parseSubjectType(typeParam);
  const row = type === 'HOTEL' ? await groupHotelsHelper.findHotel(subjectId) : await travellersHelper.findById(subjectId);
  if (!row) throw HttpError.notFound(type === 'HOTEL' ? 'Hotel not found' : 'Traveller not found');
  return { type, id: subjectId, name: row.name };
}

/* ---------- use cases ---------- */

async function listReviews(typeParam: unknown, subjectId: string): Promise<ReviewList> {
  const subject = await findSubject(typeParam, subjectId);
  const rows: ReviewRow[] = await reviewsHelper.listReviews(subject.type, subject.id);
  const reviews = rows.map(toReview).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.review_id.localeCompare(b.review_id));
  const scale = subject.type === 'HOTEL' ? 10 : 5;
  const average = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null;
  return { subject, summary: { count: reviews.length, average, scale }, reviews };
}

async function listQuestions(typeParam: unknown, subjectId: string): Promise<QuestionList> {
  const subject = await findSubject(typeParam, subjectId);
  const [questions, index] = await Promise.all([
    reviewsHelper.listQuestions(subject.type) as Promise<QuestionRow[]>,
    reviewsHelper.indexStatus(subject.type, subject.id) as Promise<IndexStatus>,
  ]);
  return { subject, questions: questions.map((q) => ({ question_id: q.question_id, text: q.text })), index };
}

async function search(typeParam: unknown, subjectId: string, input: { q?: unknown; limit?: unknown }): Promise<SearchResponse> {
  const started = performance.now();
  const type = parseSubjectType(typeParam);
  const { q, limit } = parseQuery(input);
  const subject = await findSubject(typeParam, subjectId);
  const terms = [...new Set(text.tokenize(q))];

  const [bm25, questions]: [Ranked[], QuestionRow[]] = await Promise.all([
    bm25Helper.search(type, subject.id, terms, CANDIDATES),
    reviewsHelper.listQuestions(type),
  ]);
  const question = matchQuestion(questions, q);

  let mode: SearchMode = 'BM25_ONLY';
  let vector: Ranked[] = [];
  if (question) {
    mode = 'HYBRID_QUESTION';
    vector = await vectorsHelper.nearestToQuestion(question.question_id, type, subject.id, VECTOR_K);
  } else if (bm25.length) {
    mode = 'HYBRID_FEEDBACK';
    vector = await vectorsHelper.nearestToCentroid(bm25.slice(0, FEEDBACK_DOCS).map((r) => r.id), type, subject.id, VECTOR_K);
  }
  if (mode !== 'BM25_ONLY') vector = filterVector(vector, mode);

  const fused = rankFusion.reciprocalRankFusion([bm25.map((r) => r.id), vector.map((r) => r.id)]).slice(0, limit);
  const rows: ChunkRow[] = await reviewsHelper.findChunks(fused.map((f) => f.id));
  const byId = new Map(rows.map((r) => [r.chunk_id, r]));
  const results = fused.flatMap((f, i) => {
    const row = byId.get(f.id);
    return row ? [toResult(row, i + 1, f.score, f.ranks, bm25, vector, terms)] : [];
  });
  return {
    subject, query: q, mode, terms, question_id: question?.question_id ?? null,
    took_ms: Math.round((performance.now() - started) * 10) / 10, results,
  };
}

/** TASK-X3: review counts for many hotels (hotel search cards). */
function countHotelReviews(hotelIds: string[]): Promise<Record<string, number>> {
  return reviewsHelper.countBySubjects('HOTEL', hotelIds);
}

const reviewsService = { parseSubjectType, normalizeQuestion, matchQuestion, filterVector, relevance, listReviews, listQuestions, search, countHotelReviews, MIN_SIMILARITY };
export = reviewsService;
