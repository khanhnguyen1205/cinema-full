import type { Request, Response } from "express";
import { verifyToken } from "./tokens";
import type { ReqUser } from "../types";

// Đọc user từ access cookie (không ném lỗi nếu thiếu/hết hạn -> trả null).
export function getUserFromReq(req: Request): ReqUser | null {
  const t = req.cookies?.at as string | undefined;
  if (!t) return null;
  try {
    const p = verifyToken(t);
    return { id: Number(p.sub), role: p.role as string };
  } catch {
    return null;
  }
}

// Route bắt buộc đăng nhập: trả user, hoặc TỰ trả 401 rồi trả null để nơi gọi
// `if (!user) return;`. Gom đúng một chỗ status + câu thông báo cho mọi route.
export function requireUser(req: Request, res: Response): ReqUser | null {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Vui lòng đăng nhập." });
    return null;
  }
  return user;
}
