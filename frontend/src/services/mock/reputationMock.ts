/**
 * DEMO ONLY: reviews, ratings and up/down votes for traveller profiles.
 * There is no backend for reputation yet. Data is generated deterministically from the
 * traveller ID so every visit shows the same sample reviews, and a viewer's own votes are
 * remembered in this browser under REPUTATION_STORAGE_KEY. Replace this adapter when a
 * real reviews API exists.
 */
import type { MyVote, TravellerReputation, TravellerReview, VoteDirection, VoteTally } from '@/types/reputation';

export const REPUTATION_STORAGE_KEY = 'gtm.demo.reputation-votes.v1';

/* ---------- pure rules ---------- */

/**
 * Reddit-style voting: clicking the same arrow again removes the vote, clicking the
 * other arrow moves it. Counts never go below zero.
 */
export function applyVote(tally: VoteTally, next: VoteDirection): VoteTally {
  const nextVote: MyVote = tally.my_vote === next ? null : next;
  let { up, down } = tally;
  if (tally.my_vote === 'UP') up -= 1;
  if (tally.my_vote === 'DOWN') down -= 1;
  if (nextVote === 'UP') up += 1;
  if (nextVote === 'DOWN') down += 1;
  return { up: Math.max(0, up), down: Math.max(0, down), my_vote: nextVote };
}

export const voteScore = (tally: Pick<VoteTally, 'up' | 'down'>) => tally.up - tally.down;

/** 1.2k-style compact score like Reddit. */
export function compactScore(score: number): string {
  const abs = Math.abs(score);
  if (abs < 1000) return String(score);
  return `${score < 0 ? '-' : ''}${(abs / 1000).toFixed(abs < 10_000 ? 1 : 0).replace(/\.0$/, '')}k`;
}

export type ReviewSort = 'TOP' | 'NEW' | 'RATING';

export function sortReviews(reviews: TravellerReview[], sort: ReviewSort): TravellerReview[] {
  const copy = [...reviews];
  if (sort === 'TOP') return copy.sort((a, b) => voteScore(b.votes) - voteScore(a.votes) || b.created_at.localeCompare(a.created_at));
  if (sort === 'NEW') return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return copy.sort((a, b) => b.rating - a.rating || voteScore(b.votes) - voteScore(a.votes));
}

/** Small deterministic PRNG (mulberry32) seeded from a string. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- sample content ---------- */

const AUTHORS = [
  { name: 'Ananya Iyer', home_city: 'Bengaluru' }, { name: 'Rohan Mehta', home_city: 'Mumbai' },
  { name: 'Kavya Nair', home_city: 'Kochi' }, { name: 'Arjun Rao', home_city: 'Hyderabad' },
  { name: 'Meera Kapoor', home_city: 'Delhi' }, { name: 'Vikram Singh', home_city: 'Jaipur' },
  { name: 'Sneha Joshi', home_city: 'Pune' }, { name: 'Farhan Ali', home_city: 'Lucknow' },
  { name: 'Ishita Bose', home_city: 'Kolkata' }, { name: 'Dev Malhotra', home_city: 'Chandigarh' },
];
const CITIES = ['Tokyo', 'Kyoto', 'Osaka', 'Dubai', 'Abu Dhabi'];
const MONTHS = ['Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Aug 2026'];
const TEXT: Record<number, string[]> = {
  5: [
    'Brilliant travel buddy. Always on time, split every bill fairly and found the best street food stalls.',
    'Super easy to travel with. Planned the temple mornings perfectly and was flexible when the weather changed.',
    'Would happily travel together again. Respectful of everyone’s space and great company at dinner.',
    'Organised, friendly and calm under pressure when our train got cancelled. 10/10.',
  ],
  4: [
    'Really good trip overall. Communicates well in the group chat and kept the shared budget on track.',
    'Fun to be around and knows the city well. Sometimes ran a little late in the mornings.',
    'Great at finding hidden spots. Preferred a slower pace than me, but we worked it out easily.',
  ],
  3: [
    'Pleasant enough, though our interests didn’t overlap much. Fine for a short trip.',
    'Nice person, but plans changed a lot at the last minute.',
  ],
  2: ['We had different travel styles. Payments for the shared room took a while to settle.'],
  1: ['Cancelled on the group two days before the trip.'],
};

