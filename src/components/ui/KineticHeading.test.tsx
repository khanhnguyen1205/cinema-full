import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import KineticHeading from "./KineticHeading";

describe("KineticHeading", () => {
  it("đặt aria-label = text, gom từ và tách ký tự thành span", () => {
    const { container } = render(<KineticHeading text="AB C" />);
    const root = screen.getByLabelText("AB C");
    expect(root).toHaveClass("ui-kinetic");
    // 2 từ "AB" và "C" (mỗi từ 1 nhóm nowrap, không vỡ giữa từ)
    expect(container.querySelectorAll(".ui-kinetic__word")).toHaveLength(2);
    // 3 ký tự chữ "A","B","C" (khoảng trắng là text node ngăn cách, không phải span)
    expect(container.querySelectorAll(".ui-kinetic__ch")).toHaveLength(3);
  });
});
