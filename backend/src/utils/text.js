// TASK-X3: text processing shared by BM25 indexing and querying (pure, no I/O).
// Queries and documents MUST go through the same tokenize() so their terms line up.

const STOPWORDS = new Set(`a about above after again against all am an and any are as at be because been before being
below between both but by can could did do does doing down during each few for from further had has have having he her
here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not of off on once
only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then
there these they this those through to too under until up very was we were what when where which while who whom why will
with would you your yours yourself yourselves also us get got s t re ve ll d m im dont didnt cant wasnt isnt`.split(/\s+/));

/** Lowercase, strip accents, normalise apostrophes. */
function normalize(input) {
  return String(input ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toLowerCase();
}

function undouble(word) {
  return /([b-df-hj-kmnp-rt-y])\1$/.test(word) ? word.slice(0, -1) : word;
}

/** Light suffix stripping (a tiny Porter-like stemmer): rooms → room, planned → plan, quietly → quiet. */
function stem(word) {
  const w = normalize(word);
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith('ing') && w.length > 5) return undouble(w.slice(0, -3));
  if (w.endsWith('ed') && w.length > 4) return undouble(w.slice(0, -2));
  if (w.endsWith('ly') && w.length >= 7) return w.slice(0, -2);
  if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Words as written (lowercased, accents folded); apostrophes are dropped so "can't" → "cant". */
function words(input) {
  return normalize(input).replace(/'/g, '').match(/[a-z0-9]+/g) ?? [];
}

/** Text → index terms: words minus stopwords and 1-letter tokens, stemmed. */
function tokenize(input) {
  return words(input).filter((w) => w.length > 1 && !STOPWORDS.has(w)).map(stem);
}

/** Original words of `passage` whose stem is one of `terms` (for highlighting), first-seen order, no repeats. */
function matchedWords(passage, terms) {
  const wanted = new Set(terms);
  const seen = new Set();
  const out = [];
  for (const raw of String(passage ?? '').match(/[\p{L}\p{N}'’]+/gu) ?? []) {
    const word = raw.replace(/['’]s$/i, '');
    const key = word.toLowerCase();
    const [token] = tokenize(word);
    if (token && wanted.has(token) && !seen.has(key)) { seen.add(key); out.push(key); }
  }
  return out;
}

const MIN_CHUNK_WORDS = 4;

/** A review body → sentence chunks; sentences shorter than 4 words join a neighbour. */
function chunkReview(body) {
  const sentences = String(body ?? '').trim().split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
  let carry = '';
  sentences.forEach((sentence, i) => {
    const merged = carry ? `${carry} ${sentence}` : sentence;
    const short = merged.split(/\s+/).length < MIN_CHUNK_WORDS;
    if (short && i < sentences.length - 1) { carry = merged; return; }
    carry = '';
    if (short && chunks.length) chunks[chunks.length - 1] += ` ${merged}`;
    else chunks.push(merged);
  });
  return chunks;
}

module.exports = { STOPWORDS, normalize, stem, words, tokenize, matchedWords, chunkReview };
