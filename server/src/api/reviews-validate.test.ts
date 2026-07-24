import { describe, it, expect } from "vitest";
import { validateReviewInput, ownerOrAdmin } from "./reviews-validate";

describe("validateReviewInput", () => {
  it("nhận rating 1..5 + comment tùy chọn", () => {
    expect(validateReviewInput({ rating: 5 })).toEqual({ ok: true, rating: 5 });
    expect(validateReviewInput({ rating: 3, comment: "ổn" })).toEqual({
      ok: true,
      rating: 3,
      comment: "ổn",
    });
  });
  it("từ chối rating ngoài 1..5 hoặc không nguyên", () => {
    expect(validateReviewInput({ rating: 0 }).ok).toBe(false);
    expect(validateReviewInput({ rating: 6 }).ok).toBe(false);
    expect(validateReviewInput({ rating: 3.5 }).ok).toBe(false);
    expect(validateReviewInput({}).ok).toBe(false);
  });
  it("từ chối comment quá 500 ký tự", () => {
    expect(
      validateReviewInput({ rating: 4, comment: "a".repeat(501) }).ok,
    ).toBe(false);
  });
  it("bỏ comment rỗng/whitespace (coi như không có)", () => {
    expect(validateReviewInput({ rating: 4, comment: "   " })).toEqual({
      ok: true,
      rating: 4,
    });
  });
});

describe("ownerOrAdmin", () => {
  it("true cho chủ sở hữu", () => {
    expect(ownerOrAdmin(7, { id: 7, role: "user" })).toBe(true);
  });
  it("true cho admin dù không phải chủ", () => {
    expect(ownerOrAdmin(7, { id: 2, role: "admin" })).toBe(true);
  });
  it("false cho user khác / chưa đăng nhập", () => {
    expect(ownerOrAdmin(7, { id: 3, role: "user" })).toBe(false);
    expect(ownerOrAdmin(7, null)).toBe(false);
  });
});
