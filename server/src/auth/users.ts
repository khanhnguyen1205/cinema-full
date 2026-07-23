import { prisma } from "../db/prisma";
import type { DbUser } from "../types";

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(
  id: number | string,
): Promise<DbUser | null> {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  return prisma.user.findUnique({ where: { id: n } });
}

export async function createUser(data: {
  fullName: string;
  email: string;
  password: string;
  role: string;
}): Promise<DbUser> {
  return prisma.user.create({ data });
}

export async function updateUserPassword(
  id: number,
  password: string,
): Promise<void> {
  await prisma.user.update({ where: { id }, data: { password } });
}
