import type { DbUser, SafeUser } from "../types";

export const normalizeEmail = (e?: string): string =>
  (e || "").trim().toLowerCase();

export const safeUser = (u: DbUser): SafeUser => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  role: u.role || "user",
});
