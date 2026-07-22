import type { Response } from "express";
import { signAccess, signRefresh } from "./tokens";
import { REFRESH_TTL_DAYS } from "../env";

// secure:false vì localhost http (3d sẽ bật secure ở production).
const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,
  path: "/",
};

export function setAuthCookies(
  res: Response,
  user: { id: number; role?: string },
  remember: boolean,
): void {
  const access = signAccess(user.id, user.role || "user");
  const refresh = signRefresh(user.id, !!remember);
  // access: cookie phiên; JWT tự hết hạn sau 15'
  res.cookie("at", access, { ...baseCookie });
  // refresh: "ghi nhớ" => bền (maxAge), không thì cookie phiên
  res.cookie("rt", refresh, {
    ...baseCookie,
    ...(remember ? { maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000 } : {}),
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie("at", baseCookie);
  res.clearCookie("rt", baseCookie);
}
