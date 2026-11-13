// TASK-X3: deterministic sample reviews, ported 1:1 from the old browser mocks
// (frontend mockReviews.ts for hotels, reputationMock.ts for travellers) so review IDs and
// texts stay the same and votes saved in the browser still line up. Pure functions, no I/O.
const { chunkReview } = require('../../src/utils/text');

/* ---------- hotels (was frontend/src/features/hotels/mockReviews.ts) ---------- */

function hotelRng(seedText) {
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
const ANCHOR = Date.UTC(2026, 10, 1);
const DAY = 86_400_000;

function hotelReviews(hotel) {
  const r = hotelRng(hotel.hotel_id);
  const pick = (xs) => xs[Math.floor(r() * xs.length)];
  const fill = (s) => s.replaceAll('{area}', hotel.area).replaceAll('{city}', hotel.city).replaceAll('{checkIn}', hotel.check_in_from);
  const count = 4 + Math.floor(r() * 3);
  const shuffled = (xs) => xs.map((x) => [r(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  const positive = shuffled(POSITIVE);
  const mixed = shuffled(MIXED);
  const reviews = [];
  for (let i = 0; i < count; i++) {
    let rating = Math.max(5, Math.min(10, Math.round((Number(hotel.rating) + (r() - 0.45) * 2.4) * 10) / 10));
    if (!(rating >= 8 ? positive : mixed).length) rating = rating >= 8 ? 7.5 : 8.2;
    const tpl = (rating >= 8 ? positive : mixed).shift();
    if (!tpl) break;
    const id = `${hotel.hotel_id}-r${i}`;
    const created = ANCHOR - Math.floor(r() * 220 + 3) * DAY;
    const comments = [];
    const nComments = Math.floor(r() * 4);
    for (let c = 0; c < nComments; c++) {
      comments.push({
        id: `${id}-c${c}`,
        parentId: c % 2 === 1 ? `${id}-c${c - 1}` : null,
        author: pick(NAMES),
        body: REPLIES[(i * 3 + c) % REPLIES.length],
        createdAt: new Date(created + (c + 1) * DAY).toISOString(),
        baseScore: Math.floor(r() * 18) - 2,
      });
    }
    const author = pick(NAMES);
    const from = pick(FROM);
    const travelType = pick(TRAVEL);
    const title = fill(tpl.title);
    const body = fill(tpl.body);
    const createdAt = new Date(created).toISOString();
    reviews.push({
      review_id: id, subject_type: 'HOTEL', subject_id: hotel.hotel_id, author, author_from: from,
      rating, rating_scale: 10, title, body, created_at: createdAt, base_score: Math.floor(r() * 140) - 8,
      meta: { travel_type: travelType, comments },
    });
  }
  return reviews;
}

/* ---------- travellers (was frontend/src/services/mock/reputationMock.ts) ---------- */

function travellerRng(seed) {
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

const AUTHORS = [
  { name: 'Ananya Iyer', home_city: 'Bengaluru' }, { name: 'Rohan Mehta', home_city: 'Mumbai' },
  { name: 'Kavya Nair', home_city: 'Kochi' }, { name: 'Arjun Rao', home_city: 'Hyderabad' },
  { name: 'Meera Kapoor', home_city: 'Delhi' }, { name: 'Vikram Singh', home_city: 'Jaipur' },
  { name: 'Sneha Joshi', home_city: 'Pune' }, { name: 'Farhan Ali', home_city: 'Lucknow' },
  { name: 'Ishita Bose', home_city: 'Kolkata' }, { name: 'Dev Malhotra', home_city: 'Chandigarh' },
];
const CITIES = ['Tokyo', 'Kyoto', 'Osaka', 'Dubai', 'Abu Dhabi'];
const MONTHS = ['Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Aug 2026'];
const TEXT = {
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
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function travellerReviews(traveller) {
  const rand = travellerRng(traveller.traveller_id);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const sampleRating = () => { const x = rand(); return x < 0.55 ? 5 : x < 0.83 ? 4 : x < 0.94 ? 3 : x < 0.98 ? 2 : 1; };
  const count = 3 + Math.floor(rand() * 5);
  return Array.from({ length: count }, (_, i) => {
    const rating = sampleRating();
    const month = pick(MONTHS);
    const up = Math.floor(rand() * 40) + (rating >= 4 ? 4 : 0);
    const down = Math.floor(rand() * (rating >= 4 ? 4 : 14));
    const day = String(1 + Math.floor(rand() * 27)).padStart(2, '0');
    const [mon, year] = month.split(' ');
    const monthNum = String(MONTH_NAMES.indexOf(mon) + 1).padStart(2, '0');
    const author = pick(AUTHORS);
    const city = pick(CITIES);
    const text = pick(TEXT[rating]);
    return {
      review_id: `${traveller.traveller_id}-RV-${i + 1}`, subject_type: 'TRAVELLER', subject_id: traveller.traveller_id,
      author: author.name, author_from: author.home_city, rating, rating_scale: 5, title: null, body: text,
      created_at: `${year}-${monthNum}-${day}`, base_score: up - down, meta: { trip: { city, month }, votes: { up, down } },
    };
  });
}

/* ---------- chunks + template context (used until the Ollama index exists) ---------- */

function templateContext(review, subject) {
  if (review.subject_type === 'HOTEL') {
    return `Guest review of ${subject.name}, a hotel in ${subject.area}, ${subject.city}, by ${review.author} from ${review.author_from} `
      + `(${review.meta.travel_type}), rated ${review.rating}/10, titled "${review.title}".`;
  }
  return `Review of traveller ${subject.name} by travel companion ${review.author} from ${review.author_from} after a group trip to `
    + `${review.meta.trip.city} in ${review.meta.trip.month}, rated ${review.rating}/5.`;
}

function chunksOf(review, subject) {
  return chunkReview(review.body).map((content, position) => ({
    chunk_id: `${review.review_id}-k${position}`, review_id: review.review_id, position, content,
    context: templateContext(review, subject),
  }));
}

/** Suggested questions: their embeddings are computed offline, so these run fully hybrid. */
const QUESTIONS = {
  HOTEL: [
    'Is it quiet at night?', 'How clean are the rooms?', 'Is it close to the station?', 'Is it good value for a group?',
    'How is the breakfast?', 'Are the staff helpful?', 'Are the rooms big enough for luggage?', 'Is the Wi-Fi fast?',
  ],
  TRAVELLER: [
    'Do they split costs fairly?', 'Are they punctual?', 'Are they good at planning?', 'Are they flexible?',
    'Do they communicate well?', 'Have they ever cancelled a trip?', 'Are they fun to travel with?', 'How do they handle problems?',
  ],
};

function buildCorpus({ hotels, travellers }) {
  const subjects = { HOTEL: {}, TRAVELLER: {} };
  const reviews = [];
  for (const h of hotels) {
    subjects.HOTEL[h.hotel_id] = { name: h.name, area: h.area, city: h.city };
    reviews.push(...hotelReviews(h));
  }
  for (const t of travellers) {
    subjects.TRAVELLER[t.traveller_id] = { name: t.name, home_city: t.home_city };
    reviews.push(...travellerReviews(t));
  }
  const chunks = reviews.flatMap((r) => chunksOf(r, subjects[r.subject_type][r.subject_id]));
  const questions = Object.entries(QUESTIONS).flatMap(([type, list]) =>
    list.map((text, i) => ({ question_id: `${type === 'HOTEL' ? 'HQ' : 'TQ'}-${i + 1}`, subject_type: type, text, position: i + 1 })));
  return { version: 1, subjects, reviews, chunks, questions };
}

module.exports = { hotelReviews, travellerReviews, templateContext, chunksOf, buildCorpus, QUESTIONS };
