import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Mock TRƯỚC khi app.ts được import (vi.mock được hoisted).
vi.mock("../db/prisma", async () => {
  const { prismaMock } = await import("../test/prismaMock");
  return { prisma: prismaMock };
});
// Email chạy ở nền sau khi đặt vé — chặn để test không chạm mạng.
vi.mock("../email/send", () => ({ sendTicketEmail: vi.fn() }));

const { app } = await import("../app");
const { prismaMock, resetPrismaMock } = await import("../test/prismaMock");

beforeEach(() => resetPrismaMock());

describe("gateway — bài thử hạ tầng", () => {
  it("GET /api/cities không cần đăng nhập và trả đúng dữ liệu", async () => {
    prismaMock.city.findMany.mockResolvedValue([{ id: 1, name: "Hà Nội" }]);

    const res = await request(app).get("/api/cities");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: "Hà Nội" }]);
    // Thứ tự id tăng dần là hợp đồng: bỏ đi thì thứ tự phim ở Home loạn.
    expect(prismaMock.city.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { id: "asc" },
    });
  });
});
