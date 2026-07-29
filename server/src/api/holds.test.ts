import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../app";
import { cookieFor } from "../test/authCookie";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});

const U2 = cookieFor(2, "user");
const U3 = cookieFor(3, "user");

afterEach(() => vi.useRealTimers());

// Kho hold là biến module sống suốt file -> mỗi test dùng showtimeId RIÊNG.
describe("holds — giữ ghế", () => {
  it("chưa đăng nhập: 401", async () => {
    const res = await request(app)
      .post("/api/holds")
      .send({ showtimeId: 9001, seats: ["A1"] });
    expect(res.status).toBe(401);
  });

  it("thiếu showtimeId: 400", async () => {
    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ seats: ["A1"] });
    expect(res.status).toBe(400);
  });

  it("giữ được ghế trống và trả về mốc hết hạn", async () => {
    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9002, seats: ["A1", "A2"] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.expiresAt).toBeGreaterThan(Date.now());
  });

  it("người khác giữ rồi: 409 kèm danh sách ghế xung đột", async () => {
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9003, seats: ["B1", "B2"] });

    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U3)
      .send({ showtimeId: 9003, seats: ["B2", "B3"] });

    expect(res.status).toBe(409);
    expect(res.body.conflicts).toEqual(["B2"]);
  });

  it("giữ lại chính ghế mình đang giữ thì KHÔNG bị coi là xung đột", async () => {
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9004, seats: ["C1"] });

    // Heartbeat: gửi lại cùng ghế + thêm ghế mới
    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9004, seats: ["C1", "C2"] });

    expect(res.status).toBe(200);
  });

  it("gửi danh sách mới sẽ THAY THẾ danh sách cũ (bỏ chọn thì nhả ghế)", async () => {
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9005, seats: ["D1", "D2"] });
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9005, seats: ["D1"] }); // bỏ D2

    // D2 phải trống cho người khác
    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U3)
      .send({ showtimeId: 9005, seats: ["D2"] });
    expect(res.status).toBe(200);
  });

  it("DELETE nhả toàn bộ ghế của mình", async () => {
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9006, seats: ["E1"] });

    const del = await request(app)
      .delete("/api/holds?showtimeId=9006")
      .set("Cookie", U2);
    expect(del.status).toBe(204);

    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U3)
      .send({ showtimeId: 9006, seats: ["E1"] });
    expect(res.status).toBe(200);
  });

  it("DELETE thiếu showtimeId: 400", async () => {
    const res = await request(app).delete("/api/holds").set("Cookie", U2);
    expect(res.status).toBe(400);
  });

  it("hold TỰ HẾT HẠN sau 8 phút", async () => {
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9007, seats: ["F1"] });

    // Tua đồng hồ hệ thống 9 phút (TTL là 8) — chỉ đổi Date.now(),
    // không đụng timer I/O của supertest.
    vi.setSystemTime(new Date(Date.now() + 9 * 60 * 1000));

    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U3)
      .send({ showtimeId: 9007, seats: ["F1"] });
    expect(res.status).toBe(200);
  });
});
