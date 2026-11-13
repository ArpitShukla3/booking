import { useEffect, useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ChevronDown, Clock, Info, Loader2, MessageCircleQuestion, RotateCcw, Search, X } from 'lucide-react';
import { answerKey, normalizeQuery, subjectKey, useReviewSearchStore } from '@/store/useReviewSearchStore';
import type { ReviewSubjectPath, SearchMode, SearchResponse, SearchResult } from '@/types/reviews';
import { stagger } from '@/features/groups/media';
import './askReviews.css';

/**
 * TASK-X3 "Ask the reviews". Type a question; the backend ranks review passages with BM25 and
 * pgvector, fused by Reciprocal Rank Fusion. Answers are cached per subject + question, typing is
 * debounced, and the previous answer stays on screen (dimmed) until the new one arrives.
 */
export const ASK_DEBOUNCE_MS = 300;
const MIN_QUERY = 3;

const MODE_LABEL: Record<SearchMode, { label: string; hint: string }> = {
  HYBRID_QUESTION: { label: 'Keywords + meaning', hint: 'Suggested question: matched by keywords and by meaning (its vector was prepared offline).' },
  HYBRID_FEEDBACK: { label: 'Keywords + similar passages', hint: 'Matched by keywords, then widened to passages close in meaning to the best keyword matches.' },
  BM25_ONLY: { label: 'Keyword match', hint: 'Matched by keywords only.' },
};

