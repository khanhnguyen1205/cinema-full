// Thuần — KHÔNG import Prisma/env (test chạy không cần DB).
//
// Hai trường ảnh của phim là chuỗi do NGƯỜI dán vào. Trước đây không có gì kiểm:
// dán nhầm một đoạn text, một đường dẫn tương đối, hay `javascript:...` thì vẫn
// lưu thành công, và chỉ vỡ lúc có người mở đúng trang đó. Chặn ngay ở cổng để
// rác không vào được DB, kể cả khi ai đó gọi thẳng API chứ không qua form.
//
// Cố ý CHỈ kiểm dạng đường dẫn, không đi tải ảnh về: một request ghi không được
// phép treo vì máy chủ ảnh của bên thứ ba chậm. Việc "ảnh này có thật không, có
// đúng khung ngang không" thuộc về ô xem trước trong form quản trị, nơi con
// người nhìn thấy ngay.
const IMAGE_FIELDS = ["poster", "backdrop"] as const;

export type MovieImagesCheck = { ok: true } | { ok: false; message: string };

export function validateMovieImages(
  body: Record<string, unknown>,
): MovieImagesCheck {
  for (const field of IMAGE_FIELDS) {
    const value = body[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") {
      return { ok: false, message: `Trường ${field} phải là một đường dẫn.` };
    }
    // Chuỗi rỗng là hợp lệ: nghĩa là "không có ảnh", và cả hai trường đều có
    // đường lui cho trường hợp đó.
    if (value.trim() === "") continue;
    if (!/^https?:\/\/\S+$/i.test(value.trim())) {
      return {
        ok: false,
        message: `Đường dẫn ${field} phải bắt đầu bằng http:// hoặc https://`,
      };
    }
  }
  return { ok: true };
}
