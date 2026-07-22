import { DATA_URL } from "../env";
import type { DbUser } from "../types";

// SEAM: 3c sẽ thay ruột 4 hàm này bằng Prisma (giữ nguyên chữ ký).
export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const r = await fetch(`${DATA_URL}/users?email=${encodeURIComponent(email)}`);
  const list = (await r.json()) as DbUser[];
  return list[0] || null;
}

export async function findUserById(
  id: number | string,
): Promise<DbUser | null> {
  const r = await fetch(`${DATA_URL}/users/${id}`);
  if (!r.ok) return null;
  return (await r.json()) as DbUser;
}

export async function createUser(data: {
  fullName: string;
  email: string;
  password: string;
  role: string;
}): Promise<DbUser> {
  const r = await fetch(`${DATA_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return (await r.json()) as DbUser;
}

export async function updateUserPassword(
  id: number,
  password: string,
): Promise<void> {
  await fetch(`${DATA_URL}/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}
