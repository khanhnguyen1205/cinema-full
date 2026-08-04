import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "test/renderWithProviders";
import NotFound from "./NotFound";

function Probe() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

const setup = (route: string) =>
  renderWithProviders(
    <>
      <NotFound />
      <Probe />
    </>,
    { route },
  );

describe("NotFound", () => {
  it("in ra đúng đường dẫn đã gõ, không phải một lời xin lỗi chung chung", async () => {
    const { container } = setup("/khong-ton-tai/abc");
    expect(
      await screen.findByText("Không có trang nào ở địa chỉ này"),
    ).toBeInTheDocument();
    // Probe cũng in đường dẫn -> soi đúng ô <code> của trang, không getByText.
    expect(container.querySelector(".nf-k__path")).toHaveTextContent(
      "/khong-ton-tai/abc",
    );
  });

  it("có lối về trang chủ", async () => {
    setup("/sai");
    await userEvent.click(
      await screen.findByRole("button", { name: "Về trang chủ" }),
    );
    expect(screen.getByTestId("path")).toHaveTextContent("/");
  });

  it("có lối sang danh sách phim", async () => {
    setup("/sai");
    await userEvent.click(
      await screen.findByRole("button", { name: "Xem phim đang chiếu" }),
    );
    expect(screen.getByTestId("path")).toHaveTextContent("/movies");
  });
});
