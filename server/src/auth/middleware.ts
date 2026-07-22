import type { Request } from "express";
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
