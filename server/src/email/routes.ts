import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireUser } from "../auth/middleware";
import { prisma } from "../db/prisma";
import { ownerOrAdmin } from "../api/reviews-validate";
import { isEmailEnabled } from "./resend";
import { pickLang } from "./lang";
import { sendTicketEmail } from "./send";

export const emailsRouter: Router = Router();

// Công khai: client cần biết có bật email không để ẩn/hiện nút "Gửi lại vé".
emailsRouter.get("/config", (_req, res) => {
  res.json({ enabled: isEmailEnabled() });
});

// Gửi lại tốn quota nhà cung cấp -> giới hạn nhịp theo IP.
const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Bạn gửi lại quá nhiều lần. Vui lòng đợi ít phút." },
});

emailsRouter.post("/ticket", resendLimiter, async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (!isEmailEnabled()) {
    res.status(503).json({ error: "Chưa cấu hình gửi email." });
    return;
  }
  const bookingId = Number((req.body ?? {}).bookingId);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ error: "Thiếu mã vé." });
    return;
  }
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    res.status(404).json({ error: "Không tìm thấy vé." });
    return;
  }
  // Dùng lại luật chủ-hoặc-admin của reviews: không ai gửi vé người khác đi đâu được.
  if (!ownerOrAdmin(booking.userId, user)) {
    res.status(403).json({ error: "Không có quyền." });
    return;
  }
  const r = await sendTicketEmail(bookingId, pickLang(req.headers["x-lang"]));
  if (!r.ok) {
    res.status(r.status).json({ error: r.error });
    return;
  }
  res.json({ sent: true });
});
