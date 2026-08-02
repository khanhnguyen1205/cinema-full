import { describe, it, expect } from "vitest";
import {
  addDays,
  AHEAD_DAYS_MIN,
  dayOf,
  offsetDaysFor,
  PAST_DAYS,
  planShift,
} from "./date-shift";

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

describe("planShift", () => {
  // Cửa sổ khoẻ mà seed tạo ra: [hôm nay-2, hôm nay+4].
  const healthy = (today: string): string[] =>
    [-2, -1, 0, 1, 2, 3, 4].map((d) => addDays(`${today}T18:00:00`, d));

  it("không có suất nào thì đứng im (DB chưa seed, không phải việc của nó)", () => {
    expect(planShift([], "2026-08-02")).toBeNull();
  });

  it("cửa sổ vừa seed xong thì không đụng vào", () => {
    expect(planShift(healthy("2026-08-02"), "2026-08-02")).toBeNull();
  });

  it("biên: còn đúng 2 ngày phía trước thì vẫn chưa dịch", () => {
    const times = ["2026-08-01T10:00:00", "2026-08-04T21:00:00"];
    expect(planShift(times, "2026-08-02")).toBeNull();
  });

  it("còn 1 ngày phía trước thì dịch", () => {
    // Cửa sổ đã trôi: sớm nhất 28/07, muộn nhất 03/08, hôm nay 02/08.
    const times = ["2026-07-28T10:00:00", "2026-08-03T21:00:00"];
    expect(planShift(times, "2026-08-02")).toBe(3);
  });

  it("dịch xong thì ngày sớm nhất đúng bằng hôm nay trừ PAST_DAYS", () => {
    const times = ["2026-07-20T10:00:00", "2026-07-26T21:00:00"];
    const off = planShift(times, "2026-08-02");
    expect(off).not.toBeNull();
    // hôm nay 02/08, PAST_DAYS = 2 ⇒ sớm nhất phải thành 31/07.
    expect(PAST_DAYS).toBe(2);
    expect(dayOf(addDays(times[0], off as number))).toBe("2026-07-31");
  });

  it("giữ nguyên khoảng cách giữa các suất và giờ chiếu trong ngày", () => {
    const times = ["2026-07-20T10:00:00", "2026-07-26T21:00:00"];
    const off = planShift(times, "2026-08-02") as number;
    const a = addDays(times[0], off);
    const b = addDays(times[1], off);
    expect(offsetDaysFor(dayOf(a), dayOf(b)) + PAST_DAYS).toBe(6);
    expect(a.endsWith("T10:00:00")).toBe(true);
    expect(b.endsWith("T21:00:00")).toBe(true);
  });

  it("dịch 0 ngày cũng coi như không có việc gì", () => {
    // Mọi suất dồn vào đúng (hôm nay - PAST_DAYS): phía trước 0 ngày nên lọt cửa
    // điều kiện, nhưng offset tính ra bằng 0 nên không có gì để làm.
    expect(planShift(["2026-07-31T10:00:00"], "2026-08-02")).toBeNull();
  });

  it("chuỗi hỏng thì bỏ qua, không ném lỗi", () => {
    expect(planShift(["hôm nay", ""], "2026-08-02")).toBeNull();
  });

  it("ngưỡng phơi ra ngoài để chỗ khác đọc được", () => {
    expect(AHEAD_DAYS_MIN).toBe(2);
  });
});
