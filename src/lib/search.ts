// Lõi tìm kiếm thuần: chuẩn hoá bỏ dấu tiếng Việt + so khớp/xếp hạng.
// Không phụ thuộc React/Prisma -> test chạy không cần DB.

// Dải Combining Diacritical Marks — viết dạng \u để dấu tổ hợp không "tàng hình" trong mã nguồn.
const COMBINING_MARKS = /[\u0300-\u036f]/g;

export function normalize(s: string): string {
  return s
    .normalize("NFD") // tách dấu tổ hợp khỏi nguyên âm
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

// queryNorm ĐÃ normalize; haystack thô (hàm tự normalize). Query rỗng -> true.
export function matches(haystack: string, queryNorm: string): boolean {
  if (!queryNorm) return true;
  return normalize(haystack).includes(queryNorm);
}

// Điểm liên quan để xếp hạng kết quả.
export function scoreMatch(haystack: string, queryNorm: string): number {
  if (!queryNorm) return 0;
  const h = normalize(haystack);
  if (h === queryNorm) return 3;
  if (h.startsWith(queryNorm)) return 2;
  if (h.includes(queryNorm)) return 1;
  return 0;
}
