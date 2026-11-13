import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowBigDown, ArrowBigUp, ArrowLeft, ChevronRight, FlaskConical, MapPin, MessageSquareText, Plane, ShieldCheck, Star, Trophy } from 'lucide-react';
import { Select } from '@/components/ui/input';
import { EmptyState, ErrorState, InterestTags, PageContainer } from '@/components/shared/common';
import { ApiError } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { compactScore, sortReviews, voteScore } from '@/services/mock/reputationMock';
import type { ReviewSort } from '@/services/mock/reputationMock';
import { reputationService } from '@/services/reputationService';
import { travellerService } from '@/services/travellerService';
import { useTravellerStore } from '@/store/useTravellerStore';
import type { TravellerReputation, TravellerReview, VoteDirection, VoteTally } from '@/types/reputation';
import type { Traveller } from '@/types/traveller';
import { stagger } from '@/features/groups/media';
import { AskReviews } from '@/features/reviews/AskReviews';
import { scrollToReview } from '@/features/reviews/scrollToReview';
import '@/features/groups/groups.css';
import './profile.css';

/** Where the visitor came from, e.g. the owner's join-request list. */
export interface ProfileLinkState { from?: string; fromLabel?: string }

/* ---------- small building blocks ---------- */

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="pf-stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="pf-star" style={{ width: size, height: size }}>
            <Star size={size} className="pf-star-bg" aria-hidden="true" />
            <span className="pf-star-fill" style={{ width: `${fill * 100}%` }}><Star size={size} aria-hidden="true" /></span>
          </span>
        );
      })}
    </span>
  );
}

/** Reddit-style ▲ score ▼. Clicking the active arrow again removes the vote. */
function VoteControl({ tally, onVote, label, vertical = true }: {
  tally: VoteTally; onVote: (d: VoteDirection) => void; label: string; vertical?: boolean;
}) {
  const score = voteScore(tally);
  return (
    <div className={`pf-vote ${vertical ? 'is-vertical' : ''} ${tally.my_vote ? `is-${tally.my_vote.toLowerCase()}` : ''}`} role="group" aria-label={`Votes for ${label}`}>
      <button type="button" className="pf-vote-btn pf-vote-up" aria-pressed={tally.my_vote === 'UP'} aria-label={`Upvote ${label}`} onClick={() => onVote('UP')}>
        <ArrowBigUp size={22} aria-hidden="true" />
      </button>
      <span className="pf-vote-score" aria-live="polite" title={`${tally.up} upvotes · ${tally.down} downvotes`}>
        {compactScore(score)}<span className="sr-only"> points</span>
      </span>
      <button type="button" className="pf-vote-btn pf-vote-down" aria-pressed={tally.my_vote === 'DOWN'} aria-label={`Downvote ${label}`} onClick={() => onVote('DOWN')}>
        <ArrowBigDown size={22} aria-hidden="true" />
      </button>
    </div>
  );
}

function RatingSummary({ reputation }: { reputation: TravellerReputation }) {
  const max = Math.max(1, ...Object.values(reputation.distribution));
  return (
    <section className="card pf-rating gp-rise" style={stagger(1)} aria-labelledby="rating-h">
      <h2 id="rating-h">Traveller rating</h2>
      {reputation.rating_count === 0 ? <p className="text-muted-foreground">No ratings yet.</p> : null}
      <div className="pf-rating-big" hidden={reputation.rating_count === 0}>
        <strong>{reputation.rating_average.toFixed(1)}</strong>
        <div>
          <Stars value={reputation.rating_average} size={18} />
          <small>{reputation.rating_count} review{reputation.rating_count === 1 ? '' : 's'}</small>
        </div>
      </div>
      <ul className="pf-dist" aria-label="Rating breakdown">
        {([5, 4, 3, 2, 1] as const).map((n) => (
          <li key={n}>
            <span>{n}<Star size={11} aria-hidden="true" /></span>
            <span className="pf-dist-bar"><span style={{ width: `${(reputation.distribution[n] / max) * 100}%` }} /></span>
            <span className="pf-dist-n">{reputation.distribution[n]}<span className="sr-only"> reviews with {n} stars</span></span>
          </li>
        ))}
      </ul>
      <p className="icon-line"><Trophy size={15} aria-hidden="true" />{reputation.trips_completed} group trips completed</p>
    </section>
  );
}

function ReviewCard({ review, index, onVote }: { review: TravellerReview; index: number; onVote: (d: VoteDirection) => void }) {
  return (
    <article id={`review-${review.review_id}`} className="pf-review gp-rise" style={stagger(index)} aria-label={`Review by ${review.author.name}`}>
      <VoteControl tally={review.votes} onVote={onVote} label={`review by ${review.author.name}`} />
      <div className="pf-review-body">
        <div className="pf-review-head">
          <span className="avatar small">{review.author.name.charAt(0)}</span>
          <div>
            <strong>{review.author.name}</strong>
            <small>{review.author.home_city} · Trip to {review.trip.city}, {review.trip.month}</small>
          </div>
          <span className="ml-auto"><Stars value={review.rating} size={14} /></span>
        </div>
        <p>{review.text}</p>
      </div>
    </article>
  );
}

/* ---------- page ---------- */

