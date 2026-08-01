import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { http } from "msw";
import { renderWithProviders } from "test/renderWithProviders";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import Register from "./Register";

const AUTH = "http://localhost:4000";

function Probe() {
  const loc = useLocation();
  return <span data-testid="path">{loc.pathname}</span>;
}

// Ghi lại thân request để khẳng định "kiểm tra phía client chặn trước khi gọi API".
let sent: Array<{ fullName: string; email: string; password: string }>;
beforeEach(() => {
  sent = [];
  server.use(
    http.post(`${AUTH}/auth/register`, async ({ request }) => {
      sent.push((await request.clone().json()) as (typeof sent)[number]);
      return undefined; // rơi xuống handler mặc định trong handlers.ts
    }),
  );
});

const setup = async (state?: unknown) => {
  const r = renderWithProviders(
    <>
      <Register />
      <Probe />
    </>,
    { route: "/register", state },
  );
  await screen.findByRole("button", { name: "Tạo tài khoản" });
  return r;
};

const fill = async (over: Partial<Record<string, string>> = {}) => {
  const v = {
    name: "Người Mới",
    email: "moi@cinema.vn",
    password: "123456",
    confirm: "123456",
    ...over,
  };
  await userEvent.type(screen.getByLabelText("Họ và tên"), v.name);
  await userEvent.type(screen.getByLabelText("Email"), v.email);
  await userEvent.type(screen.getByLabelText("Mật khẩu"), v.password);
  await userEvent.type(screen.getByLabelText("Xác nhận mật khẩu"), v.confirm);
};

const submit = () =>
  userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

describe("Register", () => {
  it("thiếu trường thì báo lỗi, không gọi API", async () => {
    await setup();
    await userEvent.type(screen.getByLabelText("Họ và tên"), "Người Mới");
    await submit();

    expect(
      await screen.findByText("Vui lòng nhập đầy đủ thông tin."),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it("mật khẩu dưới 6 ký tự thì báo lỗi, không gọi API", async () => {
    await setup();
    await fill({ password: "123", confirm: "123" });
    await submit();

    expect(
      await screen.findByText("Mật khẩu phải có ít nhất 6 ký tự."),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it("xác nhận không khớp thì báo lỗi, không gọi API", async () => {
    await setup();
    await fill({ confirm: "654321" });
    await submit();

    expect(
      await screen.findByText("Mật khẩu xác nhận không khớp."),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it("đăng ký thành công thì gửi đúng thông tin rồi quay lại nơi định đến", async () => {
    await setup({ from: { pathname: "/tickets" } });
    await fill();
    await submit();

    await waitFor(() => expect(sent).toHaveLength(1));
    // Ô "xác nhận" chỉ để kiểm tra phía client, không gửi lên server.
    expect(sent[0]).toEqual({
      fullName: "Người Mới",
      email: "moi@cinema.vn",
      password: "123456",
    });
    await waitFor(() =>
      expect(screen.getByTestId("path")).toHaveTextContent("/tickets"),
    );
  });

  it("email đã tồn tại thì hiện thông điệp của server và ở lại trang", async () => {
    await setup();
    await fill({ email: fx.user.email });
    await submit();

    expect(
      await screen.findByText("Email đã được sử dụng."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/register");
  });

  it("link sang đăng nhập mang theo nơi người dùng định đến", async () => {
    await setup({ from: { pathname: "/tickets" } });
    await userEvent.click(screen.getByRole("link", { name: "Đăng nhập" }));

    expect(screen.getByTestId("path")).toHaveTextContent("/login");
  });
});
