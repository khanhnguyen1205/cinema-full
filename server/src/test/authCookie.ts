import { signAccess } from "../auth/tokens";

// Gateway đọc user từ cookie "at" (xem auth/middleware.ts).
export const cookieFor = (id: number, role: string): string =>
  `at=${signAccess(id, role)}`;
