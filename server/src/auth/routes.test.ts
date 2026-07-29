import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";
import { cookieFor, refreshCookieFor } from "../test/authCookie";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});

const USER = {
  id: 2,
  fullName: "Người Dùng",
  email: "a@cinema.vn",
  role: "user",
};

beforeEach(() => resetPrismaMock());

describe("auth — đăng ký", () => {
  it("thiếu thông tin bị 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "x@y.z" });
    expect(res.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("mật khẩu dưới 6 ký tự bị 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ fullName: "A", email: "x@y.z", password: "123" });
    expect(res.status).toBe(400);
  });

  it("email đã tồn tại bị 409", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: "h" });
    const res = await request(app)
      .post("/auth/register")
      .send({ fullName: "A", email: "a@cinema.vn", password: "123456" });
    expect(res.status).toBe(409);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("đăng ký thành công: 201, mật khẩu ĐƯỢC HASH, thân KHÔNG chứa mật khẩu", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ ...USER, password: "hashed" });

    const res = await request(app).post("/auth/register").send({
      fullName: "Người Dùng",
      email: "A@Cinema.VN ",
      password: "123456",
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(USER);
    expect(res.body.password).toBeUndefined();

    const arg = prismaMock.user.create.mock.calls[0][0] as {
      data: Record<string, string>;
    };
    // Email được chuẩn hoá (trim + lowercase) và mật khẩu không bao giờ lưu thô.
    expect(arg.data.email).toBe("a@cinema.vn");
    expect(arg.data.password).not.toBe("123456");
    expect(arg.data.password.startsWith("$2")).toBe(true);
  });

  it("đăng ký xong có cookie phiên httpOnly", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ ...USER, password: "hashed" });

    const res = await request(app)
      .post("/auth/register")
      .send({ fullName: "A", email: "x@y.z", password: "123456" });

    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(
      cookies.some((c) => c.startsWith("at=") && /HttpOnly/i.test(c)),
    ).toBe(true);
    expect(
      cookies.some((c) => c.startsWith("rt=") && /HttpOnly/i.test(c)),
    ).toBe(true);
  });
});

describe("auth — đăng nhập", () => {
  it("email không tồn tại: 401 với thông báo CHUNG CHUNG", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "khong@co.vn", password: "123456" });
    expect(res.status).toBe(401);
    // Không được tiết lộ email có tồn tại hay không.
    expect(res.body.error).toBe("Email hoặc mật khẩu không đúng.");
  });

  it("sai mật khẩu: 401 cùng thông báo đó", async () => {
    const hash = await bcrypt.hash("dung-mat-khau", 10);
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: hash });
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@cinema.vn", password: "sai-mat-khau" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Email hoặc mật khẩu không đúng.");
  });

  it("đúng mật khẩu: 200 + user an toàn + cookie", async () => {
    const hash = await bcrypt.hash("123456", 10);
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: hash });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@cinema.vn", password: "123456" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(USER);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("remember=true thì cookie refresh có Max-Age (không phải cookie phiên)", async () => {
    const hash = await bcrypt.hash("123456", 10);
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: hash });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@cinema.vn", password: "123456", remember: true });

    const cookies = res.headers["set-cookie"] as unknown as string[];
    const rt = cookies.find((c) => c.startsWith("rt="))!;
    expect(rt).toMatch(/Max-Age=/i);
  });

  it("mật khẩu thô kiểu seed cũ được TỰ NÂNG CẤP sang bcrypt", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...USER,
      password: "123456", // plaintext, không bắt đầu bằng $2
    });
    prismaMock.user.update.mockResolvedValue({ ...USER });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@cinema.vn", password: "123456" });

    expect(res.status).toBe(200);
    const arg = prismaMock.user.update.mock.calls[0][0] as {
      data: { password: string };
    };
    expect(arg.data.password.startsWith("$2")).toBe(true);
  });
});

describe("auth — /me", () => {
  it("không cookie: 401", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("cookie hỏng: 401", async () => {
    const res = await request(app).get("/auth/me").set("Cookie", "at=rac");
    expect(res.status).toBe(401);
  });

  it("cookie hợp lệ: trả user an toàn (không có mật khẩu)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: "h" });
    const res = await request(app)
      .get("/auth/me")
      .set("Cookie", cookieFor(2, "user"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(USER);
    expect(res.body.password).toBeUndefined();
  });

  it("user đã bị xoá khỏi DB: 401 dù token còn hạn", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get("/auth/me")
      .set("Cookie", cookieFor(2, "user"));
    expect(res.status).toBe(401);
  });
});

describe("auth — /refresh", () => {
  it("không cookie rt: 401", async () => {
    const res = await request(app).post("/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("rt hợp lệ: cấp cookie mới + trả user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: "h" });
    const res = await request(app)
      .post("/auth/refresh")
      .set("Cookie", refreshCookieFor(2, false));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(USER);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rt của user đã bị xoá: 401", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post("/auth/refresh")
      .set("Cookie", refreshCookieFor(2, false));
    expect(res.status).toBe(401);
  });
});

describe("auth — /logout", () => {
  it("trả 204 và xoá cả hai cookie", async () => {
    const res = await request(app).post("/auth/logout");
    expect(res.status).toBe(204);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    // clearCookie => Set-Cookie với giá trị rỗng + Expires quá khứ
    expect(cookies.some((c) => c.startsWith("at="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("rt="))).toBe(true);
  });
});

// ⚠️ KHỐI NÀY PHẢI Ở CUỐI FILE. loginLimiter đếm theo IP và giữ trạng thái suốt
// file; sau khi nó chạm ngưỡng, MỌI request /auth/login sau đó đều bị 429 —
// kể cả request lẽ ra đăng nhập đúng.
describe("auth — chống dò mật khẩu (đặt cuối file, xem chú thích)", () => {
  it("quá 10 lần SAI trong cửa sổ thì bị 429", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null); // luôn sai

    let last = 0;
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "a@cinema.vn", password: "sai" });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
