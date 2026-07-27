import Stripe from "stripe";

// KHÔNG import ./env: env.ts throw khi thiếu DATABASE_URL, mà nhánh payments có
// unit test chạy trong job CI `checks` (không có database).
let client: Stripe | null = null;

export const publishableKey = (): string =>
  process.env.STRIPE_PUBLISHABLE_KEY || "";

// Thiếu key => tính năng thẻ tắt êm, server vẫn khởi động bình thường.
export const isStripeEnabled = (): boolean =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);

// Khởi tạo lười: chỉ dựng client khi thật sự có người gọi Stripe.
export function getStripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  return client;
}
