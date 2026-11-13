/**
 * MOCK guest reviews (user-requested: no reviews API). Generated deterministically from the
 * hotel ID, so every visitor sees the same threads; votes and new posts live in
 * useHotelReviewStore (this browser only).
 */
export interface ReviewComment {
  id: string;
  parentId: string | null;
  author: string;
  body: string;
  createdAt: string;
  baseScore: number;
  mine?: boolean;
}

export interface Review {
  id: string;
  hotelId: string;
  author: string;
  from: string;
  travelType: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  baseScore: number;
  comments: ReviewComment[];
  mine?: boolean;
}

/** Small seeded PRNG (mulberry32) so mock content is stable per hotel. */
function rng(seedText: string) {
  let seed = 0;
  for (const ch of seedText) seed = Math.imul(seed ^ ch.charCodeAt(0), 2654435761) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ['Ananya', 'Rohan', 'Meera', 'Kabir', 'Isha', 'Arjun', 'Neha', 'Vikram', 'Sana', 'Dev', 'Tara', 'Nikhil', 'Pooja', 'Aditya', 'Riya', 'Karan'];
const FROM = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata', 'Jaipur'];
const TRAVEL = ['Group of friends', 'Solo traveller', 'Couple', 'Family', 'Group of friends'];

const POSITIVE = [
  { title: 'Loved staying in {area}', body: 'Everything in {city} felt close. We came back every evening to a clean, calm room — exactly what a busy group trip needs.' },
  { title: 'Perfect base for {area}', body: 'Location was spot on — we walked to most of {area} and the station is close. Rooms were spotless and the beds were comfy after long days out.' },
  { title: 'Great value for a group', body: 'Split between friends this worked out much cheaper than we expected. Staff helped us plan day trips and stored our bags after check-out.' },
  { title: 'Quiet, clean, friendly', body: 'Super quiet at night even though {area} is busy. Check-in from {checkIn} was smooth and the front desk spoke good English.' },
  { title: 'Would stay again', body: 'Breakfast options nearby were great and the room had everything we needed. Wi-Fi was fast enough for video calls.' },
];
const MIXED = [
  { title: 'Helpful staff, basic breakfast', body: 'Front desk went out of their way for us. Breakfast is basic, so we ate out in {area} most mornings.' },
  { title: 'Good location, small rooms', body: 'Can\'t fault the location in {area}, but the room was tight for two people with big suitcases. Fine if you\'re out all day.' },
  { title: 'Decent, a bit dated', body: 'Clean and well run, but the bathroom felt a little dated. Staff were lovely and fixed our AC quickly.' },
  { title: 'Okay for the price', body: 'Walls are a bit thin and the lift was slow at peak times. Still, for this price in {city} it did the job.' },
];
const REPLIES = [
  'Thanks, this helps! Is it walkable from the station with luggage?',
  'Yes, about 10 minutes. There is a lift at the main exit.',
  'Did you need to book breakfast in advance?',
  'No, we just walked in. The bakery around the corner is better anyway.',
  'How was the noise at night? Light sleeper here.',
  'Ask for a higher floor, it makes a big difference.',
  'Agree with this review, we stayed the same week.',
  'Was the room big enough for 2 people with suitcases?',
];

const ANCHOR = Date.UTC(2026, 10, 1); // 1 Nov 2026
const DAY = 86_400_000;

export function mockReviews(hotel: { hotel_id: string; area: string; city: string; rating: number; check_in_from: string }): Review[] {
  const r = rng(hotel.hotel_id);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const fill = (s: string) => s.replaceAll('{area}', hotel.area).replaceAll('{city}', hotel.city).replaceAll('{checkIn}', hotel.check_in_from);
  const count = 4 + Math.floor(r() * 3);
  const reviews: Review[] = [];
  // Each template is used at most once per hotel (shuffled), so titles never repeat.
  const shuffled = <T,>(xs: T[]) => xs.map((x) => [r(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  const positive = shuffled(POSITIVE);
  const mixed = shuffled(MIXED);
  for (let i = 0; i < count; i++) {
    let rating = Math.max(5, Math.min(10, Math.round((hotel.rating + (r() - 0.45) * 2.4) * 10) / 10));
    if (!(rating >= 8 ? positive : mixed).length) rating = rating >= 8 ? 7.5 : 8.2; // that pool is used up
    const tpl = (rating >= 8 ? positive : mixed).shift();
    if (!tpl) break;
    const id = `${hotel.hotel_id}-r${i}`;
    const created = ANCHOR - Math.floor(r() * 220 + 3) * DAY;
    const comments: ReviewComment[] = [];
    const nComments = Math.floor(r() * 4);
    for (let c = 0; c < nComments; c++) {
      comments.push({
        id: `${id}-c${c}`,
        // Every other comment replies to the previous one: a small nested thread.
        parentId: c % 2 === 1 ? `${id}-c${c - 1}` : null,
        author: pick(NAMES),
        body: REPLIES[(i * 3 + c) % REPLIES.length],
        createdAt: new Date(created + (c + 1) * DAY).toISOString(),
        baseScore: Math.floor(r() * 18) - 2,
      });
    }
    reviews.push({
      id, hotelId: hotel.hotel_id, author: pick(NAMES), from: pick(FROM), travelType: pick(TRAVEL), rating,
      title: fill(tpl.title), body: fill(tpl.body), createdAt: new Date(created).toISOString(),
      baseScore: Math.floor(r() * 140) - 8, comments,
    });
  }
  return reviews;
}

/** "3 months ago" style, like Reddit. */
export function timeAgo(iso: string, now = Date.now()): string {
  const secs = Math.max(1, Math.round((now - new Date(iso).getTime()) / 1000));
  const units: [number, string][] = [[31_536_000, 'year'], [2_592_000, 'month'], [604_800, 'week'], [86_400, 'day'], [3_600, 'hour'], [60, 'minute']];
  for (const [size, name] of units) {
    const n = Math.floor(secs / size);
    if (n >= 1) return `${n} ${name}${n === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

/** Reddit-style "Best": Wilson-ish blend of score and recency. */
export function rankBest(score: number, createdAt: string, now = Date.now()) {
  const ageDays = (now - new Date(createdAt).getTime()) / DAY;
  return score / Math.pow(ageDays + 2, 0.6);
}
