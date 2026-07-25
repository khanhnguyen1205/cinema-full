import i18n from "i18n";

// Nhãn hiển thị thể loại theo ngôn ngữ; fallback trả về mã gốc nếu thiếu khoá.
export function genreLabel(code: string): string {
  const key = `genres.${code}`;
  const label = i18n.t(key);
  return label === key ? code : label;
}
