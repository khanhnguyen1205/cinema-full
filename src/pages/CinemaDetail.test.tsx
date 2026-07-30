import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "test/renderWithProviders";
import CinemaDetail from "./CinemaDetail";

function Probe() {
  const loc = useLocation();
  return <span data-testid="path">{loc.pathname}</span>;
}

const setup = async (cinemaId: number) => {
  const r = renderWithProviders(
    <>
      <Routes>
        <Route path="/cinema/:id" element={<CinemaDetail />} />
        {/* Bắt mọi đích điều hướng để router không log "No routes matched". */}
        <Route path="*" element={null} />
      </Routes>
      <Probe />
    </>,
    { route: `/cinema/${cinemaId}` },
  );
  await screen.findByText("Lịch chiếu tại rạp");
  return r;
};

// "Phim"/"Rạp" trùng nhãn điều hướng ở Navbar -> chỉ soi trong dải thống kê.
const stat = (label: string) =>
  Array.from(document.querySelectorAll(".venue-hero__stats .stat-k"))
    .find((s) => s.querySelector(".stat-k__label")?.textContent === label)
    ?.querySelector(".stat-k__num")?.textContent;

describe("CinemaDetail", () => {
  it("hero hiện tên rạp, thành phố và địa chỉ", async () => {
    await setup(1);
    expect(document.querySelector(".venue-hero__title")?.textContent).toBe(
      "Cinema Hoàn Kiếm",
    );
    expect(screen.getByText("Hà Nội")).toBeInTheDocument();
    expect(screen.getByText(/1 Tràng Tiền/)).toBeInTheDocument();
  });

  it("đếm 'Suất' theo suất CÒN CHIẾU ĐƯỢC, khớp với lịch bên dưới", async () => {
    await setup(1);
    // Fixture rạp 1: 2 suất của phim 1 nhưng một suất đã qua.
    expect(stat("Suất")).toBe("1");
    expect(stat("Phim")).toBe("1");
    expect(stat("Phòng")).toBe("1");
    expect(
      document.querySelectorAll(".sched-k__times .time-k-btn"),
    ).toHaveLength(1);
  });

  it("bấm nút giờ chuyển sang trang chọn ghế của đúng suất", async () => {
    await setup(1);
    await userEvent.click(
      document.querySelector(".sched-k__times .time-k-btn") as HTMLElement,
    );
    expect(screen.getByTestId("path")).toHaveTextContent("/seats/1");
  });

  it("mỗi phim trong lịch có lối sang trang chi tiết phim", async () => {
    await setup(1);
    const block = document.querySelector(".sched-k") as HTMLElement;
    await userEvent.click(
      within(block).getByRole("button", { name: "Chi tiết Điện Biên Phủ" }),
    );
    expect(screen.getByTestId("path")).toHaveTextContent("/movie/1");
  });
});
