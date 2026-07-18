import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field, Skeleton, Spinner, IconButton } from "./index";

describe("form/feedback primitive", () => {
  it("Field hiển thị label và bọc children", () => {
    render(
      <Field label="Email">
        <input aria-label="email-input" />
      </Field>,
    );
    expect(screen.getByText("Email")).toHaveClass("ui-field__label");
    expect(screen.getByLabelText("email-input")).toBeInTheDocument();
  });

  it("Skeleton nhận width/height và có role status", () => {
    render(<Skeleton width="120px" height="20px" />);
    const el = screen.getByRole("status");
    expect(el).toHaveClass("ui-skeleton");
    expect(el).toHaveStyle({ width: "120px", height: "20px" });
  });

  it("Spinner có aria-label", () => {
    render(<Spinner />);
    expect(screen.getByLabelText("Đang tải")).toHaveClass("ui-spinner");
  });

  it("IconButton dùng label làm aria-label", () => {
    render(
      <IconButton label="Đóng">
        <span>×</span>
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Đóng" })).toHaveClass(
      "ui-iconbtn",
    );
  });
});
