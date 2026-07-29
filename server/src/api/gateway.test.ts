import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../app";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";
import { cookieFor } from "../test/authCookie";

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

describe("gateway — catalog: đọc công khai, ghi chỉ admin", () => {
  it("khách GET /api/movies được 200", async () => {
    prismaMock.movie.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/movies");
    expect(res.status).toBe(200);
  });

  it("khách POST /api/movies bị 403", async () => {
    const res = await request(app).post("/api/movies").send({ title: "X" });
    expect(res.status).toBe(403);
    expect(prismaMock.movie.create).not.toHaveBeenCalled();
  });

  it("user thường POST /api/movies bị 403", async () => {
    const res = await request(app)
      .post("/api/movies")
      .set("Cookie", cookieFor(2, "user"))
      .send({ title: "X" });
    expect(res.status).toBe(403);
    expect(prismaMock.movie.create).not.toHaveBeenCalled();
  });

  it("admin POST /api/movies được 201", async () => {
    prismaMock.movie.create.mockResolvedValue({ id: 9, title: "X" });
    const res = await request(app)
      .post("/api/movies")
      .set("Cookie", cookieFor(1, "admin"))
      .send({ title: "X", duration: 100, genre: "Action" });
    expect(res.status).toBe(201);
  });

  it("admin DELETE /api/rooms/3 được 200 và thân trả {}", async () => {
    prismaMock.room.delete.mockResolvedValue({ id: 3 });
    const res = await request(app)
      .delete("/api/rooms/3")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });
});

describe("gateway — users: chỉ admin", () => {
  it("khách bị 403", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(403);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("user thường bị 403 (email + hash không được lộ)", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Cookie", cookieFor(2, "user"));
    expect(res.status).toBe(403);
  });

  it("admin được 200", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/users")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
  });
});

describe("gateway — collection lạ bị chặn mặc định", () => {
  it("GET /api/secrets bị 403 dù là admin", async () => {
    const res = await request(app)
      .get("/api/secrets")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(403);
  });
});
