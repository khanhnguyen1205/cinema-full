import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Marquee from "./Marquee";

describe("Marquee", () => {
  it("nhân đôi nội dung và đặt biến thời lượng", () => {
    const { container } = render(<Marquee speed={20}>PHIM MỚI</Marquee>);
    const groups = container.querySelectorAll(".ui-marquee__group");
    expect(groups).toHaveLength(2);
    // bản sao thứ 2 ẩn với trợ năng
    expect(groups[1].getAttribute("aria-hidden")).toBe("true");
    const track = container.querySelector(".ui-marquee__track");
    expect(track?.getAttribute("style")).toContain("--marquee-dur: 20s");
  });
});
