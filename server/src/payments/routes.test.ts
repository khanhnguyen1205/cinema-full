import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../app";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";
import { cookieFor } from "../test/authCookie";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});

// Không chạm mạng Stripe. create/retrieve do từng test cài giá trị.
const stripeMock = {
  paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
};
vi.mock("./stripe", () => ({
  isStripeEnabled: vi.fn(() => true),
  publishableKey: vi.fn(() => "pk_test_gia"),
  getStripe: vi.fn(() => stripeMock),
}));

const U2 = cookieFor(2, "user");

// Phòng không có hàng VIP/đôi -> mọi ghế đều là ghế thường.
const ROOM = { id: 1, vipRows: [], coupleRows: [] };
const SHOWTIME = { id: 1, roomId: 1, price: 90000, bookedSeats: [] };

beforeEach(() => {
  resetPrismaMock();
  stripeMock.paymentIntents.create.mockReset();
  stripeMock.paymentIntents.retrieve.mockReset();
});

describe("payments — /config", () => {
  it("công khai, trả publishable key nhưng KHÔNG BAO GIỜ secret key", async () => {
    const res = await request(app).get("/api/payments/config");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: true, publishableKey: "pk_test_gia" });
    expect(JSON.stringify(res.body)).not.toContain("sk_");
  });
});

describe("payments — /intent", () => {
  it("chưa đăng nhập: 401", async () => {
    const res = await request(app)
      .post("/api/payments/intent")
      .send({ showtimeId: 1, seats: ["B3"] });
    expect(res.status).toBe(401);
  });

  it("không có ghế: 400", async () => {
    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({ showtimeId: 1, seats: [] });
    expect(res.status).toBe(400);
  });

  it("quá 8 ghế: 400", async () => {
    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({
        showtimeId: 1,
        seats: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9"],
      });
    expect(res.status).toBe(400);
  });

  it("suất không tồn tại: 404", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({ showtimeId: 999, seats: ["B3"] });
    expect(res.status).toBe(404);
  });

  it("ghế đã bán: 409 kèm conflicts, và KHÔNG tạo giao dịch", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({
      ...SHOWTIME,
      bookedSeats: ["B3"],
    });
    prismaMock.room.findUnique.mockResolvedValue(ROOM);
    prismaMock.booking.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({ showtimeId: 1, seats: ["B3"] });

    expect(res.status).toBe(409);
    expect(res.body.conflicts).toEqual(["B3"]);
    expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("SỐ TIỀN do server tính từ DB, không lấy số client gửi", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue(SHOWTIME);
    prismaMock.room.findUnique.mockResolvedValue(ROOM);
    prismaMock.booking.findMany.mockResolvedValue([]);
    prismaMock.concession.findMany.mockResolvedValue([]);
    stripeMock.paymentIntents.create.mockResolvedValue({
      client_secret: "cs_test_1",
      amount: 105000,
    });

    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({
        showtimeId: 1,
        seats: ["B3"],
        concessions: [],
        amount: 1, // client cố tình gửi 1 đồng
        totalPrice: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBe("cs_test_1");
    // 90.000 (ghế thường) + 15.000 (phí dịch vụ) = 105.000. VND zero-decimal:
    // KHÔNG nhân 100.
    const arg = stripeMock.paymentIntents.create.mock.calls[0][0] as {
      amount: number;
      currency: string;
      payment_method_types: string[];
      metadata: Record<string, string>;
    };
    expect(arg.amount).toBe(105000);
    expect(arg.currency).toBe("vnd");
    // Ghim thẻ: phương thức chuyển hướng sẽ rời SPA = mất vé.
    expect(arg.payment_method_types).toEqual(["card"]);
    expect(arg.metadata.userId).toBe("2");
  });

  it("giá bắp nước LẤY TỪ DB, không lấy giá client gửi", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue(SHOWTIME);
    prismaMock.room.findUnique.mockResolvedValue(ROOM);
    prismaMock.booking.findMany.mockResolvedValue([]);
    prismaMock.concession.findMany.mockResolvedValue([{ id: 1, price: 45000 }]);
    stripeMock.paymentIntents.create.mockResolvedValue({
      client_secret: "cs_test_2",
      amount: 150000,
    });

    await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({
        showtimeId: 1,
        seats: ["B3"],
        concessions: [{ id: 1, qty: 1, price: 1 }], // giá bịa
      });

    const arg = stripeMock.paymentIntents.create.mock.calls[0][0] as {
      amount: number;
    };
    // 90.000 + 45.000 (giá thật trong DB) + 15.000 = 150.000
    expect(arg.amount).toBe(150000);
  });

  it("Stripe lỗi: 502, không làm sập server", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue(SHOWTIME);
    prismaMock.room.findUnique.mockResolvedValue(ROOM);
    prismaMock.booking.findMany.mockResolvedValue([]);
    prismaMock.concession.findMany.mockResolvedValue([]);
    stripeMock.paymentIntents.create.mockRejectedValue(new Error("stripe die"));

    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({ showtimeId: 1, seats: ["B3"] });

    expect(res.status).toBe(502);
  });
});
