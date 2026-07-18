import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "./Button";

describe("Button", () => {
  it("render với class biến thể & cỡ mặc định", () => {
    render(<Button>Đặt vé</Button>);
    const btn = screen.getByRole("button", { name: "Đặt vé" });
    expect(btn).toHaveClass("ui-btn", "ui-btn--solid", "ui-btn--md");
  });

  it("áp variant & size truyền vào", () => {
    render(
      <Button variant="outline" size="lg">
        X
      </Button>,
    );
    expect(screen.getByRole("button")).toHaveClass(
      "ui-btn--outline",
      "ui-btn--lg",
    );
  });

  it("gọi onClick khi bấm", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled thì không gọi onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
