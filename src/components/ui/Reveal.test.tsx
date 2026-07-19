import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import Reveal from "./Reveal";

// Điều khiển IntersectionObserver để test đường "vào viewport".
let triggers: Array<(entries: { isIntersecting: boolean }[]) => void>;

beforeEach(() => {
  triggers = [];
  class IO {
    cb: (entries: { isIntersecting: boolean }[]) => void;
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
      this.cb = cb;
      triggers.push(cb);
    }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", IO);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Reveal", () => {
  it("thêm is-visible khi phần tử vào viewport", () => {
    const { container } = render(<Reveal>nội dung</Reveal>);
    const el = container.querySelector(".ui-reveal");
    expect(el).not.toBeNull();
    expect(el).not.toHaveClass("is-visible");
    // kích hoạt intersection (bọc act để flush re-render)
    act(() => {
      triggers[0]([{ isIntersecting: true }]);
    });
    expect(container.querySelector(".ui-reveal")).toHaveClass("is-visible");
  });
});
