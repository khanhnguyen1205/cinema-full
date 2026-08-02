import { prisma } from "../db/prisma";
import { addDays, dayOf, planShift } from "./date-shift";

// db.json giữ ngày cứng và seed chỉ dịch MỘT LẦN, nên vài ngày sau khi seed thì mọi
// suất chiếu đều thành quá khứ: trang chủ quảng cáo phim không đặt được, "Sắp tới" rỗng.
// Module này dịch lại cửa sổ ngay trong server — chỉ cột Showtime.time, KHÔNG đụng
// Booking/Review (đó là thời điểm có thật của người thật).

const EVERY_MS = 6 * 60 * 60 * 1000;

// Hai lượt chồng nhau (khởi động + nhịp lặp) sẽ dịch hai lần. Cờ này chặn.
let running = false;

// Giờ ĐỊA PHƯƠNG: chuỗi trong DB không mang múi giờ. toISOString() (UTC) sẽ ra ngày
// hôm trước với mọi lần chạy trước 07:00 ở VN.
const todayKey = (d: Date = new Date()): string => {
  const p2 = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

export async function refreshShowtimes(): Promise<number | null> {
  if (running) return null;
  running = true;
  try {
    const rows = await prisma.showtime.findMany({
      select: { id: true, time: true },
    });
    const offset = planShift(
      rows.map((r) => r.time),
      todayKey(),
    );
    if (offset === null) return null;

    // Một transaction: hoặc cả bộ dịch, hoặc không dòng nào — không để lịch chiếu
    // rơi vào trạng thái nửa cũ nửa mới.
    await prisma.$transaction(
      rows.map((r) =>
        prisma.showtime.update({
          where: { id: r.id },
          data: { time: addDays(r.time, offset) },
        }),
      ),
    );

    const days = rows.map((r) => dayOf(addDays(r.time, offset))).sort();
    console.log(
      `🔄 Đã dịch lịch chiếu ${offset > 0 ? "+" : ""}${offset} ngày: ${days[0]} → ${days[days.length - 1]}`,
    );
    return offset;
  } catch (e) {
    // Không bao giờ ném: DB chậm hay mất mạng không được phép làm sập server.
    console.error(
      "Không làm mới được lịch chiếu:",
      e instanceof Error ? e.message : e,
    );
    return null;
  } finally {
    running = false;
  }
}

export function startShowtimeRefresh(): void {
  void refreshShowtimes();
  // unref: bộ hẹn giờ không giữ tiến trình sống, tránh treo lúc tắt.
  setInterval(() => void refreshShowtimes(), EVERY_MS).unref();
}
