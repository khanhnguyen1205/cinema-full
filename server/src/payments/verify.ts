// Thuần: không gọi mạng, không import Prisma/env — nhận sẵn object intent để test được.
export type IntentLike = {
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
};

export type CheckResult = { ok: true } | { ok: false; reason: string };

// Chỉ chấp nhận khi Stripe đã thu tiền, đúng số, đúng tiền tệ và đúng người mua.
export function checkIntent(
  intent: IntentLike | null | undefined,
  expected: { amount: number; userId: number },
): CheckResult {
  if (!intent)
    return { ok: false, reason: "Không tìm thấy giao dịch thanh toán." };
  if (intent.status !== "succeeded")
    return { ok: false, reason: "Giao dịch thanh toán chưa hoàn tất." };
  if (intent.amount !== expected.amount)
    return { ok: false, reason: "Số tiền thanh toán không khớp đơn hàng." };
  if ((intent.currency ?? "").toLowerCase() !== "vnd")
    return { ok: false, reason: "Đơn vị tiền tệ không hợp lệ." };
  if (Number(intent.metadata?.userId) !== expected.userId)
    return { ok: false, reason: "Giao dịch không thuộc về tài khoản này." };
  return { ok: true };
}
