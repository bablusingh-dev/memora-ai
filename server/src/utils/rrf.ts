export interface RankedItem<T> {
  id: string;
  item: T;
}

export interface FusedItem<T> {
  item: T;
  rrfScore: number;
}

/**
 * Reciprocal Rank Fusion: combines multiple independently-ranked lists (e.g.
 * several BM25 keyword-expansion variants, or a lexical ranking + a vector
 * similarity ranking) into a single ranking. Uses rank position only — the
 * lists' raw scores never need to be on comparable scales, which is exactly
 * why RRF is the standard way to blend BM25 scores with cosine similarity.
 *
 * Standard k=60 damping constant (same value used by the pre-existing
 * multi-query BM25 fusion this was extracted from).
 */
export function fuseRankedLists<T>(rankedLists: RankedItem<T>[][], limit: number, k = 60): FusedItem<T>[] {
  const scores = new Map<string, FusedItem<T>>();

  for (const list of rankedLists) {
    list.forEach(({ id, item }, rank) => {
      const contribution = 1 / (k + rank + 1);
      const existing = scores.get(id);
      if (existing) {
        existing.rrfScore += contribution;
      } else {
        scores.set(id, { item, rrfScore: contribution });
      }
    });
  }

  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit);
}
