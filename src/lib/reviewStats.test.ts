import { describe, it, expect } from "vitest";
import { reviewStats } from "./reviewStats";
import type { Review } from "types";

const mk = (rating: number): Review => ({
  id: rating,
  movieId: 1,
  userId: rating,
  userName: "U",
  rating,
  verified: false,
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("reviewStats", () => {
  it("mảng rỗng -> average 0, count 0", () => {
    expect(reviewStats([])).toEqual({
      average: 0,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });
  it("tính trung bình (làm tròn 1 chữ số) + phân bố", () => {
    const s = reviewStats([mk(5), mk(4), mk(5)]);
    expect(s.count).toBe(3);
    expect(s.average).toBe(4.7); // 14/3 = 4.666...
    expect(s.distribution[5]).toBe(2);
    expect(s.distribution[4]).toBe(1);
  });
});
