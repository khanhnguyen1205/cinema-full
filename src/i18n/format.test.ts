import { describe, it, expect, afterAll } from "vitest";
import i18n from "i18n";
import {
  formatPrice,
  formatDate,
  formatDayShort,
  formatClock,
  formatShowtimeLabel,
} from "./format";

describe("formatPrice", () => {
  it("luôn có hậu tố ₫", () => {
    expect(formatPrice(100000)).toContain("₫");
  });
});

describe("formatDate theo locale", () => {
  afterAll(async () => {
    await i18n.changeLanguage("vi");
  });
  it("đổi khi changeLanguage", async () => {
    await i18n.changeLanguage("vi");
    const vi = formatDate("2026-07-25T00:00:00.000Z", { weekday: "long" });
    await i18n.changeLanguage("en");
    const en = formatDate("2026-07-25T00:00:00.000Z", { weekday: "long" });
    expect(vi).not.toBe(en); // "Thứ Bảy" vs "Saturday"
  });
});

// Chuỗi giờ trong DB không mang múi giờ → dùng chuỗi "naive" để test
// không phụ thuộc múi giờ của máy chạy.
const ISO = "2026-08-05T19:30:00";

describe("formatDayShort", () => {
  afterAll(async () => {
    await i18n.changeLanguage("vi");
  });
  it("có ngày và tháng 2 chữ số", () => {
    expect(formatDayShort(ISO)).toContain("05");
    expect(formatDayShort(ISO)).toContain("08");
  });
  it("đổi theo ngôn ngữ", async () => {
    await i18n.changeLanguage("vi");
    const vi = formatDayShort(ISO);
    await i18n.changeLanguage("en");
    expect(formatDayShort(ISO)).not.toBe(vi);
  });
});

describe("formatClock", () => {
  afterAll(async () => {
    await i18n.changeLanguage("vi");
  });
  it("luôn 24 giờ", () => {
    expect(formatClock(ISO)).toBe("19:30");
  });
  it("KHÔNG đổi theo ngôn ngữ (đồng hồ cố định en-GB)", async () => {
    await i18n.changeLanguage("en");
    expect(formatClock(ISO)).toBe("19:30");
  });
});

describe("formatShowtimeLabel", () => {
  it("gồm cả giờ lẫn ngày/tháng", () => {
    const s = formatShowtimeLabel(ISO);
    expect(s).toContain("19:30");
    expect(s).toContain("05");
    expect(s).toContain("08");
  });
});
