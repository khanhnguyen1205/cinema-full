import { describe, it, expect, afterAll } from "vitest";
import i18n from "i18n";
import { formatPrice, formatDate } from "./format";

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
