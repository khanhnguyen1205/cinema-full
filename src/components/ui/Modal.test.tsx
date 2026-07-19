import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "./Modal";

describe("Modal", () => {
  it("hiển thị title, role dialog, và children", () => {
    render(
      <Modal title="Sửa phim" onClose={() => {}}>
        <p>nội dung</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Sửa phim" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("nội dung")).toBeInTheDocument();
  });

  it("bấm nút Đóng gọi onClose", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="X" onClose={onClose}>
        <p>a</p>
      </Modal>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("nhấn Escape gọi onClose", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="X" onClose={onClose}>
        <p>a</p>
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
