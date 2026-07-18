import { describe, it, expect } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("nối các class truthy bằng khoảng trắng", () => {
    expect(cx("a", "b", "c")).toBe("a b c");
  });
  it("bỏ qua false/null/undefined/rỗng", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });
  it("không tham số -> chuỗi rỗng", () => {
    expect(cx()).toBe("");
  });
});
