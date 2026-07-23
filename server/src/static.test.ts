import { describe, it, expect } from "vitest";
import { spaFallbackPattern } from "./static";

describe("spaFallbackPattern", () => {
  it("khớp các route SPA để trả index.html", () => {
    expect(spaFallbackPattern.test("/")).toBe(true);
    expect(spaFallbackPattern.test("/movies")).toBe(true);
    expect(spaFallbackPattern.test("/seats/12")).toBe(true);
    expect(spaFallbackPattern.test("/admin/bookings")).toBe(true);
  });
  it("KHÔNG khớp /api và /auth (API phải được xử lý trước)", () => {
    expect(spaFallbackPattern.test("/api/movies")).toBe(false);
    expect(spaFallbackPattern.test("/api/occupied-seats")).toBe(false);
    expect(spaFallbackPattern.test("/auth/login")).toBe(false);
  });
  it("khớp route bắt đầu bằng chữ giống api/auth nhưng khác đoạn", () => {
    expect(spaFallbackPattern.test("/apixel")).toBe(true);
    expect(spaFallbackPattern.test("/authors")).toBe(true);
  });
});
