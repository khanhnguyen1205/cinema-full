import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InstallButton from "./InstallButton";

// `hooks/useInstallPrompt` giữ sự kiện trong một store CẤP MODULE -> trạng thái
// rò từ test này sang test khác. `appinstalled` là cách app tự xoá nó, nên dùng
// chính nó để reset thay vì đụng vào mã sản phẩm.
const reset = () => act(() => window.dispatchEvent(new Event("appinstalled")));
afterEach(reset);

function fireInstallable() {
  const e = new Event("beforeinstallprompt") as Event & {
    prompt: () => Promise<void>;
  };
  e.prompt = vi.fn().mockResolvedValue(undefined);
  act(() => window.dispatchEvent(e));
  return e;
}

describe("InstallButton", () => {
  it("không render gì khi trình duyệt chưa mời cài đặt", () => {
    reset();
    const { container } = render(<InstallButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("hiện nút sau beforeinstallprompt và biến mất khi đã cài", async () => {
    reset();
    render(<InstallButton />);
    fireInstallable();
    expect(
      await screen.findByRole("button", { name: "Cài đặt ứng dụng" }),
    ).toBeInTheDocument();

    reset();
    expect(
      screen.queryByRole("button", { name: "Cài đặt ứng dụng" }),
    ).not.toBeInTheDocument();
  });

  it("bấm nút gọi prompt() của sự kiện đã bắt được", async () => {
    reset();
    render(<InstallButton />);
    const e = fireInstallable();
    await userEvent.click(
      screen.getByRole("button", { name: "Cài đặt ứng dụng" }),
    );
    expect(e.prompt).toHaveBeenCalledOnce();
  });

  it("nối className truyền vào (bản desktop bị ẩn ở mobile)", () => {
    reset();
    render(<InstallButton className="install-k--desktop" />);
    fireInstallable();
    expect(
      screen.getByRole("button", { name: "Cài đặt ứng dụng" }),
    ).toHaveClass("install-k", "install-k--desktop");
  });
});
