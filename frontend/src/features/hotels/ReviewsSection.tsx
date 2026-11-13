import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowBigDown, ArrowBigUp, MessageSquare, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotelReviewStore, voteKey } from '@/store/useHotelReviewStore';
import type { Vote } from '@/store/useHotelReviewStore';
import { subjectKey, useReviewSearchStore } from '@/store/useReviewSearchStore';
import { useTravellerStore } from '@/store/useTravellerStore';
import type { HotelSummary } from '@/types/hotel';
import { AskReviews } from '@/features/reviews/AskReviews';
import { scrollToReview } from '@/features/reviews/scrollToReview';
import { fromApi, rankBest, timeAgo } from './reviewThreads';
import type { Review, ReviewComment } from './reviewThreads';
import { ratingWord } from './hotelFilters';

type SortMode = 'best' | 'top' | 'new';
const NO_REVIEWS: Review[] = [];

/**
 * Reddit-style guest reviews. TASK-X3: reviews come from the backend (PostgreSQL) with an
 * "Ask the reviews" search on top; votes, new reviews and replies stay in this browser.
 */
export function ReviewsSection({ hotel }: { hotel: HotelSummary }) {
  const me = useTravellerStore((s) => s.travellerId) ?? 'guest';
  const myName = useTravellerStore((s) => s.traveller?.name) ?? 'You';
  const votes = useHotelReviewStore((s) => s.votes);
  const added = useHotelReviewStore((s) => s.added[hotel.hotel_id]);
  const remote = useReviewSearchStore((s) => s.reviews[subjectKey('hotels', hotel.hotel_id)]);
  const loadReviews = useReviewSearchStore((s) => s.loadReviews);
  useEffect(() => { void loadReviews('hotels', hotel.hotel_id); }, [hotel.hotel_id, loadReviews]);
  const [sort, setSort] = useState<SortMode>('best');
  const base = useMemo(() => remote?.data?.reviews.map((r) => fromApi(r, hotel.hotel_id)) ?? NO_REVIEWS, [remote?.data, hotel.hotel_id]);
  const all = useMemo(() => [...(added ?? []), ...base], [added, base]);
  const scoreOf = (id: string, baseScore: number) => baseScore + (votes[voteKey(me, id)] ?? 0);
  const sorted = [...all].sort((a, b) => {
    if (sort === 'new') return b.createdAt.localeCompare(a.createdAt);
    if (sort === 'top') return scoreOf(b.id, b.baseScore) - scoreOf(a.id, a.baseScore);
    return rankBest(scoreOf(b.id, b.baseScore), b.createdAt) - rankBest(scoreOf(a.id, a.baseScore), a.createdAt);
  });
  const average = all.reduce((sum, r) => sum + r.rating, 0) / Math.max(1, all.length);

  return (
    <section id="reviews" className="card hd-section" aria-labelledby="reviews-h">
      <div className="hd-reviews-head">
        <div>
          <h2 id="reviews-h">Guest reviews</h2>
          <p className="text-muted-foreground">{all.length} reviews · average {average.toFixed(1)} · {ratingWord(average)}</p>
        </div>
        <div className="gp-chips" role="group" aria-label="Sort reviews">
          {(['best', 'top', 'new'] as const).map((m) => (
            <button key={m} type="button" className="gp-chip" aria-pressed={sort === m} onClick={() => setSort(m)}>
              {m === 'best' ? 'Best' : m === 'top' ? 'Top' : 'New'}
            </button>
          ))}
        </div>
      </div>
      <p className="hd-mock-note">Sample reviews for the demo, stored on the server. Your votes, reviews and replies are saved in this browser only.</p>
      <AskReviews type="hotels" subjectId={hotel.hotel_id} subjectName={hotel.name} onOpenReview={scrollToReview} />
      <ReviewComposer hotelId={hotel.hotel_id} author={myName} />
      {remote?.error && !remote.data ? (
        <div className="ar-state" role="alert">
          <p>Could not load the reviews. {remote.error}</p>
          <button type="button" className="ar-retry" onClick={() => void loadReviews('hotels', hotel.hotel_id, true)}><RotateCcw size={14} aria-hidden="true" />Try again</button>
        </div>
      ) : !remote?.data && !added?.length ? (
        <div role="status" aria-label="Loading reviews" style={{ display: 'grid', gap: 8 }}>
          {[0, 1, 2].map((i) => <div key={i} className="gp-skel" style={{ height: 96 }} />)}
        </div>
      ) : (
        <ol className="rd-list">
          {sorted.map((r) => <li key={r.id}><ReviewThread review={r} voter={me} author={myName} /></li>)}
        </ol>
      )}
    </section>
  );
}

