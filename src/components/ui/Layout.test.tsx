import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Container, Section, Grid } from "./index";

describe("layout", () => {
  it("Container bọc children", () => {
    render(<Container>x</Container>);
    expect(screen.getByText("x")).toHaveClass("ui-container");
  });

  it("Section hiển thị label và index", () => {
    render(
      <Section label="Đang chiếu" index={1}>
        <p>body</p>
      </Section>,
    );
    expect(screen.getByText("Đang chiếu")).toHaveClass("ui-section__label");
    expect(screen.getByText("N°01")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("Grid đặt biến --grid-min", () => {
    const { container } = render(<Grid min="180px">g</Grid>);
    const grid = container.querySelector(".ui-grid");
    expect(grid?.getAttribute("style")).toContain("--grid-min: 180px");
  });
});
