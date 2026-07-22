import { Router } from "express";
import { getUserFromReq } from "../auth/middleware";
import { heldByOthers } from "./holds";
import { DATA_URL } from "../env";

type Booking = { showtimeId: number | string; seats?: string[] };
type Showtime = { bookedSeats?: string[] };

export const occupiedRouter: Router = Router();

// Ghế đã đặt của 1 suất: đã bán (booking + showtime.bookedSeats) + ghế người khác đang giữ.
// Chỉ trả số ghế, KHÔNG kèm thông tin cá nhân của đơn.
occupiedRouter.get("/", async (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Vui lòng đăng nhập." });
    return;
  }
  const showtimeId = req.query.showtimeId as string | undefined;
  if (!showtimeId) {
    res.status(400).json({ error: "Thiếu showtimeId." });
    return;
  }
  try {
    const [bookings, stRes] = await Promise.all([
      fetch(`${DATA_URL}/bookings`).then((r) => r.json() as Promise<Booking[]>),
      fetch(`${DATA_URL}/showtimes/${showtimeId}`),
    ]);
    const showtime = stRes.ok ? ((await stRes.json()) as Showtime) : null;
    const set = new Set<string>(showtime?.bookedSeats || []);
    bookings
      .filter((b) => String(b.showtimeId) === String(showtimeId))
      .forEach((b) => (b.seats || []).forEach((s) => set.add(s)));
    heldByOthers(showtimeId, user.id).forEach((s) => set.add(s)); // ghế người khác đang giữ
    res.json({ showtimeId: Number(showtimeId), seats: [...set] });
  } catch {
    res.status(502).json({ error: "Lỗi cổng dữ liệu." });
  }
});
