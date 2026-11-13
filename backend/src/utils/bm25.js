// TASK-X3: Okapi BM25 (pure). score(D, Q) = Σ idf(q) · tf·(k1+1) / (tf + k1·(1 − b + b·|D|/avgdl))
// with idf(q) = ln(1 + (N − n(q) + 0.5) / (n(q) + 0.5)) (always ≥ 0).

const K1 = 1.2;
const B = 0.75;

/** docs: [{ id, tokens }] in a stable order. */
function buildIndex(docs, { k1 = K1, b = B } = {}) {
  const df = new Map();
  let totalLength = 0;
  const entries = docs.map((doc, order) => {
    const tf = new Map();
    for (const token of doc.tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
    for (const token of tf.keys()) df.set(token, (df.get(token) ?? 0) + 1);
    totalLength += doc.tokens.length;
    return { id: doc.id, tf, dl: doc.tokens.length, order };
  });
  return { N: entries.length, avgdl: entries.length ? totalLength / entries.length : 0, df, docs: entries, k1, b };
}

function idf(index, term) {
  const n = index.df.get(term) ?? 0;
  if (!n) return 0;
  return Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
}

/**
 * Ranks the documents (optionally only ids in `allowIds`) that contain at least one query term.
 * Repeated query terms count once. Ties keep index order.
 */
function search(index, queryTokens, allowIds) {
  const terms = [...new Set(queryTokens)].filter((t) => index.df.has(t));
  if (!terms.length || !index.N) return [];
  const weights = terms.map((t) => [t, idf(index, t)]);
  const results = [];
  for (const doc of index.docs) {
    if (allowIds && !allowIds.has(doc.id)) continue;
    let score = 0;
    for (const [term, w] of weights) {
      const tf = doc.tf.get(term);
      if (!tf) continue;
      score += (w * tf * (index.k1 + 1)) / (tf + index.k1 * (1 - index.b + (index.b * doc.dl) / index.avgdl));
    }
    if (score > 0) results.push({ id: doc.id, score, order: doc.order });
  }
  return results.sort((x, y) => y.score - x.score || x.order - y.order).map(({ id, score }) => ({ id, score }));
}

module.exports = { K1, B, buildIndex, idf, search };
