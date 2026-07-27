import { describe, it, expect } from "vitest";
import { checkIntent } from "./verify";

const good = {
  status: "succeeded",
  amount: 165000,
  currency: "vnd",
  metadata: { userId: "2" },
};

describe("checkIntent", () => {
  it("chấp nhận giao dịch hợp lệ", () => {
    expect(checkIntent(good, { amount: 165000, userId: 2 })).toEqual({
      ok: true,
    });
  });

  it("từ chối khi không có intent", () => {
    expect(checkIntent(null, { amount: 165000, userId: 2 }).ok).toBe(false);
  });

  it("từ chối khi chưa succeeded", () => {
    const r = checkIntent(
      { ...good, status: "requires_payment_method" },
      { amount: 165000, userId: 2 },
    );
    expect(r.ok).toBe(false);
  });

  it("từ chối khi lệch số tiền", () => {
    const r = checkIntent(
      { ...good, amount: 1000 },
      { amount: 165000, userId: 2 },
    );
    expect(r.ok).toBe(false);
  });

  it("từ chối khi lệch đơn vị tiền tệ", () => {
    const r = checkIntent(
      { ...good, currency: "usd" },
      { amount: 165000, userId: 2 },
    );
    expect(r.ok).toBe(false);
  });

  it("từ chối khi giao dịch thuộc user khác", () => {
    expect(checkIntent(good, { amount: 165000, userId: 3 }).ok).toBe(false);
  });
});
