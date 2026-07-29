import { signAccess, signRefresh } from "../auth/tokens";

// Gateway đọc user từ cookie "at" (xem auth/middleware.ts).
export const cookieFor = (id: number, role: string): string =>
  `at=${signAccess(id, role)}`;

// POST /auth/refresh đọc cookie "rt".
export const refreshCookieFor = (id: number, remember: boolean): string =>
  `rt=${signRefresh(id, remember)}`;
