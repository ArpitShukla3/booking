// TASK-X3: Reciprocal Rank Fusion (Cormack et al., 2009): score(d) = Σ over lists 1 / (k + rank(d)), rank from 1.

const RRF_K = 60;

/** lists: arrays of ids, best first. Returns [{ id, score, ranks }] where ranks[i] is the 1-based rank in list i or null. */
function reciprocalRankFusion(lists, k = RRF_K) {
  const fused = new Map();
  let seen = 0;
  lists.forEach((list, listIndex) => {
    list.forEach((id, i) => {
      let entry = fused.get(id);
      if (!entry) {
        entry = { id, score: 0, ranks: lists.map(() => null), first: seen++ };
        fused.set(id, entry);
      }
      if (entry.ranks[listIndex] !== null) return; // an id counts once per list
      entry.ranks[listIndex] = i + 1;
      entry.score += 1 / (k + i + 1);
    });
  });
  const best = (e) => Math.min(...e.ranks.filter((r) => r !== null));
  return [...fused.values()]
    .sort((a, b) => b.score - a.score || best(a) - best(b) || a.first - b.first)
    .map(({ id, score, ranks }) => ({ id, score, ranks }));
}

module.exports = { RRF_K, reciprocalRankFusion };
