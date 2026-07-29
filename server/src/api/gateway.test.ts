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

describe("gateway — bookings: giới hạn theo chủ sở hữu", () => {
  it("khách GET /api/bookings bị 401", async () => {
    const res = await request(app).get("/api/bookings");
    expect(res.status).toBe(401);
  });

  it("user thường chỉ thấy đơn của chính mình", async () => {
    prismaMock.booking.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/bookings")
      .set("Cookie", cookieFor(2, "user"));
    expect(res.status).toBe(200);
    expect(prismaMock.booking.findMany).toHaveBeenCalledWith({
      where: { userId: 2 },
      orderBy: { id: "asc" },
    });
  });

  it("admin thấy tất cả (không kèm bộ lọc userId)", async () => {
    prismaMock.booking.findMany.mockResolvedValue([]);
    await request(app)
      .get("/api/bookings")
      .set("Cookie", cookieFor(1, "admin"));
    expect(prismaMock.booking.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { id: "asc" },
    });
  });

  it("user thường KHÔNG đọc được đơn lẻ của người khác", async () => {
    const res = await request(app)
      .get("/api/bookings/7")
      .set("Cookie", cookieFor(2, "user"));
    expect(res.status).toBe(403);
    expect(prismaMock.booking.findUnique).not.toHaveBeenCalled();
  });

  it("POST ép userId về chính người gọi dù client gửi userId giả", async () => {
    prismaMock.booking.create.mockResolvedValue({ id: 5 });
    const res = await request(app)
      .post("/api/bookings")
      .set("Cookie", cookieFor(2, "user"))
      .send({
        userId: 999, // giả mạo
        movieId: 1,
        showtimeId: 1,
        cinemaId: 1,
        roomId: 1,
        seats: ["B3"],
        seatTypes: { standard: 1, vip: 0, couple: 0 },
        totalPrice: 105000,
      });

    expect(res.status).toBe(201);
    const arg = prismaMock.booking.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.userId).toBe(2);
  });

  it("POST không phải thẻ thì paymentRef bị tước", async () => {
    prismaMock.booking.create.mockResolvedValue({ id: 6 });
    await request(app)
      .post("/api/bookings")
      .set("Cookie", cookieFor(2, "user"))
      .send({
        paymentMethod: "counter",
        paymentRef: "pi_gia_mao",
        movieId: 1,
        showtimeId: 1,
        cinemaId: 1,
        roomId: 1,
        seats: ["B3"],
        seatTypes: { standard: 1, vip: 0, couple: 0 },
        totalPrice: 105000,
      });

    const arg = prismaMock.booking.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.paymentRef ?? null).toBeNull();
  });

  it("user thường không được PATCH đơn", async () => {
    const res = await request(app)
      .patch("/api/bookings/1")
      .set("Cookie", cookieFor(2, "user"))
      .send({ seats: ["A1"] });
    expect(res.status).toBe(403);
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("admin được DELETE đơn", async () => {
    prismaMock.booking.delete.mockResolvedValue({ id: 1 });
    const res = await request(app)
      .delete("/api/bookings/1")
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
