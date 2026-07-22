import { describe, it, expect } from "vitest";
import { normalizeEmail, safeUser } from "./helpers";

describe("normalizeEmail", () => {
  it("trim + lowercase", () => {
    expect(normalizeEmail("  Admin@Cinema.VN ")).toBe("admin@cinema.vn");
  });
  it("undefined -> chuỗi rỗng", () => {
    expect(normalizeEmail()).toBe("");
  });
});

describe("safeUser", () => {
  it("chỉ lộ id/fullName/email/role, không lộ password", () => {
    const out = safeUser({
      id: 2,
      fullName: "Admin",
      email: "admin@cinema.vn",
      password: "$2b$hash",
      role: "admin",
    });
    expect(out).toEqual({
      id: 2,
      fullName: "Admin",
      email: "admin@cinema.vn",
      role: "admin",
    });
    expect("password" in out).toBe(false);
  });
  it("thiếu role -> mặc định 'user'", () => {
    const out = safeUser({
      id: 3,
      fullName: "X",
      email: "x@y.z",
      password: "p",
    });
    expect(out.role).toBe("user");
  });
});
