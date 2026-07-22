import { Router } from "express";
import { getUserFromReq } from "../auth/middleware";
import { HOLD_TTL_MS } from "../env";

// Map<showtimeId(string), Map<seatNumber, { userId, expiresAt }>>.
type Hold = { userId: number; expiresAt: number };
const holds = new Map<string, Map<string, Hold>>();

// Lấy map ghế của 1 suất sau khi dọn hold hết hạn (tạo nếu chưa có).
function seatHolds(showtimeId: string | number): Map<string, Hold> {
  const key = String(showtimeId);
  let m = holds.get(key);
  if (!m) {
    m = new Map();
    holds.set(key, m);
  }
  const now = Date.now();
  for (const [seat, h] of m) if (h.expiresAt <= now) m.delete(seat);
  return m;
}

// Ghế đang bị NGƯỜI KHÁC (khác userId) giữ ở 1 suất.
export function heldByOthers(
  showtimeId: string | number,
  userId: number,
): string[] {
  const out: string[] = [];
  for (const [seat, h] of seatHolds(showtimeId))
    if (h.userId !== userId) out.push(seat);
  return out;
}

// Đặt lại toàn bộ ghế user giữ ở suất = danh sách seats, gia hạn TTL (kiêm heartbeat).
function setHolds(
  showtimeId: string | number,
  userId: number,
  seats: string[],
): number {
  const m = seatHolds(showtimeId);
  for (const [seat, h] of m) if (h.userId === userId) m.delete(seat);
  const expiresAt = Date.now() + HOLD_TTL_MS;
  seats.forEach((s) => m.set(s, { userId, expiresAt }));
  return expiresAt;
}

// Nhả toàn bộ hold của user ở 1 suất.
export function releaseHolds(
  showtimeId: string | number,
  userId: number,
): void {
  const m = seatHolds(showtimeId);
  for (const [seat, h] of m) if (h.userId === userId) m.delete(seat);
}

export const holdsRouter: Router = Router();

// Giữ ghế: đặt/gia hạn danh sách ghế đang chọn cho 1 suất (kiêm heartbeat).
holdsRouter.post("/", (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Vui lòng đăng nhập." });
    return;
  }
  const showtimeId = req.body.showtimeId;
  const seats: string[] = Array.isArray(req.body.seats) ? req.body.seats : [];
  if (!showtimeId) {
    res.status(400).json({ error: "Thiếu showtimeId." });
    return;
  }
  const others = new Set(heldByOthers(showtimeId, user.id));
  const conflicts = seats.filter((s) => others.has(s));
  if (conflicts.length) {
    res.status(409).json({ error: "Ghế vừa bị người khác giữ.", conflicts });
    return;
  }
  const expiresAt = setHolds(showtimeId, user.id, seats);
  res.json({ ok: true, expiresAt });
});

// Nhả ghế đang giữ của user cho 1 suất.
holdsRouter.delete("/", (req, res) => {
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
  releaseHolds(showtimeId, user.id);
  res.status(204).end();
});