function ProfileView({ traveller, reputation: initial }: { traveller: Traveller; reputation: TravellerReputation }) {
  const viewer = useTravellerStore((s) => s.traveller);
  const location = useLocation();
  const back = (location.state as ProfileLinkState | null) ?? {};
  const [reputation, setReputation] = useState(initial);
  const [sort, setSort] = useState<ReviewSort>('TOP');
  const reviews = useMemo(() => sortReviews(reputation.reviews, sort), [reputation.reviews, sort]);
  const isMe = viewer?.traveller_id === traveller.traveller_id;
  const shared = viewer && !isMe ? traveller.interests.filter((i) => viewer.interests.includes(i)) : [];

  // The mock service answers instantly; a real API would need optimistic update + rollback here.
  async function voteProfile(direction: VoteDirection) {
    const current = reputation.profile_votes;
    const next = await reputationService.vote(traveller.traveller_id, viewer?.traveller_id ?? null, current, direction);
    setReputation((r) => ({ ...r, profile_votes: next }));
  }
  async function voteReview(review: TravellerReview, direction: VoteDirection) {
    const next = await reputationService.vote(review.review_id, viewer?.traveller_id ?? null, review.votes, direction);
    setReputation((r) => ({ ...r, reviews: r.reviews.map((x) => (x.review_id === review.review_id ? { ...x, votes: next } : x)) }));
  }

  return (
    <>
      {back.from ? (
        <Link to={back.from} className="text-link pf-back"><ArrowLeft size={14} aria-hidden="true" />Back to {back.fromLabel ?? 'previous page'}</Link>
      ) : null}

      <p className="pf-demo" role="note"><FlaskConical size={15} aria-hidden="true" />Ratings, reviews and votes are <b>sample data</b> for this prototype (reviews are stored on the server). Votes are only saved in this browser.</p>

      <section className="card pf-hero gp-rise" aria-labelledby="profile-h">
        <VoteControl tally={reputation.profile_votes} onVote={voteProfile} label={traveller.name} />
        <span className="avatar pf-avatar">{traveller.name.charAt(0)}</span>
        <div className="pf-hero-body">
          <h1 id="profile-h">{traveller.name}{isMe ? ' (you)' : ''}</h1>
          <p className="pf-sub">{traveller.age ?? '–'} years · {traveller.gender === 'FEMALE' ? 'Female' : 'Male'} · <span translate="no">{traveller.traveller_id}</span></p>
          <div className="pf-facts">
            <span><MapPin size={14} aria-hidden="true" />{traveller.home_city}</span>
            <span><Plane size={14} aria-hidden="true" />{traveller.home_airport}</span>
            <span><ShieldCheck size={14} aria-hidden="true" />{traveller.gender_preference === 'SAME_GENDER' ? 'Prefers same-gender groups' : 'Happy with any group'}</span>
            <span className="pf-quick-rating"><Star size={14} aria-hidden="true" />{reputation.rating_count ? `${reputation.rating_average.toFixed(1)} · ${reputation.rating_count} reviews` : 'No reviews yet'}</span>
          </div>
          <h2 className="pf-label">Interests{shared.length ? <small> · {shared.length} in common with you</small> : null}</h2>
          {traveller.interests.length ? <InterestTags values={traveller.interests} highlight={shared} /> : <p className="text-muted-foreground text-sm">No interests listed</p>}
        </div>
      </section>

      <div className="pf-grid">
        <RatingSummary reputation={reputation} />
        <section className="card pf-reviews gp-rise" style={stagger(2)} aria-labelledby="reviews-h">
          <div className="pf-reviews-head">
            <h2 id="reviews-h"><MessageSquareText size={18} aria-hidden="true" />Reviews from fellow travellers</h2>
            <label className="gp-filter" htmlFor="review-sort">
              <span className="text-sm text-muted-foreground">Sort by</span>
              <Select id="review-sort" value={sort} onChange={(e) => setSort(e.target.value as ReviewSort)}>
                <option value="TOP">Top</option>
                <option value="NEW">Newest</option>
                <option value="RATING">Highest rated</option>
              </Select>
            </label>
          </div>
          {reviews.length ? <AskReviews type="travellers" subjectId={traveller.traveller_id} subjectName={traveller.name} onOpenReview={scrollToReview} /> : null}
          {reviews.length ? (
            <div className="pf-review-list" key={sort}>
              {reviews.map((r, i) => <ReviewCard key={r.review_id} review={r} index={i} onVote={(d) => void voteReview(r, d)} />)}
            </div>
          ) : <p className="text-muted-foreground">No reviews yet.</p>}
        </section>
      </div>
    </>
  );
}

export default function TravellerProfilePage() {
  const { travellerId = '' } = useParams();
  const viewerId = useTravellerStore((s) => s.travellerId);
  const id = travellerId.trim().toUpperCase();
  const query = useAsync(async () => {
    const [traveller, reputation] = await Promise.all([
      travellerService.getTraveller(id),
      reputationService.getReputation(id, viewerId),
    ]);
    return { traveller, reputation };
  }, `profile:${id}:${viewerId ?? '-'}`);
  const notFound = query.error instanceof ApiError && query.error.status === 404;

  return (
    <PageContainer className="gp-page pf-page">
      <nav className="gp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Home</Link><ChevronRight size={12} aria-hidden="true" />
        <span>Traveller profile</span><ChevronRight size={12} aria-hidden="true" />
        <span>{query.data?.traveller.name ?? id}</span>
      </nav>
      {query.loading ? (
        <div role="status" aria-label="Loading profile" style={{ display: 'grid', gap: 16 }}>
          <div className="gp-skel" style={{ height: 180 }} />
          <div className="pf-grid"><div className="gp-skel" style={{ height: 260 }} /><div className="gp-skel" style={{ height: 260 }} /></div>
        </div>
      ) : notFound ? (
        <EmptyState title="Traveller not found" action={<Link className="text-link" to="/my-groups">Back to my groups</Link>}>
          <p>There is no traveller with ID {id}.</p>
        </EmptyState>
      ) : query.error || !query.data ? <ErrorState error={query.error} retry={query.retry} />
        : <ProfileView key={id} traveller={query.data.traveller} reputation={query.data.reputation} />}
    </PageContainer>
  );
}
