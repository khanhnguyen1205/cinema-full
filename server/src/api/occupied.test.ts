import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../app";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";
import { cookieFor } from "../test/authCookie";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});

const U2 = cookieFor(2, "user");
const U3 = cookieFor(3, "user");

beforeEach(() => resetPrismaMock());

describe("occupied-seats", () => {
  it("chưa đăng nhập: 401", async () => {
    const res = await request(app).get("/api/occupied-seats?showtimeId=1");
    expect(res.status).toBe(401);
  });

  it("thiếu showtimeId: 400", async () => {
    const res = await request(app).get("/api/occupied-seats").set("Cookie", U2);
    expect(res.status).toBe(400);
  });

  it("showtimeId không phải số: 400", async () => {
    const res = await request(app)
      .get("/api/occupied-seats?showtimeId=abc")
      .set("Cookie", U2);
    expect(res.status).toBe(400);
  });

  it("hợp nhất ba nguồn: bookedSeats + ghế trong đơn + ghế người khác đang giữ", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({ bookedSeats: ["A1"] });
    prismaMock.booking.findMany.mockResolvedValue([{ seats: ["B2"] }]);

    // U3 giữ C3 -> với U2 thì C3 là ghế "người khác đang giữ"
    await request(app)
      .post("/api/holds")
      .set("Cookie", U3)
      .send({ showtimeId: 9101, seats: ["C3"] });

    const res = await request(app)
      .get("/api/occupied-seats?showtimeId=9101")
      .set("Cookie", U2);

    expect(res.status).toBe(200);
    expect([...res.body.seats].sort()).toEqual(["A1", "B2", "C3"]);
  });

  it("KHÔNG tính ghế do CHÍNH mình đang giữ (nếu không sẽ tự chặn mình)", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({ bookedSeats: [] });
    prismaMock.booking.findMany.mockResolvedValue([]);

    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9102, seats: ["D4"] });

    const res = await request(app)
      .get("/api/occupied-seats?showtimeId=9102")
      .set("Cookie", U2);

    expect(res.body.seats).toEqual([]);
  });

  it("chỉ trả số ghế, KHÔNG kèm thông tin cá nhân của đơn", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({ bookedSeats: ["A1"] });
    prismaMock.booking.findMany.mockResolvedValue([{ seats: ["B2"] }]);

    const res = await request(app)
      .get("/api/occupied-seats?showtimeId=9103")
      .set("Cookie", U2);

    expect(Object.keys(res.body).sort()).toEqual(["seats", "showtimeId"]);
    // Truy vấn cũng chỉ select đúng cột ghế.
    const arg = prismaMock.booking.findMany.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(arg.select).toEqual({ seats: true });
  });
});
