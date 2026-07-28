// Dịch mốc thời gian của fixture về quanh "hôm nay" lúc seed.
//
// db.json giữ ngày CỨNG (dễ đọc, dễ diff), nhưng nếu nạp thẳng thì chỉ vài ngày sau
// mọi suất chiếu đều thành quá khứ: tab "Sắp tới" rỗng, trang chủ quảng cáo phim không
// còn suất nào đặt được. Nên seed dịch cả bộ đi một số ngày cố định, **giữ nguyên
// khoảng cách giữa các mốc và giờ chiếu trong ngày**.
//
// Thuần — KHÔNG import Prisma/env (test chạy được ở CI không có database).

// Ngày sớm nhất của fixture rơi vào (hôm nay - PAST_DAYS). Fixture trải 7 ngày nên
// cửa sổ thành: 2 ngày đã qua + hôm nay + 4 ngày tới. Vế quá khứ để tab "Đã xem" và
// các đơn seed vẫn có nghĩa; vế tương lai để còn đặt được vé.
export const PAST_DAYS = 2;

const ISO = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/;

export const dayOf = (iso: string): string => (iso || "").slice(0, 10);

// Cộng ngày trên lịch UTC rồi ghép lại phần giờ NGUYÊN VĂN: chuỗi trong db.json không
// mang múi giờ, đi qua Date theo giờ địa phương sẽ lệch giờ chiếu.
export function addDays(iso: string, days: number): string {
  const m = ISO.exec(iso || "");
  if (!m) return iso;
  const [, y, mo, d, rest] = m;
  const t = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  const shifted = new Date(t + days * 86_400_000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}${rest ?? ""}`;
}

// Số ngày cần cộng vào MỌI mốc để ngày sớm nhất của fixture thành (today - PAST_DAYS).
export function offsetDaysFor(earliestDay: string, today: string): number {
  const a = Date.parse(`${dayOf(earliestDay)}T00:00:00Z`);
  const b = Date.parse(`${dayOf(today)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) - PAST_DAYS;
}
