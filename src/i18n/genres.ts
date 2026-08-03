import i18n from "i18n";

// Tập mã thể loại hợp lệ — đúng bằng tập khoá `genres.*` trong vi.json/en.json.
// Đây là NGUỒN SỰ THẬT DUY NHẤT: form quản trị đổ select từ đây thay vì cho gõ
// tay. Gõ tay là gõ sai, mà gõ sai thì phim lặng lẽ biến khỏi bộ lọc thể loại
// và hiện nguyên mã thô trên thẻ phim, không có gì báo lỗi.
// Thêm thể loại mới: thêm vào đây VÀ vào khối `genres` của cả hai file dịch.
export const GENRE_CODES = [
  "Action",
  "Animation",
  "Comedy",
  "Crime",
  "Drama",
  "Horror",
  "Romance",
  "Sci-Fi",
] as const;

// Nhãn hiển thị thể loại theo ngôn ngữ; fallback trả về mã gốc nếu thiếu khoá.
export function genreLabel(code: string): string {
  const key = `genres.${code}`;
  const label = i18n.t(key);
  return label === key ? code : label;
}
