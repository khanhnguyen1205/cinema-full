import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { http, HttpResponse, delay } from "msw";
import { renderWithProviders } from "test/renderWithProviders";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import Login from "./Login";

const AUTH = "http://localhost:4000";

function Probe() {
  const loc = useLocation();
  return (
    <>
      <span data-testid="path">{loc.pathname}</span>
      <span data-testid="state">{JSON.stringify(loc.state)}</span>
    </>
  );
}

// Ghi lại mọi thân request gửi tới /auth/login để khẳng định "không gọi API"
// và kiểm cờ `remember` — vẫn để handler mặc định xử lý phần trả lời.
let sent: Array<{ email: string; password: string; remember: boolean }>;
beforeEach(() => {
  sent = [];
  server.use(
    http.post(`${AUTH}/auth/login`, async ({ request }) => {
      const body = (await request.clone().json()) as (typeof sent)[number];
      sent.push(body);
      return undefined; // rơi xuống handler mặc định trong handlers.ts
    }),
  );
});

const setup = async (state?: unknown) => {
  const r = renderWithProviders(
    <>
      <Login />
      <Probe />
    </>,
    { route: "/login", state },
  );
  // waitForAuth: children chỉ hiện sau khi kiểm tra phiên xong.
  await screen.findByRole("button", { name: "Đăng nhập" });
  return r;
};

const fill = async (email: string, password: string) => {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Mật khẩu"), password);
};

const submit = () =>
  userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

describe("Login", () => {
  it("bỏ trống ô nào cũng báo lỗi ngay, không gọi API", async () => {
    await setup();
    await userEvent.type(screen.getByLabelText("Email"), "a@cinema.vn");
    await submit();

    expect(
      await screen.findByText("Vui lòng nhập đầy đủ thông tin."),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
    expect(screen.getByTestId("path")).toHaveTextContent("/login");
  });

  it("sai mật khẩu thì hiện đúng thông điệp của server", async () => {
    await setup();
    await fill(fx.user.email, "sai-mat-khau");
    await submit();

    expect(
      await screen.findByText("Email hoặc mật khẩu không đúng."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/login");
  });

  it("đăng nhập đúng thì gửi kèm remember=true (mặc định có tick)", async () => {
    await setup();
    await fill(fx.user.email, "123456");
    await submit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      email: fx.user.email,
      password: "123456",
      remember: true,
    });
  });

  it("bỏ tick ghi nhớ thì gửi remember=false", async () => {
    await setup();
    await userEvent.click(screen.getByLabelText("Ghi nhớ đăng nhập"));
    await fill(fx.user.email, "123456");
    await submit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].remember).toBe(false);
  });

  it("không có state.from thì về trang chủ sau khi đăng nhập", async () => {
    await setup();
    await fill(fx.user.email, "123456");
    await submit();

    await waitFor(() =>
      expect(screen.getByTestId("path")).toHaveTextContent("/"),
    );
  });

  it("có state.from thì quay lại đúng trang người dùng định vào", async () => {
    await setup({ from: { pathname: "/tickets" } });
    await fill(fx.user.email, "123456");
    await submit();

    await waitFor(() =>
      expect(screen.getByTestId("path")).toHaveTextContent("/tickets"),
    );
  });

  it("khoá nút submit trong lúc đang gửi (chặn bấm hai lần)", async () => {
    server.use(
      http.post(`${AUTH}/auth/login`, async () => {
        await delay(50);
        return HttpResponse.json(fx.user);
      }),
    );
    await setup();
    await fill(fx.user.email, "123456");
    // Giữ tham chiếu TRƯỚC khi bấm: lúc đang gửi, nhãn nút bị thay bằng vòng
    // xoay nên không tìm lại được bằng tên "Đăng nhập".
    const btn = screen.getByRole("button", { name: "Đăng nhập" });
    await userEvent.click(btn);

    expect(btn).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByTestId("path")).toHaveTextContent("/"),
    );
  });

  it("nút con mắt đổi kiểu ô mật khẩu và đổi nhãn trợ năng", async () => {
    await setup();
    const input = screen.getByLabelText("Mật khẩu");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(
      screen.getByRole("button", { name: "Hiện mật khẩu" }),
    );
    expect(input).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Ẩn mật khẩu" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("link sang đăng ký mang theo nơi người dùng định đến", async () => {
    await setup({ from: { pathname: "/tickets" } });
    await userEvent.click(screen.getByRole("link", { name: "Đăng ký ngay" }));

    expect(screen.getByTestId("path")).toHaveTextContent("/register");
    expect(screen.getByTestId("state")).toHaveTextContent(
      JSON.stringify({ from: { pathname: "/tickets" } }),
    );
  });
});
