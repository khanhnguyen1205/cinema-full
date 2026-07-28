// Thuần — KHÔNG import Prisma/env/resend: unit test của file này chạy trong job CI
// `checks` vốn không có database.
export type Lang = "vi" | "en";

// Client gửi header `x-lang` lấy từ i18n.language. Mọi giá trị khác đều rơi về "vi"
// (khớp fallbackLng trong src/i18n/index.ts).
export function pickLang(header?: string | string[]): Lang {
  const raw = Array.isArray(header) ? header[0] : header;
  return String(raw || "")
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "vi";
}
