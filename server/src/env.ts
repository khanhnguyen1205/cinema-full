import "dotenv/config"; // nạp .env trước khi đọc process.env

export const PORT = Number(process.env.AUTH_PORT) || 4000;
export const DATA_URL = process.env.DATA_URL || "http://localhost:9999";
export const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

// Dev only: giữ bí mật trong env ở production. Đổi secret => mọi phiên cũ hết hiệu lực.
const DEFAULT_SECRET = "cinema-dev-secret-change-me";
export const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
if (JWT_SECRET === DEFAULT_SECRET) {
  const msg =
    "[auth] Đang dùng JWT_SECRET mặc định — chỉ chấp nhận khi dev. Đặt JWT_SECRET trong .env cho production.";
  if (process.env.NODE_ENV === "production") throw new Error(msg);
  console.warn(msg);
}

export const ACCESS_TTL = "15m"; // token truy cập ngắn hạn
export const REFRESH_TTL_DAYS = 7; // hạn tuyệt đối của phiên
export const REFRESH_TTL = `${REFRESH_TTL_DAYS}d`;
export const HOLD_TTL_MS = 8 * 60 * 1000; // 8 phút — khớp đồng hồ giữ ghế client
