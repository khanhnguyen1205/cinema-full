import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "test/renderWithProviders";
import { fx } from "test/fixtures";
import type { User } from "types";
import Navbar from "./Navbar";

// Navbar tự điều hướng khi đăng xuất -> cần nhìn thấy đường dẫn hiện tại.
function Probe() {
  const loc = useLocation();
  return <span data-testid="path">{loc.pathname}</span>;
}

// `renderWithProviders` giữ children lại tới khi kiểm tra phiên xong (đúng như
// AppShell), nên mọi test phải chờ thanh điều hướng xuất hiện trước đã.
const setup = async (
  { user = null, route = "/" }: { user?: User | null; route?: string } = {},
  props: { back?: string } = {},
) => {
  const rendered = renderWithProviders(
    <>
      <Navbar {...props} />
      <Probe />
    </>,
    { user, route },
  );
  await screen.findByRole("navigation");
  return rendered;
};

const openAccountMenu = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Tài khoản" }));
};

describe("Navbar", () => {
  it("khách chưa đăng nhập chỉ thấy nút Đăng nhập", async () => {
    await setup();
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tài khoản" }),
    ).not.toBeInTheDocument();
  });

  it("đánh dấu link đang ở trang hiện tại", async () => {
    await setup({ route: "/movies" });
    // Mỗi link có 2 bản: thanh desktop và menu mobile.
    for (const link of screen.getAllByRole("link", { name: "Phim" }))
      expect(link).toHaveClass("is-active");
    for (const link of screen.getAllByRole("link", { name: "Trang chủ" }))
      expect(link).not.toHaveClass("is-active");
  });

  it("user thường: avatar viết tắt, menu có Vé của tôi nhưng KHÔNG có Quản trị", async () => {
    await setup({ user: fx.user });
    const avatar = await screen.findByRole("button", { name: "Tài khoản" });
    expect(avatar).toHaveTextContent("ND"); // "Người Dùng"

    await openAccountMenu();
    expect(
      screen.getByRole("link", { name: "Vé của tôi" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Quản trị" }),
    ).not.toBeInTheDocument();
  });

  it("admin thấy thêm lối vào Quản trị", async () => {
    await setup({ user: fx.admin });
    await screen.findByRole("button", { name: "Tài khoản" });
    await openAccountMenu();
    expect(screen.getByRole("link", { name: "Quản trị" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("đăng xuất: xoá phiên và đưa về trang chủ", async () => {
    await setup({ user: fx.user, route: "/tickets" });
    await screen.findByRole("button", { name: "Tài khoản" });
    await openAccountMenu();
    await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));

    expect(
      await screen.findByRole("link", { name: "Đăng nhập" }),
    ).toBeVisible();
    expect(screen.getByTestId("path")).toHaveTextContent("/");
  });

  it("click ra ngoài hoặc Escape đóng menu tài khoản", async () => {
    await setup({ user: fx.user });
    await screen.findByRole("button", { name: "Tài khoản" });

    await openAccountMenu();
    await userEvent.click(document.body);
    expect(
      screen.queryByRole("link", { name: "Vé của tôi" }),
    ).not.toBeInTheDocument();

    await openAccountMenu();
    await userEvent.keyboard("{Escape}");
    expect(
      screen.queryByRole("link", { name: "Vé của tôi" }),
    ).not.toBeInTheDocument();
  });

  it("hamburger khai báo aria-expanded/aria-controls và đóng bằng Escape", async () => {
    const { container } = await setup();
    const burger = screen.getByRole("button", { name: "Menu" });
    expect(burger).toHaveAttribute("aria-expanded", "false");
    expect(burger).toHaveAttribute("aria-controls", "nav-mobile");

    const mobile = container.querySelector("#nav-mobile");
    expect(mobile).not.toHaveClass("is-open");

    await userEvent.click(burger);
    expect(burger).toHaveAttribute("aria-expanded", "true");
    expect(mobile).toHaveClass("is-open");

    await userEvent.keyboard("{Escape}");
    expect(burger).toHaveAttribute("aria-expanded", "false");
    expect(mobile).not.toHaveClass("is-open");
  });

  it("bấm link trong menu mobile thì menu tự đóng", async () => {
    const { container } = await setup();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const mobile = container.querySelector("#nav-mobile") as HTMLElement;

    await userEvent.click(within(mobile).getByRole("link", { name: "Rạp" }));
    expect(mobile).not.toHaveClass("is-open");
    expect(screen.getByTestId("path")).toHaveTextContent("/cinemas");
  });

  it("prop back hiện nút quay lại trỏ đúng nơi", async () => {
    await setup({ route: "/seats/1" }, { back: "/movies" });
    expect(screen.getByRole("link", { name: "Quay lại" })).toHaveAttribute(
      "href",
      "/movies",
    );
  });
});
