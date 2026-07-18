import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tag, Badge, Card, Rule } from "./index";

describe("primitive tĩnh", () => {
  it("Tag render nội dung + class", () => {
    render(<Tag>Mới</Tag>);
    expect(screen.getByText("Mới")).toHaveClass("ui-tag");
  });
  it("Badge áp tone", () => {
    render(<Badge tone="muted">8.4</Badge>);
    expect(screen.getByText("8.4")).toHaveClass("ui-badge", "ui-badge--muted");
  });
  it("Card render children + class gốc", () => {
    render(<Card>nội dung</Card>);
    expect(screen.getByText("nội dung")).toHaveClass("ui-card");
  });
  it("Rule là hr có class", () => {
    const { container } = render(<Rule />);
    const hr = container.querySelector("hr");
    expect(hr).not.toBeNull();
    expect(hr).toHaveClass("ui-rule");
  });
});
