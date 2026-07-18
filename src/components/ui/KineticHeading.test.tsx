import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import KineticHeading from "./KineticHeading";

describe("KineticHeading", () => {
  it("đặt aria-label = text và tách ký tự thành span", () => {
    const { container } = render(<KineticHeading text="AB C" />);
    const root = screen.getByLabelText("AB C");
    expect(root).toHaveClass("ui-kinetic");
    // 4 ký tự "A","B"," ","C"
    expect(container.querySelectorAll(".ui-kinetic__ch")).toHaveLength(4);
  });
});
