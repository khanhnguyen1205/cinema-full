import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { fx } from "test/fixtures";
import { renderWithProviders } from "test/renderWithProviders";
import PrivateRoute from "./PrivateRoute";
import AdminRoute from "./AdminRoute";

// Hiện nơi vừa bị đá đi, để khẳng định chuyển hướng có giữ lại đích đến.
function LoginProbe(): ReactElement {
  const location = useLocation() as { state?: { from?: { pathname: string } } };
  return <p>login từ {location.state?.from?.pathname ?? "(không rõ)"}</p>;
}

const tree = (
  <Routes>
    <Route path="/login" element={<LoginProbe />} />
    <Route path="/" element={<p>trang chủ</p>} />
    <Route
      path="/tickets"
      element={
        <PrivateRoute>
          <p>vé của tôi</p>
        </PrivateRoute>
      }
    />
    <Route
      path="/admin"
      element={
        <AdminRoute>
          <p>bảng quản trị</p>
        </AdminRoute>
      }
    />
  </Routes>
);

describe("PrivateRoute", () => {
  it("khách bị đá về /login và GIỮ LẠI nơi định đến", async () => {
    renderWithProviders(tree, { route: "/tickets" });
    await waitFor(() =>
      expect(screen.getByText("login từ /tickets")).toBeInTheDocument(),
    );
  });

  it("đã đăng nhập thì vào được", async () => {
    renderWithProviders(tree, { route: "/tickets", user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("vé của tôi")).toBeInTheDocument(),
    );
  });
});

describe("AdminRoute", () => {
  it("khách bị đá về /login", async () => {
    renderWithProviders(tree, { route: "/admin" });
    await waitFor(() =>
      expect(screen.getByText("login từ /admin")).toBeInTheDocument(),
    );
  });

  it("user thường bị đá về trang chủ, KHÔNG phải trang đăng nhập", async () => {
    renderWithProviders(tree, { route: "/admin", user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("trang chủ")).toBeInTheDocument(),
    );
  });

  it("admin vào được", async () => {
    renderWithProviders(tree, { route: "/admin", user: fx.admin });
    await waitFor(() =>
      expect(screen.getByText("bảng quản trị")).toBeInTheDocument(),
    );
  });
});