const pick = <T,>(rand: () => number, list: T[]) => list[Math.floor(rand() * list.length)];

/** Ratings skew positive like real marketplaces. */
function sampleRating(rand: () => number): number {
  const r = rand();
  return r < 0.55 ? 5 : r < 0.83 ? 4 : r < 0.94 ? 3 : r < 0.98 ? 2 : 1;
}

/** Builds the sample reputation for a traveller (no votes applied yet). */
export function buildReputation(travellerId: string): TravellerReputation {
  const rand = seededRandom(travellerId);
  const count = 3 + Math.floor(rand() * 5); // 3–7 reviews
  const reviews: TravellerReview[] = Array.from({ length: count }, (_, i) => {
    const rating = sampleRating(rand);
    const month = pick(rand, MONTHS);
    const up = Math.floor(rand() * 40) + (rating >= 4 ? 4 : 0);
    const down = Math.floor(rand() * (rating >= 4 ? 4 : 14));
    const day = String(1 + Math.floor(rand() * 27)).padStart(2, '0');
    const [mon, year] = month.split(' ');
    const monthNum = String(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(mon) + 1).padStart(2, '0');
    return {
      review_id: `${travellerId}-RV-${i + 1}`,
      author: pick(rand, AUTHORS),
      trip: { city: pick(rand, CITIES), month },
      rating,
      text: pick(rand, TEXT[rating]),
      created_at: `${year}-${monthNum}-${day}`,
      votes: { up, down, my_vote: null },
    };
  });
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as TravellerReputation['distribution'];
  for (const r of reviews) distribution[r.rating as 1 | 2 | 3 | 4 | 5] += 1;
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return {
    traveller_id: travellerId,
    rating_average: Math.round(average * 10) / 10,
    rating_count: reviews.length,
    distribution,
    trips_completed: count + Math.floor(rand() * 4),
    profile_votes: { up: 20 + Math.floor(rand() * 180), down: Math.floor(rand() * 25), my_vote: null },
    reviews,
  };
}

/* ---------- the viewer's own votes (this browser only) ---------- */

type StoredVotes = Record<string, VoteDirection>; // key: `<viewer>|<target>`

function readVotes(): StoredVotes {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(REPUTATION_STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as StoredVotes) : {};
  } catch {
    return {};
  }
}

function writeVotes(votes: StoredVotes) {
  try { localStorage.setItem(REPUTATION_STORAGE_KEY, JSON.stringify(votes)); } catch { /* demo: votes just won't persist */ }
}

/** Re-applies a stored vote on top of the sample counts. */
function withStoredVote(tally: VoteTally, stored: VoteDirection | undefined): VoteTally {
  return stored ? applyVote(tally, stored) : tally;
}

export const reputationMock = {
  async getReputation(travellerId: string, viewerId: string | null): Promise<TravellerReputation> {
    const base = buildReputation(travellerId);
    const votes = readVotes();
    const key = (target: string) => votes[`${viewerId ?? 'guest'}|${target}`];
    return {
      ...base,
      profile_votes: withStoredVote(base.profile_votes, key(travellerId)),
      reviews: base.reviews.map((r) => ({ ...r, votes: withStoredVote(r.votes, key(r.review_id)) })),
    };
  },
  /** Saves (or clears) the viewer's vote on a profile or review and returns the new tally. */
  async vote(targetId: string, viewerId: string | null, tally: VoteTally, direction: VoteDirection): Promise<VoteTally> {
    const next = applyVote(tally, direction);
    const votes = readVotes();
    const k = `${viewerId ?? 'guest'}|${targetId}`;
    if (next.my_vote) votes[k] = next.my_vote; else delete votes[k];
    writeVotes(votes);
    return next;
  },
};
