import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "test/renderWithProviders";
import { fx } from "test/fixtures";
import MovieDetail from "./MovieDetail";

function Probe() {
  const loc = useLocation();
  return <span data-testid="path">{loc.pathname}</span>;
}

// Trang đọc :id bằng useParams -> phải đi qua Routes thật, không render trần.
const setup = async (movieId: number) => {
  const r = renderWithProviders(
    <>
      <Routes>
        <Route path="/movie/:id" element={<MovieDetail />} />
        {/* Bắt mọi đích điều hướng để router không log "No routes matched". */}
        <Route path="*" element={null} />
      </Routes>
      <Probe />
    </>,
    { route: `/movie/${movieId}` },
  );
  await screen.findByText("Đặt vé", { selector: ".book-k__head" });
  return r;
};

const panel = () => document.querySelector(".book-k") as HTMLElement;
const timeButtons = () =>
  Array.from(document.querySelectorAll(".time-k-btn__t"), (n) => n.textContent);

describe("MovieDetail — phễu đặt vé", () => {
  it("hiện thông tin phim: tên, điểm, thể loại đã dịch", async () => {
    await setup(1);
    // Nguyên văn nằm ở khối ẩn dành cho trình đọc màn hình (KineticHeading).
    expect(
      document.querySelector(".detail-k__title .ui-visually-hidden")
        ?.textContent,
    ).toBe("Điện Biên Phủ");
    expect(screen.getByText("★ 8.4")).toBeInTheDocument();
    expect(screen.getByText(/Hành động · 120/)).toBeInTheDocument();
  });

  it("phễu tự chọn sẵn thành phố → rạp → ngày đầu tiên còn suất", async () => {
    await setup(1);
    expect(
      within(panel()).getByRole("combobox", { name: "Chọn thành phố" }),
    ).toHaveValue(String(fx.cinemas[0].cityId));
    expect(
      within(panel()).getByRole("combobox", { name: "Chọn rạp" }),
    ).toHaveValue(String(fx.cinemas[0].id));
    expect(panel().querySelector(".date-k-btn.is-active")).toBeInTheDocument();
  });

  it("CHỈ chào bán suất chưa chiếu", async () => {
    await setup(1);
    // Fixture: phim 1 có 2 suất — một sau 48h, một trước 48h.
    expect(timeButtons()).toHaveLength(1);
    const upcoming = new Date(fx.showtimes[0].time).toLocaleTimeString(
      "en-GB",
      { hour: "2-digit", minute: "2-digit" },
    );
    expect(timeButtons()[0]).toBe(upcoming);
  });

  it("nút đặt vé khoá tới khi chọn giờ, rồi mở đúng trang chọn ghế", async () => {
    await setup(1);
    const cta = within(panel()).getByRole("button", { name: "Đặt vé" });
    expect(cta).toBeDisabled();

    await userEvent.click(panel().querySelector(".time-k-btn") as HTMLElement);
    await waitFor(() => expect(cta).toBeEnabled());

    await userEvent.click(cta);
    expect(screen.getByTestId("path")).toHaveTextContent("/seats/1");
  });

  it("phim chiếu ở thành phố khác: phễu tự nhắm đúng rạp của thành phố đó", async () => {
    await setup(2); // Endgame chỉ có suất ở Đà Nẵng
    expect(
      within(panel()).getByRole("combobox", { name: "Chọn rạp" }),
    ).toHaveValue(String(fx.cinemas[1].id));

    await userEvent.click(panel().querySelector(".time-k-btn") as HTMLElement);
    await waitFor(() =>
      expect(
        within(panel()).getByRole("button", { name: "Đặt vé" }),
      ).toBeEnabled(),
    );
  });

  it("phim chưa xếp lịch: panel báo chưa có suất, không có nút giờ nào", async () => {
    await setup(3);
    expect(within(panel()).getByText("Chưa có suất chiếu")).toBeInTheDocument();
    expect(timeButtons()).toEqual([]);
    expect(
      within(panel()).queryByRole("button", { name: "Đặt vé" }),
    ).not.toBeInTheDocument();
  });

  it("khu 'Đang chiếu tại' liệt kê rạp có suất của phim", async () => {
    await setup(1);
    const sec = screen.getByText("Đang chiếu tại").closest("section")!;
    expect(within(sec).getByText("Cinema Hoàn Kiếm")).toBeInTheDocument();
    expect(within(sec).queryByText("Cinema Hải Châu")).not.toBeInTheDocument();
  });
});
