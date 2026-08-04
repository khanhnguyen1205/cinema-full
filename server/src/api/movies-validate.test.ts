import { describe, it, expect } from "vitest";
import { validateMovieImages } from "./movies-validate";

describe("validateMovieImages", () => {
  it("chấp nhận đường dẫn http/https", () => {
    expect(
      validateMovieImages({
        poster: "https://cdn.vn/p.jpg",
        backdrop: "http://cdn.vn/b.jpg",
      }),
    ).toEqual({ ok: true });
  });

  it("chấp nhận trường vắng mặt hoặc để trống — cả hai đều có đường lui", () => {
    expect(validateMovieImages({ title: "X" })).toEqual({ ok: true });
    expect(validateMovieImages({ backdrop: "" })).toEqual({ ok: true });
    expect(validateMovieImages({ backdrop: "   " })).toEqual({ ok: true });
    expect(validateMovieImages({ poster: null })).toEqual({ ok: true });
  });

  it("từ chối chuỗi không phải đường dẫn", () => {
    const r = validateMovieImages({ backdrop: "anh-nen.jpg" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/http/);
  });

  it("từ chối đường dẫn tương đối và giao thức lạ", () => {
    expect(validateMovieImages({ poster: "/img/p.jpg" }).ok).toBe(false);
    expect(validateMovieImages({ poster: "javascript:alert(1)" }).ok).toBe(
      false,
    );
    expect(validateMovieImages({ poster: "ftp://x/p.jpg" }).ok).toBe(false);
  });

  it("từ chối giá trị không phải chuỗi", () => {
    expect(validateMovieImages({ backdrop: 42 }).ok).toBe(false);
    expect(validateMovieImages({ poster: { url: "x" } }).ok).toBe(false);
  });

  it("chỉ soi hai trường ảnh, không đụng trường khác", () => {
    expect(validateMovieImages({ title: "Không phải URL" })).toEqual({
      ok: true,
    });
  });
});
