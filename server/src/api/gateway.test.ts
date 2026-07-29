import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../app";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";

// vi.mock được hoist LÊN TRÊN mọi import, nên app.ts nhận prisma giả.
// Factory dùng dynamic import (không phải biến ngoài) để tránh lỗi truy cập
// trước khởi tạo; module trả về vẫn là đúng instance mà file này import tĩnh.
vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});
// Email chạy ở nền sau khi đặt vé — chặn để test không chạm mạng.
vi.mock("../email/send", () => ({ sendTicketEmail: vi.fn() }));

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
