import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import { renderWithProviders } from "test/renderWithProviders";
import { useAuth } from "./AuthContext";

const AUTH = "http://localhost:4000";

function Probe(): ReactElement {
  const { user, loading, logout } = useAuth();
  if (loading) return <p>đang tải</p>;
  return (
    <div>
      <p>{user ? `chào ${user.fullName}` : "khách"}</p>
      <button onClick={() => void logout()}>Đăng xuất</button>
    </div>
  );
}

describe("AuthContext — nạp phiên", () => {
  it("hiện trạng thái đang tải rồi mới ra kết quả", async () => {
    // waitForAuth:false để quan sát chính cửa sổ đang-kiểm-tra-phiên.
    renderWithProviders(<Probe />, { waitForAuth: false });
    expect(screen.getByText("đang tải")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("khách")).toBeInTheDocument());
  });

  it("cookie còn hạn: nạp được user", async () => {
    renderWithProviders(<Probe />, { user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("chào Người Dùng")).toBeInTheDocument(),
    );
  });
});

describe("AuthContext — đăng xuất", () => {
  it("bấm đăng xuất thì user về null", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Probe />, { user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("chào Người Dùng")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));

    await waitFor(() => expect(screen.getByText("khách")).toBeInTheDocument());
  });
});

describe("AuthContext — hiệu ứng theo thời gian", () => {
  // shouldAdvanceTime: timer giả nhưng promise thật vẫn chạy tiếp. Dùng
  // vi.useFakeTimers() trần sẽ TREO vì request của MSW không bao giờ hoàn thành.
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("cứ 13 phút thì xoay token; refresh hỏng thì kết thúc phiên", async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${AUTH}/auth/refresh`, () => {
        refreshCalls++;
        return HttpResponse.json({ error: "hết hạn" }, { status: 401 });
      }),
    );

    renderWithProviders(<Probe />, { user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("chào Người Dùng")).toBeInTheDocument(),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(13 * 60 * 1000 + 100);
    });

    expect(refreshCalls).toBeGreaterThanOrEqual(1);
    await waitFor(() => expect(screen.getByText("khách")).toBeInTheDocument());
  });

  it("không thao tác 30 phút thì tự đăng xuất", async () => {
    server.use(
      http.post(`${AUTH}/auth/refresh`, () => HttpResponse.json(fx.user)),
    );

    renderWithProviders(<Probe />, { user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("chào Người Dùng")).toBeInTheDocument(),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 100);
    });

    await waitFor(() => expect(screen.getByText("khách")).toBeInTheDocument());
  });
});
