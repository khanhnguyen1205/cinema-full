import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "test/renderWithProviders";
import Cinemas from "./Cinemas";

function Probe() {
  const loc = useLocation();
  return <span data-testid="path">{loc.pathname}</span>;
}

const setup = async () => {
  const r = renderWithProviders(
    <>
      <Cinemas />
      <Probe />
    </>,
    { route: "/cinemas" },
  );
  await screen.findByText("Cinema Hoàn Kiếm");
  return r;
};

const venues = () =>
  Array.from(document.querySelectorAll(".venue-k__name"), (n) => n.textContent);

describe("Cinemas", () => {
  it("liệt kê mọi rạp kèm thành phố, địa chỉ và số phòng", async () => {
    await setup();
    expect(venues()).toEqual(["Cinema Hoàn Kiếm", "Cinema Hải Châu"]);
    expect(screen.getByText("1 Tràng Tiền")).toBeInTheDocument();
    // Fixture: mỗi rạp có đúng 1 phòng.
    expect(screen.getAllByText("1 phòng")).toHaveLength(2);
    expect(screen.getByText("2 rạp")).toBeInTheDocument();
  });

  it("chip thành phố lọc danh sách và cập nhật số đếm", async () => {
    await setup();
    const chips = screen.getByRole("group", { name: "Lọc theo thành phố" });
    await userEvent.click(
      within(chips).getByRole("button", { name: "Đà Nẵng" }),
    );

    await waitFor(() => expect(venues()).toEqual(["Cinema Hải Châu"]));
    expect(screen.getByText("1 rạp")).toBeInTheDocument();
    expect(
      within(chips).getByRole("button", { name: "Đà Nẵng" }),
    ).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(
      within(chips).getByRole("button", { name: "Tất cả" }),
    );
    await waitFor(() => expect(venues()).toHaveLength(2));
  });

  it("bấm thẻ rạp mở trang lịch chiếu của rạp đó", async () => {
    await setup();
    await userEvent.click(screen.getByText("Cinema Hải Châu"));
    expect(screen.getByTestId("path")).toHaveTextContent("/cinema/2");
  });
});
