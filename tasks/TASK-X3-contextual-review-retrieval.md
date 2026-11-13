# TASK-X3: Ask the reviews (contextual retrieval: BM25 + vectors + rank fusion)

| Field | Value |
|---|---|
| Deliverable | Extra (user-requested, not in M1–M6). Builds on M6 hotel reviews and X1 traveller reviews. |
| Track | **B: Group / Owner** |
| Priority | P2 |
| Depends on | M6 (`/groups/:id/hotels/:hotelId` reviews), X1 (`/travellers/:id` reviews), Ollama + pgvector (local, Docker) |
| Blocks | Nothing |
| Status | **Implemented 2026-11-13**; offline Ollama index build finishing (re-run `npm run reviews:index` to resume). |

## Goal
On a hotel's **Guest reviews** and on a traveller's **profile reviews**, a person types a question
("Is it quiet at night?", "Do they split costs fairly?") and sees the most relevant review passages, scored and
ordered, with the reason each one ranked where it did.

Technique: **Contextual Retrieval**. Every review chunk gets a short LLM-written context (which hotel/person,
which review, what it is about) **before** it is indexed, then retrieval fuses a **vector** ranking (pgvector)
with a **BM25** ranking using **Reciprocal Rank Fusion (RRF)**. Nothing else (no reranker, no answer generation).

## Decisions (agreed with the user, 2026-11-13)
1. **No model at runtime** (organiser rule 5 stays intact). Ollama runs **only** in an offline indexing script.
   The running app never calls Ollama or any model.
   - Contextualization: an Ollama chat model (default `gemma3:4b`, `OLLAMA_CONTEXT_MODEL`).
   - Embeddings: Ollama `nomic-embed-text` (768-d, `search_document:` / `search_query:` prefixes), offline only.
   - Query vector at runtime, without a model:
     - **Suggested question** (exact, normalized match) → its embedding precomputed offline → true dense retrieval.
     - **Free-text question** → pseudo-relevance feedback: the mean of the stored embeddings of the top-3 BM25
       chunks (pgvector `avg(vector)`), then vector search with that.
     - No BM25 hit → vector side is skipped (BM25-only, says so in the response `mode`).
2. **Corpus**: the hotel guest reviews and the traveller profile reviews move from browser mocks into Postgres
   (app tables, deterministic seed file committed in `backend/data/reviews/`). Votes and replies stay browser-local.
3. **Stack**: Postgres image switches to `pgvector/pgvector:pg16` (same data volume) for `vector(768)` + HNSW.
   **BM25** (k1 = 1.2, b = 0.75) is computed exactly in code over the contextualized text.
4. The offline output (contexts + embeddings) is committed as `backend/data/reviews/index.json` and loaded by a
   seed migration, so teammates and judges get the full index **without** Ollama. Rows not indexed yet fall back
   to a template context and BM25 only.

## Backend (router → controller → service → helpers)
- Migrations: `…11_create_reviews` (extension `vector`, tables below, HNSW index) and `…12_seed_reviews`
  (loads `corpus.json`, plus `index.json` when present).
  - `reviews`: review_id PK, subject_type `HOTEL|TRAVELLER`, subject_id, author, author_from, travel_type,
    rating (hotel 1–10, traveller 1–5), title, body, base_score, comments jsonb, created_at.
  - `review_chunks`: chunk_id PK, review_id FK, subject_type, subject_id, position, content, context,
    context_model, embedding `vector(768)`, embed_model, indexed_at.
  - `review_questions`: question_id PK, subject_type, text, embedding `vector(768)`.
- Helpers (data access only):
  - `helpers/postgres/reviews.helper.js`: reviews, chunks, questions, counts.
  - `helpers/vector/reviewVectors.helper.js`: pgvector cosine search, centroid of chunk embeddings.
  - `helpers/bm25/reviewBm25.helper.js`: in-memory BM25 index per subject type (built from chunk rows, rebuilt
    when the index version changes).
- Pure utils: `utils/text.js` (tokenize, stopwords, light stemming, sentence chunking),
  `utils/bm25.js`, `utils/rankFusion.js` (RRF, k = 60).
- Service `reviews.service.ts`: validation, subject checks, query-vector choice, fusion, result shape.
- Endpoints (public; reviews are public like the group page):

| Method | Path | Result |
|---|---|---|
| GET | `/api/reviews/:subjectType/:subjectId` | `hotels`/`travellers`; reviews newest first + rating summary. 404 unknown subject |
| GET | `/api/reviews/:subjectType/:subjectId/questions` | Suggested questions + index status (chunks, contextualized, embedded, models) |
| GET | `/api/reviews/:subjectType/:subjectId/search?q=&limit=` | Ranked chunks: `rank`, fused `score`, `bm25 {rank, score}`, `vector {rank, similarity}`, `matched_terms`, chunk text, its context, review summary, `mode`, `took_ms`. 400 for an empty/too long `q` |

- Offline: `npm run reviews:corpus` (writes `corpus.json`), `npm run reviews:index` (Ollama; resumable, writes
  `index.json` and updates the DB).
- `GET /api/groups/:id/hotels` adds `review_count` per hotel (from Postgres).

## Frontend
- Hotel **Guest reviews** and traveller **profile** read reviews from the API (votes/replies stay local).
- **Ask the reviews** box (Booking look: yellow-framed search, suggested-question chips, recent questions):
  debounced as you type, cached per subject + question in a Zustand store, stale answers never flash.
- Each result: rank, relevance bar, highlighted matched terms, the review it came from (author, rating,
  date), "Why this result" (BM25 #n · Vector #n · fused score), and the indexing context on demand.
- Mode badge: "Hybrid · suggested question", "Hybrid · feedback vector", or "Keyword only".
- Keyboard and screen-reader friendly; empty, error and "not indexed yet" states are recoverable.

## Acceptance criteria
- [x] The running app makes no model/Ollama calls; search works with Ollama stopped.
- [x] BM25 scores match the formula (unit tests with hand-computed values); RRF matches `Σ 1/(60 + rank)`.
- [x] A suggested question uses its precomputed embedding (`mode = HYBRID_QUESTION`); free text with keyword hits
      uses the feedback vector (`HYBRID_FEEDBACK`); no hits → `BM25_ONLY` with no results, not an error.
- [x] Results are scoped to the one hotel/traveller and ordered by fused score; ties are stable.
- [ ] (ticks when the index finishes) Reviews, chunks, contexts and embeddings survive a backend restart (Postgres); fresh clone gets them from
      the committed seed files without Ollama.
- [x] 400 for an empty or > 200-character question; 404 for an unknown hotel/traveller.
- [x] Unit tests (text, BM25, RRF, service), integration tests through the API, Playwright journey.
