import { prisma } from "../db/prisma";
import { amountFor, orderFromBody } from "./amount";
import { checkIntent } from "./verify";
import { getStripe, isStripeEnabled } from "./stripe";

type BookingRow = NonNullable<
  Awaited<ReturnType<typeof prisma.booking.findFirst>>
>;

export type SettleResult =
  | { ok: true; existing: BookingRow }
  | {
      ok: true;
      existing: null;
      totals: {
        seatTotal: number;
        fnbTotal: number;
        serviceFee: number;
        totalPrice: number;
      };
    }
  | { ok: false; status: number; error: string; conflicts?: string[] };

// Kiểm tra một lần trả tiền qua thẻ TRƯỚC KHI cho phép tạo booking.
export async function settleCardPayment(
  body: Record<string, unknown>,
  userId: number,
): Promise<SettleResult> {
  if (!isStripeEnabled())
    return { ok: false, status: 503, error: "Chưa cấu hình thanh toán thẻ." };

  const paymentRef = typeof body.paymentRef === "string" ? body.paymentRef : "";
  if (!paymentRef.startsWith("pi_"))
    return { ok: false, status: 402, error: "Thiếu mã giao dịch thanh toán." };

  // Idempotency: một lần trả tiền chỉ ứng với đúng một đơn. Gửi lại cùng
  // paymentRef (vd mất mạng giữa chừng) sẽ nhận lại đơn cũ, không tạo trùng.
  const existing = await prisma.booking.findUnique({ where: { paymentRef } });
  if (existing) {
    if (existing.userId !== userId)
      return { ok: false, status: 403, error: "Không có quyền." };
    return { ok: true, existing };
  }

  const amount = await amountFor(orderFromBody(body), userId);
  if (!amount.ok)
    return {
      ok: false,
      status: amount.status,
      error: amount.error,
      conflicts: amount.conflicts,
    };

  let intent;
  try {
    intent = await getStripe().paymentIntents.retrieve(paymentRef);
  } catch {
    return {
      ok: false,
      status: 402,
      error: "Không tìm thấy giao dịch thanh toán.",
    };
  }

  const check = checkIntent(intent, { amount: amount.quote.total, userId });
  if (!check.ok) return { ok: false, status: 402, error: check.reason };

  return {
    ok: true,
    existing: null,
    totals: {
      seatTotal: amount.quote.seatTotal,
      fnbTotal: amount.quote.fnbTotal,
      serviceFee: amount.quote.serviceFee,
      totalPrice: amount.quote.total,
    },
  };
}
