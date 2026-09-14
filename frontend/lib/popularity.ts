/**
 * Algorithme de popularité côté client (miroir du backend).
 * score = ventes*50 + vues*2 + (note * avis)*8 + featured*100 + boost récence
 */

export interface PopularityInput {
  sales_count?: number;
  view_count?: number;
  rating?: number;
  review_count?: number;
  is_featured?: boolean;
  stock?: number;
  created_at?: string;
  popularity_score?: number;
}

export function computePopularityScore(p: PopularityInput): number {
  if (typeof p.popularity_score === "number" && p.popularity_score > 0) {
    return p.popularity_score;
  }

  let score =
    (p.sales_count || 0) * 50 +
    (p.view_count || 0) * 2 +
    (p.rating || 0) * (p.review_count || 0) * 8;

  if (p.is_featured) score += 100;

  if (p.created_at) {
    const days =
      (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (days >= 0 && days <= 30) {
      score += 50 * (1 - days / 30);
    }
  }

  if ((p.stock ?? 1) <= 0) {
    score *= 0.4;
  }

  return score;
}

export function sortByPopularity<T extends PopularityInput>(
  products: T[],
  limit?: number
): T[] {
  const ranked = [...products].sort(
    (a, b) => computePopularityScore(b) - computePopularityScore(a)
  );
  return typeof limit === "number" ? ranked.slice(0, limit) : ranked;
}
