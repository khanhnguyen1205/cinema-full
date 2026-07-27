import { Router } from "express";
import { getUserFromReq } from "../auth/middleware";
import { amountFor } from "./amount";
import { getStripe, isStripeEnabled, publishableKey } from "./stripe";

export const paymentsRouter: Router = Router();

// Công khai: client cần biết có bật thanh toán thẻ không + publishable key.
// KHÔNG bao giờ trả secret key.
paymentsRouter.get("/config", (_req, res) => {
  if (!isStripeEnabled()) {
    res.json({ enabled: false });
    return;
  }
  res.json({ enabled: true, publishableKey: publishableKey() });
});

// Tạo PaymentIntent. Server TỰ TÍNH số tiền từ DB — không đọc số tiền của client.
paymentsRouter.post("/intent", async (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Vui lòng đăng nhập." });
    return;
  }
  if (!isStripeEnabled()) {
    res.status(503).json({ error: "Chưa cấu hình thanh toán thẻ." });
    return;
  }

  const body = req.body ?? {};
  const showtimeId = Number(body.showtimeId);
  const seats: string[] = Array.isArray(body.seats)
    ? body.seats.map(String)
    : [];
  const concessions = Array.isArray(body.concessions) ? body.concessions : [];

  const result = await amountFor({ showtimeId, seats, concessions }, user.id);
  if (!result.ok) {
    res.status(result.status).json({
      error: result.error,
      ...(result.conflicts ? { conflicts: result.conflicts } : {}),
    });
    return;
  }

  try {
    const intent = await getStripe().paymentIntents.create({
      amount: result.quote.total, // VND là zero-decimal: không nhân 100
      currency: "vnd",
      // CHỈ thẻ, cố ý: automatic_payment_methods mở cửa cho các phương thức có
      // CHUYỂN HƯỚNG, mà cả luồng này dựa vào việc không rời trang (giữ ghế +
      // đồng hồ + state wizard). Rời trang sau khi trả tiền = mất vé.
      payment_method_types: ["card"],
      metadata: {
        userId: String(user.id),
        showtimeId: String(showtimeId),
        seats: seats.join(","),
      },
    });
    res.json({ clientSecret: intent.client_secret, amount: intent.amount });
  } catch (e) {
    console.error("[payments]", e);
    res.status(502).json({ error: "Không tạo được phiên thanh toán." });
  }
});
