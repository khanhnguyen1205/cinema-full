import { describe, it, expect } from "vitest";
import { addDays, dayOf, offsetDaysFor, PAST_DAYS } from "./date-shift";

describe("dayOf", () => {
  it("lấy phần ngày của chuỗi trong db.json", () => {
    expect(dayOf("2026-07-15T18:00:00")).toBe("2026-07-15");
  });
});

describe("addDays", () => {
  it("giữ nguyên giờ, chỉ dịch ngày", () => {
    expect(addDays("2026-07-15T18:00:00", 3)).toBe("2026-07-18T18:00:00");
  });

  it("dịch lùi được", () => {
    expect(addDays("2026-07-15T18:00:00", -20)).toBe("2026-06-25T18:00:00");
  });

  it("nhảy qua ranh giới tháng và năm", () => {
    expect(addDays("2026-12-31T23:30:00", 1)).toBe("2027-01-01T23:30:00");
    expect(addDays("2026-03-01T00:00:00", -1)).toBe("2026-02-28T00:00:00");
  });

  it("dịch 0 ngày trả lại chính nó", () => {
    expect(addDays("2026-07-15T18:00:00", 0)).toBe("2026-07-15T18:00:00");
  });

  it("chuỗi hỏng thì trả nguyên, không ném lỗi", () => {
    expect(addDays("hôm nay", 3)).toBe("hôm nay");
  });
});

describe("offsetDaysFor", () => {
  // Neo: ngày SỚM NHẤT trong fixture phải rơi vào (hôm nay - PAST_DAYS).
  it("đẩy ngày sớm nhất tới đúng số ngày quá khứ đã định", () => {
    const off = offsetDaysFor("2026-07-14", "2026-09-10");
    expect(addDays("2026-07-14T00:00:00", off)).toBe(
      `2026-09-${String(10 - PAST_DAYS).padStart(2, "0")}T00:00:00`,
    );
  });

  it("giữ nguyên khoảng cách giữa các ngày trong fixture", () => {
    const off = offsetDaysFor("2026-07-14", "2026-09-10");
    const first = addDays("2026-07-14T18:00:00", off);
    const last = addDays("2026-07-20T18:00:00", off);
    const diff =
      (Date.parse(last + "Z") - Date.parse(first + "Z")) / 86_400_000;
    expect(diff).toBe(6); // fixture trải đúng 7 ngày
  });

  it("hôm nay lùi về quá khứ thì offset âm", () => {
    expect(offsetDaysFor("2026-07-14", "2026-07-01")).toBeLessThan(0);
  });
});
