import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { app } from "../app";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";
import { cookieFor } from "../test/authCookie";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});
vi.mock("../email/send", () => ({ sendTicketEmail: vi.fn() }));

// Đi qua gateway bằng đường catalog-admin để chạm mọi nhánh của handleRest.
const ADMIN = cookieFor(1, "admin");

beforeEach(() => resetPrismaMock());

describe("repo — hợp đồng HTTP giữ y hệt json-server", () => {
  it("GET danh sách sắp theo id tăng dần", async () => {
    prismaMock.movie.findMany.mockResolvedValue([]);
    await request(app).get("/api/movies");
    expect(prismaMock.movie.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { id: "asc" },
    });
  });

  it("GET id không tồn tại trả 404 với thân {}", async () => {
    prismaMock.movie.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/movies/404");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({});
  });

  it("GET id không phải số trả 404", async () => {
    const res = await request(app).get("/api/movies/abc");
    expect(res.status).toBe(404);
    expect(prismaMock.movie.findUnique).not.toHaveBeenCalled();
  });

  it("đường dẫn lồng sâu trả 404", async () => {
    const res = await request(app).get("/api/movies/1/reviews");
    expect(res.status).toBe(404);
  });

  it("POST trả 201", async () => {
    prismaMock.movie.create.mockResolvedValue({ id: 3 });
    const res = await request(app)
      .post("/api/movies")
      .set("Cookie", ADMIN)
      .send({ title: "A", duration: 100, genre: "Action" });
    expect(res.status).toBe(201);
  });

  it("body lọc qua whitelist: id và field rác không ghi được", async () => {
    prismaMock.movie.create.mockResolvedValue({ id: 3 });
    await request(app).post("/api/movies").set("Cookie", ADMIN).send({
      id: 999,
      title: "A",
      duration: 100,
      genre: "Action",
      hacked: true,
    });

    const data = (
      prismaMock.movie.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(data).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("hacked");
    expect(data.title).toBe("A");
  });

  it("DELETE trả {} + 200", async () => {
    prismaMock.movie.delete.mockResolvedValue({ id: 3 });
    const res = await request(app).delete("/api/movies/3").set("Cookie", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it("P2025 (sửa/xoá bản ghi không tồn tại) thành 404", async () => {
    prismaMock.movie.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("not found", {
        code: "P2025",
        clientVersion: "6",
      }),
    );
    const res = await request(app)
      .patch("/api/movies/77")
      .set("Cookie", ADMIN)
      .send({ title: "B" });
    expect(res.status).toBe(404);
  });

  it("P2002 (trùng khoá duy nhất) thành 409", async () => {
    prismaMock.movie.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "6",
      }),
    );
    const res = await request(app)
      .post("/api/movies")
      .set("Cookie", ADMIN)
      .send({ title: "A", duration: 100, genre: "Action" });
    expect(res.status).toBe(409);
  });

  it("P2003 (đang bị tham chiếu) thành 409", async () => {
    prismaMock.movie.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", {
        code: "P2003",
        clientVersion: "6",
      }),
    );
    const res = await request(app).delete("/api/movies/1").set("Cookie", ADMIN);
    expect(res.status).toBe(409);
  });

  it("lọc theo query được ép kiểu số", async () => {
    prismaMock.showtime.findMany.mockResolvedValue([]);
    await request(app).get("/api/showtimes?movieId=2");
    expect(prismaMock.showtime.findMany).toHaveBeenCalledWith({
      where: { movieId: 2 },
      orderBy: { id: "asc" },
    });
  });

  it("query không nằm trong danh sách lọc được bị bỏ qua", async () => {
    prismaMock.movie.findMany.mockResolvedValue([]);
    await request(app).get("/api/movies?title=A");
    expect(prismaMock.movie.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { id: "asc" },
    });
  });
});
