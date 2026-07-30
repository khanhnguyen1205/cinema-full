import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "./ConfirmDialog";

const setup = () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      message="Xóa phim Điện Biên Phủ?"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
};

describe("ConfirmDialog", () => {
  it("hiện hộp thoại Xác nhận kèm thông điệp", () => {
    setup();
    expect(
      screen.getByRole("dialog", { name: "Xác nhận" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Xóa phim Điện Biên Phủ?")).toBeInTheDocument();
  });

  it("bấm Xóa gọi onConfirm, không gọi onCancel", async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Xóa" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("bấm Hủy gọi onCancel", async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escape đóng hộp thoại (onCancel), không xoá nhầm", async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
