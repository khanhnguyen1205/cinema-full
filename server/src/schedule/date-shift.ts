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

// Số ngày lịch từ `from` đến `to`. NaN nếu một trong hai không phải ngày.
const dayDiff = (from: string, to: string): number =>
  (Date.parse(`${dayOf(to)}T00:00:00Z`) -
    Date.parse(`${dayOf(from)}T00:00:00Z`)) /
  86_400_000;

// Số ngày cần cộng vào MỌI mốc để ngày sớm nhất của fixture thành (today - PAST_DAYS).
export function offsetDaysFor(earliestDay: string, today: string): number {
  return Math.round(dayDiff(earliestDay, today)) - PAST_DAYS;
}

// Cửa sổ phải luôn còn ít nhất chừng này ngày phía trước, nếu không thì dịch. Cửa sổ
// khoẻ có ngày muộn nhất = hôm nay + 4, nên thực tế cứ ~3 ngày dịch một lần.
export const AHEAD_DAYS_MIN = 2;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Cần dịch bao nhiêu ngày để cửa sổ về lại [today - PAST_DAYS, ...]? null = đang khoẻ,
// hoặc không đủ dữ kiện để quyết — cả hai đều nghĩa là ĐỪNG ĐỤNG VÀO.
export function planShift(times: string[], today: string): number | null {
  const days = times.map(dayOf).filter((d) => DAY_RE.test(d));
  if (days.length === 0) return null;
  days.sort();

  // So theo NGÀY LỊCH, không theo giờ: suất 23:00 tối mai vẫn là "1 ngày phía trước",
  // đúng như người dùng nhìn vào dải chọn ngày.
  const ahead = dayDiff(today, days[days.length - 1]);
  if (!Number.isFinite(ahead) || ahead >= AHEAD_DAYS_MIN) return null;

  const offset = offsetDaysFor(days[0], today);
  return Number.isFinite(offset) && offset !== 0 ? offset : null;
}
