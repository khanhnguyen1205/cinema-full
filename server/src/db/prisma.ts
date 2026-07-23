import { PrismaClient } from "@prisma/client";

// Một client dùng chung cho cả tiến trình (mỗi instance mở pool riêng — lãng phí).
export const prisma = new PrismaClient();
