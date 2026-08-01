import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import KineticHeading from "./KineticHeading";

describe("KineticHeading", () => {
  it("đọc được nguyên văn cho trình đọc màn hình, ký tự trang trí thì ẩn", () => {
    const { container } = render(<KineticHeading text="AB C" />);

    // Chữ thật nằm TRONG DOM (ẩn khỏi mắt). KHÔNG dùng aria-label trên span
    // trần: aria-label bị cấm ở phần tử không có role, trình duyệt vứt đi và
    // trình đọc màn hình không đọc được gì (axe: aria-prohibited-attr).
    expect(screen.getByText("AB C")).toHaveClass("ui-visually-hidden");
    expect(container.querySelector(".ui-kinetic")).not.toHaveAttribute(
      "aria-label",
    );

    // 2 từ "AB" và "C" (mỗi từ 1 nhóm nowrap, không vỡ giữa từ)
    expect(container.querySelectorAll(".ui-kinetic__word")).toHaveLength(2);
    // 3 ký tự "A","B","C" (khoảng trắng là text node ngăn cách, không phải span)
    expect(container.querySelectorAll(".ui-kinetic__ch")).toHaveLength(3);
  });
});
