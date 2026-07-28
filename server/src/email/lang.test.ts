import { describe, it, expect } from "vitest";
import { pickLang } from "./lang";

describe("pickLang", () => {
  it("nhận 'en' -> en", () => {
    expect(pickLang("en")).toBe("en");
  });

  it("nhận 'en-US' -> en (i18next có thể trả mã vùng)", () => {
    expect(pickLang("en-US")).toBe("en");
  });

  it("thiếu header hoặc giá trị lạ -> vi (mặc định của app)", () => {
    expect(pickLang(undefined)).toBe("vi");
    expect(pickLang("")).toBe("vi");
    expect(pickLang("fr")).toBe("vi");
    expect(pickLang("vi")).toBe("vi");
  });

  it("header dạng mảng -> lấy phần tử đầu", () => {
    expect(pickLang(["en", "vi"])).toBe("en");
  });
});
