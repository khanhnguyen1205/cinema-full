import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImageField } from "./AdminUI";

// happy-dom không thật sự tải ảnh, nên onLoad/onError phải bắn tay — đúng cách
// một ảnh hỏng/ảnh sai khung sẽ báo trong trình duyệt thật.
const setup = (props: Partial<Parameters<typeof ImageField>[0]> = {}) => {
  const onChange = vi.fn();
  const r = render(
    <ImageField
      id="f"
      label="Ảnh nền"
      value="https://cdn.test/b.jpg"
      onChange={onChange}
      shape="landscape"
      {...props}
    />,
  );
  return { ...r, onChange };
};

const fireLoad = (img: HTMLImageElement, w: number, h: number) => {
  Object.defineProperty(img, "naturalWidth", { value: w, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: h, configurable: true });
  fireEvent.load(img);
};

describe("ImageField", () => {
  it("ô trống thì không dựng khung xem trước", () => {
    const { container } = setup({ value: "" });
    expect(container.querySelector(".adm-k__imgprev")).toBeNull();
  });

  it("ảnh tải được thì hiện kích thước thật", () => {
    const { container } = setup();
    fireLoad(container.querySelector("img")!, 1280, 720);
    expect(screen.getByText("1280×720")).toBeInTheDocument();
  });

  it("dán ảnh DỌC vào ô ảnh nền thì cảnh báo sai khung", () => {
    const { container } = setup();
    fireLoad(container.querySelector("img")!, 500, 750);
    expect(screen.getByText(/đang dọc \(500×750\)/)).toBeInTheDocument();
    expect(container.querySelector(".adm-k__imgmsg")).toHaveClass("is-warn");
  });

  it("dán ảnh NGANG vào ô poster thì cũng cảnh báo", () => {
    const { container } = setup({ shape: "portrait", label: "Poster" });
    fireLoad(container.querySelector("img")!, 1280, 720);
    expect(screen.getByText(/đang ngang \(1280×720\)/)).toBeInTheDocument();
  });

  it("đường dẫn không ra ảnh thì báo hỏng, không im lặng", () => {
    const { container } = setup();
    fireEvent.error(container.querySelector("img")!);
    expect(
      screen.getByText("Không tải được ảnh từ đường dẫn này"),
    ).toBeInTheDocument();
  });

  it("gõ lại đường dẫn thì xoá kết quả cũ, không giữ số của ảnh trước", () => {
    const { container, onChange } = setup();
    fireLoad(container.querySelector("img")!, 1280, 720);
    expect(screen.getByText("1280×720")).toBeInTheDocument();

    fireEvent.change(container.querySelector("input")!, {
      target: { value: "https://cdn.test/khac.jpg" },
    });
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByText("Đang tải ảnh…")).toBeInTheDocument();
  });
});
