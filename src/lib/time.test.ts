import { describe, it, expect } from "vitest";
import { nowKey, isUpcoming } from "./time";

describe("nowKey", () => {
  it("cho ra đúng dạng chuỗi như cột time trong DB", () => {
    expect(nowKey(new Date(2026, 6, 28, 9, 5, 3))).toBe("2026-07-28T09:05:03");
  });

  it("dùng giờ ĐỊA PHƯƠNG, không phải UTC", () => {
    const d = new Date(2026, 0, 1, 0, 30, 0); // 00:30 giờ địa phương
    expect(nowKey(d)).toBe("2026-01-01T00:30:00");
  });
});

describe("isUpcoming", () => {
  const now = "2026-07-28T20:00:00";

  it("suất sau thời điểm hiện tại là sắp tới", () => {
    expect(isUpcoming("2026-07-28T21:00:00", now)).toBe(true);
    expect(isUpcoming("2026-08-01T09:00:00", now)).toBe(true);
  });

  it("suất đã chiếu thì không", () => {
    expect(isUpcoming("2026-07-28T19:59:59", now)).toBe(false);
    expect(isUpcoming("2026-07-27T21:00:00", now)).toBe(false);
  });

  it("đúng thời điểm hiện tại vẫn tính là sắp tới", () => {
    expect(isUpcoming(now, now)).toBe(true);
  });

  it("chuỗi rỗng thì không", () => {
    expect(isUpcoming("", now)).toBe(false);
  });
});