function VoteColumn({ id, baseScore, voter, label, horizontal = false }: { id: string; baseScore: number; voter: string; label: string; horizontal?: boolean }) {
  const mine = useHotelReviewStore((s) => s.votes[voteKey(voter, id)]);
  const vote = useHotelReviewStore((s) => s.vote);
  const score = baseScore + (mine ?? 0);
  const press = (dir: Vote) => vote(voter, id, dir);
  return (
    <div className={`rd-votes ${horizontal ? 'is-row' : ''}`}>
      <button type="button" className={`rd-up ${mine === 1 ? 'is-on' : ''}`} aria-pressed={mine === 1} aria-label={`Upvote ${label}`} onClick={() => press(1)}>
        <ArrowBigUp size={20} aria-hidden="true" fill={mine === 1 ? 'currentColor' : 'none'} />
      </button>
      <span className={`rd-score ${mine === 1 ? 'is-up' : mine === -1 ? 'is-down' : ''}`} aria-label={`Score ${score}`}>{score}</span>
      <button type="button" className={`rd-down ${mine === -1 ? 'is-on' : ''}`} aria-pressed={mine === -1} aria-label={`Downvote ${label}`} onClick={() => press(-1)}>
        <ArrowBigDown size={20} aria-hidden="true" fill={mine === -1 ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

function ReviewThread({ review, voter, author }: { review: Review; voter: string; author: string }) {
  const local = useHotelReviewStore((s) => s.comments[review.id]);
  const [replying, setReplying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const comments = useMemo(() => [...review.comments, ...(local ?? [])], [review.comments, local]);
  const children = (parentId: string | null) => comments.filter((c) => c.parentId === parentId);

  return (
    <article id={`review-${review.id}`} className={`rd-post ${review.mine ? 'is-mine' : ''}`} aria-labelledby={`${review.id}-t`}>
      <VoteColumn id={review.id} baseScore={review.baseScore} voter={voter} label={`review “${review.title}”`} />
      <div className="rd-main">
        <p className="rd-meta">
          <span className="avatar rd-avatar" aria-hidden="true">{review.author.charAt(0)}</span>
          <strong>u/{review.author.replace(/\s+/g, '_')}</strong>
          <span>· {review.from} · {review.travelType} ·</span>
          <time dateTime={review.createdAt}>{timeAgo(review.createdAt)}</time>
          <span className="rd-rating" aria-label={`Rated ${review.rating} out of 10`}>{review.rating.toFixed(1)}</span>
        </p>
        <h3 id={`${review.id}-t`}>{review.title}</h3>
        <p className="rd-body">{review.body}</p>
        <div className="rd-actions">
          <button type="button" onClick={() => setReplying((r) => !r)} aria-expanded={replying}>
            <MessageSquare size={15} aria-hidden="true" />Reply
          </button>
          {comments.length ? (
            <button type="button" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
              {collapsed ? <Plus size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
              {comments.length} comment{comments.length === 1 ? '' : 's'}
            </button>
          ) : null}
        </div>
        {replying ? <ReplyForm reviewId={review.id} parentId={null} author={author} onDone={() => { setReplying(false); setCollapsed(false); }} /> : null}
        {!collapsed && comments.length ? (
          <CommentTree reviewId={review.id} parentId={null} childrenOf={children} voter={voter} author={author} />
        ) : null}
      </div>
    </article>
  );
}

function CommentTree({ reviewId, parentId, childrenOf, voter, author }: {
  reviewId: string; parentId: string | null; childrenOf: (id: string | null) => ReviewComment[]; voter: string; author: string;
}) {
  const items = childrenOf(parentId);
  if (!items.length) return null;
  return (
    <ul className="rd-comments">
      {items.map((c) => (
        <li key={c.id}>
          <Comment comment={c} voter={voter} author={author} reviewId={reviewId}>
            <CommentTree reviewId={reviewId} parentId={c.id} childrenOf={childrenOf} voter={voter} author={author} />
          </Comment>
        </li>
      ))}
    </ul>
  );
}

function Comment({ comment, voter, author, reviewId, children }: { comment: ReviewComment; voter: string; author: string; reviewId: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  return (
    <div className={`rd-comment ${comment.mine ? 'is-mine' : ''}`}>
      <button type="button" className="rd-thread-line" aria-label={collapsed ? `Expand ${comment.author}'s comment` : `Collapse ${comment.author}'s comment`} onClick={() => setCollapsed((c) => !c)} />
      <p className="rd-meta">
        <span className="avatar rd-avatar is-small" aria-hidden="true">{comment.author.charAt(0)}</span>
        <strong>{comment.author}</strong>
        <time dateTime={comment.createdAt}>· {timeAgo(comment.createdAt)}</time>
        {collapsed ? <span className="text-muted-foreground">(collapsed)</span> : null}
      </p>
      {!collapsed ? (
        <>
          <p className="rd-body">{comment.body}</p>
          <div className="rd-actions">
            <VoteColumn id={comment.id} baseScore={comment.baseScore} voter={voter} label={`${comment.author}'s comment`} horizontal />
            <button type="button" onClick={() => setReplying((r) => !r)} aria-expanded={replying}><MessageSquare size={14} aria-hidden="true" />Reply</button>
          </div>
          {replying ? <ReplyForm reviewId={reviewId} parentId={comment.id} author={author} onDone={() => setReplying(false)} /> : null}
          {children}
        </>
      ) : null}
    </div>
  );
}

function ReplyForm({ reviewId, parentId, author, onDone }: { reviewId: string; parentId: string | null; author: string; onDone: () => void }) {
  const addComment = useHotelReviewStore((s) => s.addComment);
  const [body, setBody] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    addComment(reviewId, parentId, author, body.trim());
    setBody('');
    onDone();
  };
  return (
    <form className="rd-reply" onSubmit={submit}>
      <label className="sr-only" htmlFor={`reply-${reviewId}-${parentId ?? 'root'}`}>Your reply</label>
      <textarea id={`reply-${reviewId}-${parentId ?? 'root'}`} className="control" rows={2} maxLength={600} value={body}
        placeholder="What are your thoughts?" onChange={(e) => setBody(e.target.value)} autoFocus />
      <div className="rd-reply-actions">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={!body.trim()}>Comment</Button>
      </div>
    </form>
  );
}

function ReviewComposer({ hotelId, author }: { hotelId: string; author: string }) {
  const addReview = useHotelReviewStore((s) => s.addReview);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ rating: 8, title: '', body: '' });
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.title.trim().length < 3) return setError('Add a short title (3+ characters).');
    if (form.body.trim().length < 10) return setError('Tell other travellers a bit more (10+ characters).');
    addReview(hotelId, { author, from: 'Your group', travelType: 'Group of friends', rating: form.rating, title: form.title.trim(), body: form.body.trim() });
    setForm({ rating: 8, title: '', body: '' });
    setError(null);
    setOpen(false);
  };
  if (!open) {
    return <button type="button" className="rd-compose-open" onClick={() => setOpen(true)}>Write a review or ask the community…</button>;
  }
  return (
    <form className="rd-compose" onSubmit={submit} noValidate>
      <div className="rd-compose-row">
        <label className="field">
          <span>Score (1–10)</span>
          <select className="control" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: Number(e.target.value) }))}>
            {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Title</span>
          <input className="control" maxLength={90} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </label>
      </div>
      <label className="field">
        <span>Your review</span>
        <textarea className="control" rows={3} maxLength={1200} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
      </label>
      {error ? <p className="gp-form-error" role="alert">{error}</p> : null}
      <div className="rd-reply-actions">
        <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
        <Button type="submit" size="sm">Post review</Button>
      </div>
    </form>
  );
}
