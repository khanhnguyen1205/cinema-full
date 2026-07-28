// Thanh toán qua cổng phân quyền (:4000/api/payments). Publishable key lấy TỪ SERVER
// (không phải biến VITE_*) nên đổi key trên Render không cần build lại image.
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "/api" : "http://localhost:4000/api");

export interface PaymentConfig {
  enabled: boolean;
  publishableKey?: string;
}

export const getPaymentConfig = (): Promise<PaymentConfig> =>
  fetch(`${BASE_URL}/payments/config`, { credentials: "include" }).then(
    (r) => r.json() as Promise<PaymentConfig>,
  );

export interface IntentPayload {
  showtimeId: number;
  seats: string[];
  concessions: { id: number; qty: number }[];
}

export interface IntentResult {
  clientSecret: string;
  amount: number;
}

export interface PaymentError extends Error {
  status?: number;
  conflicts?: string[];
}

// Server tự tính lại số tiền từ DB — client chỉ gửi ghế + id/số lượng bắp nước.
export async function createPaymentIntent(
  payload: IntentPayload,
): Promise<IntentResult> {
  const r = await fetch(`${BASE_URL}/payments/intent`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(
      data.error || "Không tạo được phiên thanh toán.",
    ) as PaymentError;
    err.status = r.status;
    err.conflicts = data.conflicts;
    throw err;
  }
  return data as IntentResult;
}
