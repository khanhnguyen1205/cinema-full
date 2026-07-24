import type { Review } from "types";

export type RatingKey = 1 | 2 | 3 | 4 | 5;
export interface ReviewStats {
  average: number;
  count: number;
  distribution: Record<RatingKey, number>;
}

export function reviewStats(reviews: Review[]): ReviewStats {
  const distribution: Record<RatingKey, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  let sum = 0;
  for (const r of reviews) {
    const k = Math.min(5, Math.max(1, Math.round(r.rating))) as RatingKey;
    distribution[k] += 1;
    sum += r.rating;
  }
  const count = reviews.length;
  const average = count ? Math.round((sum / count) * 10) / 10 : 0;
  return { average, count, distribution };
}