export function AskReviews({ type, subjectId, subjectName, onOpenReview }: {
  type: ReviewSubjectPath; subjectId: string; subjectName: string;
  /** Scrolls to the full review in the list below. */
  onOpenReview?: (reviewId: string) => void;
}) {
  const inputId = useId();
  const questions = useReviewSearchStore((s) => s.questions[subjectKey(type, subjectId)]);
  const recent = useReviewSearchStore((s) => s.recent[type]);
  const loadQuestions = useReviewSearchStore((s) => s.loadQuestions);
  const ask = useReviewSearchStore((s) => s.ask);
  const remember = useReviewSearchStore((s) => s.remember);
  const forgetRecent = useReviewSearchStore((s) => s.forgetRecent);

  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const key = answerKey(type, subjectId, query);
  const current = useReviewSearchStore((s) => (query ? s.answers[key] : undefined));
  // Keep showing the last answer while the next one loads (never flash an empty state).
  const [shownKey, setShownKey] = useState<string | null>(null);
  if (current?.data && shownKey !== key) setShownKey(key);
  if (!query && shownKey) setShownKey(null);
  const shown = useReviewSearchStore((s) => (shownKey ? s.answers[shownKey]?.data : undefined));

  useEffect(() => { void loadQuestions(type, subjectId); }, [type, subjectId, loadQuestions]);

  // Debounced search while typing.
  useEffect(() => {
    const text = input.trim();
    const timer = window.setTimeout(() => setQuery(normalizeQuery(text).length >= MIN_QUERY ? text : ''), ASK_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input]);
  useEffect(() => { if (query) void ask(type, subjectId, query); }, [type, subjectId, query, ask]);

  function run(text: string) {
    const q = text.trim();
    setInput(q);
    if (normalizeQuery(q).length < 1) return;
    setQuery(q);
    remember(type, q);
  }
  const submit = (e: FormEvent) => { e.preventDefault(); run(input); };
  const clear = () => { setInput(''); setQuery(''); };

  const pending = Boolean(query) && (current?.loading || !current);
  const error = query && current?.error && !current.loading ? current.error : null;
  const stale = Boolean(shown) && shownKey !== key;
  const index = questions?.data?.index;
  const recentList = (recent ?? []).filter((r) => normalizeQuery(r) !== normalizeQuery(query)).slice(0, 3);

  return (
    <section className="ar" aria-labelledby={`${inputId}-h`}>
      <div className="ar-head">
        <h3 id={`${inputId}-h`}><MessageCircleQuestion size={18} aria-hidden="true" />Ask the reviews</h3>
        <p>Find what people said about <strong>{subjectName}</strong>. The most relevant passages come first.</p>
      </div>

      <form className="ar-box" role="search" onSubmit={submit}>
        <label htmlFor={inputId} className="sr-only">Ask a question about the reviews of {subjectName}</label>
        <Search size={18} className="ar-box-icon" aria-hidden="true" />
        <input
          id={inputId} className="ar-input" type="search" autoComplete="off" maxLength={200} value={input}
          placeholder={type === 'hotels' ? 'e.g. Is it quiet at night?' : 'e.g. Do they split costs fairly?'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape' && input) { e.preventDefault(); clear(); } }}
        />
        {input ? (
          <button type="button" className="ar-clear" aria-label="Clear question" onClick={clear}><X size={16} aria-hidden="true" /></button>
        ) : null}
        <button type="submit" className="ar-go">
          {pending ? <Loader2 size={16} className="ar-spin" aria-hidden="true" /> : null}Ask
        </button>
      </form>

      <div className="ar-chips" role="group" aria-label="Suggested questions">
        {questions?.data?.questions.map((q) => (
          <button key={q.question_id} type="button" className="ar-chip" aria-pressed={normalizeQuery(q.text) === normalizeQuery(query)} onClick={() => run(q.text)}>
            {q.text}
          </button>
        )) ?? (questions?.error ? null : Array.from({ length: 4 }, (_, i) => <span key={i} className="ar-chip is-skel" aria-hidden="true" />))}
      </div>
      {recentList.length ? (
        <div className="ar-recent" role="group" aria-label="Recent questions">
          <Clock size={13} aria-hidden="true" />
          {recentList.map((r) => (
            <span key={r} className="ar-recent-item">
              <button type="button" onClick={() => run(r)}>{r}</button>
              <button type="button" className="ar-recent-x" aria-label={`Remove “${r}” from recent questions`} onClick={() => forgetRecent(type, r)}><X size={11} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      ) : null}
      {index && index.chunks > 0 && index.embedded < index.chunks ? (
        <p className="ar-note"><Info size={13} aria-hidden="true" />Meaning search is still being prepared for some of these reviews; keyword search covers all of them.</p>
      ) : null}

      <div className="ar-results-wrap" aria-busy={pending}>
        <p className="sr-only" aria-live="polite">
          {query && current?.data ? `${current.data.results.length} passages found for ${current.data.query}` : ''}
        </p>
        {error ? (
          <div className="ar-state" role="alert">
            <p>{error}</p>
            <button type="button" className="ar-retry" onClick={() => void ask(type, subjectId, query)}><RotateCcw size={14} aria-hidden="true" />Try again</button>
          </div>
        ) : shown && query ? (
          <Answer answer={shown} stale={stale} onOpenReview={onOpenReview} onAsk={run} suggestions={questions?.data?.questions.map((q) => q.text) ?? []} />
        ) : pending ? (
          <div className="ar-list" role="status" aria-label="Searching reviews">
            {[0, 1, 2].map((i) => <div key={i} className="ar-skel" />)}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Answer({ answer, stale, onOpenReview, onAsk, suggestions }: {
  answer: SearchResponse; stale: boolean; onOpenReview?: (id: string) => void; onAsk: (q: string) => void; suggestions: string[];
}) {
  const mode = MODE_LABEL[answer.mode];
  if (!answer.results.length) {
    return (
      <div className={`ar-state ${stale ? 'is-stale' : ''}`}>
        <p><strong>No review mentions “{answer.query}”.</strong> Try other words, or one of these:</p>
        <div className="ar-chips">
          {suggestions.slice(0, 3).map((s) => <button key={s} type="button" className="ar-chip" onClick={() => onAsk(s)}>{s}</button>)}
        </div>
      </div>
    );
  }
  return (
    <div className={`ar-answer ${stale ? 'is-stale' : ''}`}>
      <div className="ar-summary">
        <span><strong>{answer.results.length}</strong> passage{answer.results.length === 1 ? '' : 's'} for “{answer.query}”</span>
        <span className={`ar-mode is-${answer.mode.toLowerCase()}`} title={mode.hint}>{mode.label}</span>
        <span className="ar-took">{answer.took_ms} ms</span>
      </div>
      <ol className="ar-list" key={answer.query}>
        {answer.results.map((r, i) => <ResultCard key={r.chunk_id} result={r} index={i} onOpenReview={onOpenReview} />)}
      </ol>
    </div>
  );
}

function ResultCard({ result, index, onOpenReview }: { result: SearchResult; index: number; onOpenReview?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const { review } = result;
  const pct = Math.max(6, Math.round(result.relevance * 100));
  return (
    <li className="ar-item gp-rise" style={stagger(index)}>
      <span className="ar-rank" aria-label={`Rank ${result.rank}`}>{result.rank}</span>
      <div className="ar-item-body">
        <blockquote className="ar-quote">“<Highlighted text={result.content} words={result.matched_terms} />”</blockquote>
        <p className="ar-meta">
          <span className={`ar-score ${review.rating_scale === 5 ? 'is-stars' : ''}`} aria-label={`Rated ${review.rating} out of ${review.rating_scale}`}>
            {review.rating_scale === 10 ? review.rating.toFixed(1) : `${review.rating}★`}
          </span>
          <span><strong>{review.author}</strong> · {review.author_from}{review.travel_type ? ` · ${review.travel_type}` : ''}{review.trip ? ` · Trip to ${review.trip.city}, ${review.trip.month}` : ''}</span>
          {review.title ? <span className="ar-title">“{review.title}”</span> : null}
        </p>
        <div className="ar-why">
          <span className="ar-bar" role="img" aria-label={`Relevance ${pct}%`}><span style={{ width: `${pct}%` }} /></span>
          <Why label="Keywords" value={result.bm25 ? `#${result.bm25.rank} · ${result.bm25.score.toFixed(2)}` : null} title="BM25 rank and score over the passage and its context" />
          <Why label="Meaning" value={result.vector ? `#${result.vector.rank} · ${result.vector.similarity.toFixed(2)}` : null} title="Vector rank and cosine similarity" />
          <Why label="Fused" value={result.score.toFixed(4)} title="Reciprocal Rank Fusion: Σ 1 / (60 + rank)" />
        </div>
        <div className="ar-actions">
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <ChevronDown size={14} className={open ? 'is-open' : ''} aria-hidden="true" />{open ? 'Hide' : 'Show'} search context
          </button>
          {onOpenReview ? <button type="button" onClick={() => onOpenReview(review.review_id)}>Read full review</button> : null}
        </div>
        {open ? (
          <p className="ar-context">
            <Highlighted text={result.context} words={result.matched_terms} />
            <small>{result.contextualized ? ' Written offline by a local model when the reviews were indexed.' : ' Template context (not yet indexed by the model).'}</small>
          </p>
        ) : null}
      </div>
    </li>
  );
}

function Why({ label, value, title }: { label: string; value: string | null; title: string }) {
  return <span className={`ar-why-chip ${value ? '' : 'is-off'}`} title={title}>{label} {value ?? '—'}</span>;
}

/** Wraps the matched words (whole words, any case) in <mark>. */
export function Highlighted({ text, words }: { text: string; words: string[] }): ReactNode {
  if (!words.length) return text;
  const escaped = [...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  const parts = text.split(pattern);
  return parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}
