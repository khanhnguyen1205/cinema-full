import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "./Pagination";

const setup = (props: Partial<Parameters<typeof Pagination>[0]> = {}) => {
  const onPage = vi.fn();
  render(
    <Pagination
      page={2}
      totalPages={5}
      onPage={onPage}
      from={11}
      to={20}
      total={47}
      {...props}
    />,
  );
  return { onPage };
};

describe("Pagination", () => {
  it("chỉ một trang thì không render gì", () => {
    const { container } = render(
      <Pagination
        page={1}
        totalPages={1}
        onPage={() => {}}
        from={1}
        to={3}
        total={3}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("hiện khoảng bản ghi và số trang hiện tại", () => {
    setup();
    expect(screen.getByText("11–20 / 47")).toBeInTheDocument();
    expect(screen.getByText("Trang 2/5")).toBeInTheDocument();
  });

  it("bấm Trang trước / Trang sau gọi onPage với trang liền kề", async () => {
    const { onPage } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Trang trước" }));
    expect(onPage).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(onPage).toHaveBeenCalledWith(3);
  });

  it("khoá nút lùi ở trang đầu", () => {
    setup({ page: 1, from: 1, to: 10 });
    expect(screen.getByRole("button", { name: "Trang trước" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Trang sau" })).toBeEnabled();
  });

  it("khoá nút tiến ở trang cuối", () => {
    setup({ page: 5, from: 41, to: 47 });
    expect(screen.getByRole("button", { name: "Trang trước" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Trang sau" })).toBeDisabled();
  });
});
