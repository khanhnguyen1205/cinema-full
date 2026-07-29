import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import {
  fetchMe,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
} from "./auth";

const AUTH = "http://localhost:4000";

describe("services/auth — đăng nhập", () => {
  it("gửi email/password/remember và trả user", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${AUTH}/auth/login`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(fx.user);
      }),
    );

    const user = await loginUser("a@cinema.vn", "123456", true);

    expect(user).toEqual(fx.user);
    expect(body).toEqual({
      email: "a@cinema.vn",
      password: "123456",
      remember: true,
    });
  });

  it("gửi kèm cookie phiên (credentials: include)", async () => {
    let credentials = "";
    server.use(
      http.post(`${AUTH}/auth/login`, ({ request }) => {
        credentials = request.credentials;
        return HttpResponse.json(fx.user);
      }),
    );

    await loginUser("a@cinema.vn", "123456");
    expect(credentials).toBe("include");
  });

  it("lỗi từ server được ném ra kèm ĐÚNG thông điệp của server", async () => {
    server.use(
      http.post(`${AUTH}/auth/login`, () =>
        HttpResponse.json(
          { error: "Email hoặc mật khẩu không đúng." },
          { status: 401 },
        ),
      ),
    );

    await expect(loginUser("a@cinema.vn", "sai")).rejects.toThrow(
      "Email hoặc mật khẩu không đúng.",
    );
  });

  it("server trả lỗi không phải JSON thì dùng thông điệp dự phòng", async () => {
    server.use(
      http.post(`${AUTH}/auth/login`, () =>
        HttpResponse.text("boom", { status: 500 }),
      ),
    );

    await expect(loginUser("a@cinema.vn", "123456")).rejects.toThrow(
      "Đăng nhập thất bại.",
    );
  });
});

describe("services/auth — đăng ký", () => {
  it("trả user khi thành công", async () => {
    server.use(
      http.post(`${AUTH}/auth/register`, () =>
        HttpResponse.json(fx.user, { status: 201 }),
      ),
    );

    const user = await registerUser({
      fullName: "Người Dùng",
      email: "a@cinema.vn",
      password: "123456",
    });
    expect(user).toEqual(fx.user);
  });

  it("email trùng: ném lỗi 409 của server", async () => {
    server.use(
      http.post(`${AUTH}/auth/register`, () =>
        HttpResponse.json(
          { error: "Email này đã được đăng ký." },
          { status: 409 },
        ),
      ),
    );

    await expect(
      registerUser({ fullName: "A", email: "a@cinema.vn", password: "123456" }),
    ).rejects.toThrow("Email này đã được đăng ký.");
  });
});

describe("services/auth — đăng xuất", () => {
  it("server lỗi vẫn KHÔNG ném (mất mạng vẫn cho đăng xuất phía client)", async () => {
    server.use(
      http.post(`${AUTH}/auth/logout`, () =>
        HttpResponse.json({ error: "die" }, { status: 500 }),
      ),
    );

    await expect(logoutUser()).resolves.toBeUndefined();
  });
});

describe("services/auth — phiên", () => {
  it("refreshSession trả null khi refresh hết hạn", async () => {
    await expect(refreshSession()).resolves.toBeNull(); // handler mặc định: 401
  });

  it("fetchMe trả user khi cookie còn hạn", async () => {
    server.use(http.get(`${AUTH}/auth/me`, () => HttpResponse.json(fx.user)));
    await expect(fetchMe()).resolves.toEqual(fx.user);
  });

  it("fetchMe gặp 401 thì TỰ THỬ refresh MỘT LẦN rồi trả user", async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${AUTH}/auth/refresh`, () => {
        refreshCalls++;
        return HttpResponse.json(fx.user);
      }),
    );

    // handler mặc định của /auth/me là 401
    await expect(fetchMe()).resolves.toEqual(fx.user);
    expect(refreshCalls).toBe(1);
  });

  it("cả /me lẫn /refresh đều 401 thì trả null", async () => {
    await expect(fetchMe()).resolves.toBeNull();
  });
});
