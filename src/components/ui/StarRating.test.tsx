import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StarRating from "./StarRating";

describe("StarRating", () => {
  it("readonly: có aria-label điểm, không phải radiogroup", () => {
    render(<StarRating value={4} readonly />);
    expect(screen.getByLabelText(/4/)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
  it("input: click sao gọi onChange đúng giá trị", () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    const stars = screen.getAllByRole("radio");
    fireEvent.click(stars[2]); // sao thứ 3
    expect(onChange).toHaveBeenCalledWith(3);
  });
  it("input: phím mũi tên phải tăng điểm", () => {
    const onChange = vi.fn();
    render(<StarRating value={2} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(3);
  });
  it("input: phím số chọn trực tiếp", () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "5" });
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
