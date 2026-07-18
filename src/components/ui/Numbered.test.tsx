import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Numbered, { formatIndex } from "./Numbered";

describe("formatIndex", () => {
  it("đệm 0 tới 2 chữ số", () => {
    expect(formatIndex(1)).toBe("N°01");
    expect(formatIndex(12)).toBe("N°12");
  });
  it("số ≥100 giữ nguyên", () => {
    expect(formatIndex(100)).toBe("N°100");
  });
});

describe("Numbered", () => {
  it("render index đã định dạng", () => {
    render(<Numbered n={3} />);
    expect(screen.getByText("N°03")).toHaveClass("ui-numbered");
  });
});
