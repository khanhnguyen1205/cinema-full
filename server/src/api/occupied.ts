import { Router } from "express";
import { getUserFromReq } from "../auth/middleware";
import { heldByOthers } from "./holds";
import { prisma } from "../db/prisma";

export const occupiedRouter: Router = Router();

// Ghế đã đặt của 1 suất: đã bán (booking + showtime.bookedSeats) + ghế người khác đang giữ.
// Chỉ trả số ghế, KHÔNG kèm thông tin cá nhân của đơn.
occupiedRouter.get("/", async (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Vui lòng đăng nhập." });
    return;
  }
  const raw = req.query.showtimeId as string | undefined;
  if (!raw) {
    res.status(400).json({ error: "Thiếu showtimeId." });
    return;
  }
  const showtimeId = Number(raw);
  if (!Number.isFinite(showtimeId)) {
    res.status(400).json({ error: "Thiếu showtimeId." });
    return;
  }
  try {
    const [showtime, bookings] = await Promise.all([
      prisma.showtime.findUnique({
        where: { id: showtimeId },
        select: { bookedSeats: true },
      }),
      prisma.booking.findMany({
        where: { showtimeId },
        select: { seats: true },
      }),
    ]);
    const set = new Set<string>(showtime?.bookedSeats ?? []);
    bookings.forEach((b) => b.seats.forEach((s) => set.add(s)));
    // Kho hold dùng khoá chuỗi đúng như client gửi ở POST /api/holds -> giữ `raw`.
    heldByOthers(raw, user.id).forEach((s) => set.add(s));
    res.json({ showtimeId, seats: [...set] });
  } catch {
    res.status(502).json({ error: "Lỗi cổng dữ liệu." });
  }
});
