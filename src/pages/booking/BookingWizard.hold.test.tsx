import { describe, it, expect, afterEach, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "test/renderWithProviders";
import { fx } from "test/fixtures";
import BookingWizard from "./BookingWizard";

// Đồng hồ giữ ghế 8 phút (SeatHoldTimer) đếm bằng CHUỖI setTimeout 1 giây: mỗi
// nhịp đặt state rồi effect mới hẹn nhịp kế tiếp. Vì thế phải tua TỪNG nhịp,
// và phải bật timer giả TRƯỚC khi render — nếu bật sau, nhịp đầu tiên đã được
// hẹn bằng đồng hồ thật nên chuỗi đứt ngay và bộ đếm đứng yên.
// `shouldAdvanceTime` giữ cho promise của MSW vẫn chạy (bài học T4);
// thao tác dùng `fireEvent` chứ không dùng userEvent để khỏi lặp lại lỗi treo
// timer giả đã gặp ở T5.
const useHoldClock = () => vi.useFakeTimers({ shouldAdvanceTime: true });

const tick = async (seconds: number) => {
  for (let i = 0; i < seconds; i++)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
};

const mount = async () => {
  renderWithProviders(
    <Routes>
      <Route path="/seats/:showtimeId" element={<BookingWizard />} />
    </Routes>,
    { route: "/seats/1", user: fx.user },
  );
  await screen.findByText("Điện Biên Phủ");
};

const seatList = () => document.querySelector(".os-k__seatlist")?.textContent;
const clock = () => document.querySelector(".hold-k__time")?.textContent;
const EXPIRED = "Đã hết thời gian giữ ghế — vui lòng chọn lại ghế.";

afterEach(() => vi.useRealTimers());

describe("BookingWizard — hết thời gian giữ ghế", () => {
  it("đếm ngược từ 08:00", async () => {
    useHoldClock();
    await mount();
    expect(clock()).toBe("08:00");

    await tick(65);
    expect(clock()).toBe("06:55");
  });

  it("hết 8 phút thì xoá ghế đã chọn, báo hết giờ và quay về bước ①", async () => {
    useHoldClock();
    await mount();
    fireEvent.click(screen.getByRole("gridcell", { name: /^Ghế B1,/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(await screen.findByText("Thêm bắp nước")).toBeInTheDocument();
    expect(seatList()).toBe("B1");

    await tick(480);

    expect(screen.getByText(EXPIRED)).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument(); // đã về bước ①
    expect(seatList()).toBe("Chưa chọn");
    // Đồng hồ được đặt lại để lượt chọn ghế mới có đủ 8 phút.
    expect(clock()).toBe("08:00");
  });

  it("bấm 'Đã hiểu' thì tắt thông báo hết giờ", async () => {
    useHoldClock();
    await mount();
    await tick(480);
    expect(screen.getByText(EXPIRED)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Đã hiểu" }));
    expect(screen.queryByText(EXPIRED)).not.toBeInTheDocument();
  });
});
