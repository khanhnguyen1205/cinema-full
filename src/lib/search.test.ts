import { describe, it, expect } from "vitest";
import { normalize, matches, scoreMatch } from "./search";

describe("normalize", () => {
  it("bỏ dấu mọi nguyên âm tiếng Việt", () => {
    expect(normalize("Điện Biên Phủ")).toBe("dien bien phu");
    expect(normalize("Ầ Ế Ộ Ữ Ỳ")).toBe("a e o u y");
  });
  it("đ/Đ -> d", () => {
    expect(normalize("ĐÀ NẴNG")).toBe("da nang");
  });
  it("hạ thường + trim", () => {
    expect(normalize("  Avengers: ENDGAME  ")).toBe("avengers: endgame");
  });
  it("chuỗi rỗng", () => {
    expect(normalize("")).toBe("");
  });
});

describe("matches", () => {
  it("khớp không dấu", () => {
    expect(matches("Điện Biên", normalize("dien"))).toBe(true);
  });
  it("không khớp", () => {
    expect(matches("Avengers", normalize("xyz"))).toBe(false);
  });
  it("query rỗng -> true", () => {
    expect(matches("bất kỳ", "")).toBe(true);
  });
});

describe("scoreMatch", () => {
  it("khớp nguyên = 3", () => {
    expect(scoreMatch("Avengers", normalize("avengers"))).toBe(3);
  });
  it("bắt đầu bằng = 2", () => {
    expect(scoreMatch("Avengers Endgame", normalize("avengers"))).toBe(2);
  });
  it("chứa = 1", () => {
    expect(scoreMatch("The Avengers", normalize("avengers"))).toBe(1);
  });
  it("không khớp = 0", () => {
    expect(scoreMatch("Frozen", normalize("avengers"))).toBe(0);
  });
});
