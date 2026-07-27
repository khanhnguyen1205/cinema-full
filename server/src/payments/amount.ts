// Tra DB rồi gọi quote() thuần. Có Prisma => KHÔNG viết unit test cho file này
// (job CI `checks` không có database).
import { prisma } from "../db/prisma";
import { heldByOthers } from "../api/holds";
import { quote, MAX_SEATS, type Quote } from "./quote";

export type OrderInput = {
  showtimeId: number;
  seats: string[];
  concessions: { id: number; qty: number }[];
};

export type AmountResult =
  | { ok: true; quote: Quote }
  | { ok: false; status: number; error: string; conflicts?: string[] };

// Số tiền của một đơn, tính HOÀN TOÀN từ dữ liệu trong DB (client chỉ được
// gửi id/số lượng, không được gửi giá).
export async function amountFor(
  order: OrderInput,
  userId: number,
): Promise<AmountResult> {
  const { showtimeId, seats } = order;
  if (!Number.isFinite(showtimeId) || seats.length === 0)
    return { ok: false, status: 400, error: "Thiếu suất chiếu hoặc ghế." };
  if (seats.length > MAX_SEATS)
    return {
      ok: false,
      status: 400,
      error: `Tối đa ${MAX_SEATS} ghế mỗi lần đặt.`,
    };

  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
  });
  if (!showtime)
    return { ok: false, status: 404, error: "Không tìm thấy suất chiếu." };
  const room = await prisma.room.findUnique({ where: { id: showtime.roomId } });
  if (!room)
    return { ok: false, status: 404, error: "Không tìm thấy phòng chiếu." };

  // Ghế đã bán + ghế người KHÁC đang giữ (cùng nguồn với /api/occupied-seats).
  const bookings = await prisma.booking.findMany({
    where: { showtimeId },
    select: { seats: true },
  });
  const taken = new Set<string>(showtime.bookedSeats);
  bookings.forEach((b) => b.seats.forEach((s) => taken.add(s)));
  heldByOthers(showtimeId, userId).forEach((s) => taken.add(s));
  const conflicts = seats.filter((s) => taken.has(s));
  if (conflicts.length)
    return {
      ok: false,
      status: 409,
      error: "Ghế vừa bị người khác giữ.",
      conflicts,
    };

  // Giá bắp nước LẤY TỪ DB theo id, bỏ qua id lạ.
  const ids = order.concessions
    .map((c) => Number(c.id))
    .filter((n) => Number.isFinite(n));
  const rows = ids.length
    ? await prisma.concession.findMany({ where: { id: { in: ids } } })
    : [];
  const priceById = new Map(rows.map((r) => [r.id, r.price]));
  const items = order.concessions
    .map((c) => ({
      price: priceById.get(Number(c.id)) ?? 0,
      qty: Math.max(0, Math.floor(Number(c.qty) || 0)),
    }))
    .filter((i) => i.price > 0 && i.qty > 0);

  return {
    ok: true,
    quote: quote({
      basePrice: showtime.price,
      seats,
      vipRows: room.vipRows,
      coupleRows: room.coupleRows,
      items,
    }),
  };
}
