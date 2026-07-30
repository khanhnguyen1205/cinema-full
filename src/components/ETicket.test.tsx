import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { fx } from "test/fixtures";
import type { Booking } from "types";
import ETicket from "./ETicket";

const booking = fx.bookings[0];
const movie = fx.movies[0];
const cinema = fx.cinemas[0];
const room = fx.rooms[0];
const showtime = fx.showtimes[0];

const renderTicket = (b: Partial<Booking> = {}, size?: "full" | "compact") =>
  render(
    <ETicket
      booking={{ ...booking, ...b }}
      movie={movie}
      cinema={cinema}
      room={room}
      showtime={showtime}
      size={size}
    />,
  );

describe("ETicket", () => {
  it("mã vé pad 5 chữ số, hiện ở cả thân vé lẫn cuống vé", () => {
    renderTicket({ id: 42 });
    expect(screen.getByText("N°TK-00042")).toBeInTheDocument();
    expect(screen.getByText("TK-00042")).toBeInTheDocument();
  });

  it("hiện phim, rạp · phòng · định dạng, ghế và tổng tiền", () => {
    renderTicket({ seats: ["B3", "B4"], totalPrice: 195000 });
    expect(screen.getByText("Điện Biên Phủ")).toBeInTheDocument();
    expect(
      screen.getByText("Cinema Hoàn Kiếm · Phòng 1 · 2D"),
    ).toBeInTheDocument();
    expect(screen.getByText("B3, B4")).toBeInTheDocument();
    expect(screen.getByText("195.000 ₫")).toBeInTheDocument();
  });

  it("thiếu dữ liệu phim thì lùi về #id, thiếu ghế thì gạch ngang", () => {
    render(
      <ETicket
        booking={{ ...booking, movieId: 7, seats: [] }}
        showtime={null}
      />,
    );
    expect(screen.getByText("#7")).toBeInTheDocument();
    // Ngày, Giờ và Ghế đều không có dữ liệu -> ba dấu gạch.
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("dịch tên phương thức thanh toán, kể cả Momo của đơn cũ", () => {
    renderTicket({ paymentMethod: "counter" });
    expect(screen.getByText("Tại quầy")).toBeInTheDocument();

    renderTicket({ paymentMethod: "card" });
    expect(screen.getByText("Thẻ ATM / Visa")).toBeInTheDocument();

    renderTicket({ paymentMethod: "momo" });
    expect(screen.getByText("Ví Momo")).toBeInTheDocument();
  });

  it("chỉ đơn đã trả qua thẻ mới có nhãn Đã thanh toán · pi_…", () => {
    const { unmount } = renderTicket({ paymentMethod: "counter" });
    expect(screen.queryByText(/Đã thanh toán/)).not.toBeInTheDocument();
    unmount();

    renderTicket({ paymentMethod: "card", paymentRef: "pi_3Test123" });
    expect(screen.getByText("Đã thanh toán · pi_3Test123")).toBeInTheDocument();
  });

  it("chỉ hiện dòng bắp nước khi đơn có gọi đồ", () => {
    const { unmount } = renderTicket({ concessions: [] });
    expect(screen.queryByText("Bắp nước")).not.toBeInTheDocument();
    unmount();

    renderTicket({
      concessions: [
        { id: 1, name: "Bắp rang bơ", qty: 2, price: 45000 },
        { id: 2, name: "Combo đôi", qty: 1, price: 89000 },
      ],
    });
    expect(screen.getByText("Bắp nước")).toBeInTheDocument();
    expect(
      screen.getByText("Bắp rang bơ ×2, Combo đôi ×1"),
    ).toBeInTheDocument();
  });

  it("mã QR đổi theo nội dung vé (mã vé | suất | ghế)", () => {
    // qrcode.react không phơi payload ra DOM, nên kiểm gián tiếp: cùng dữ liệu
    // thì ảnh QR y hệt, đổi ghế/suất/mã vé thì ảnh phải khác — đủ để chứng minh
    // ba mảnh đó thật sự được mã hoá vào QR.
    const draw = (b: Partial<Booking>) => {
      const { container, unmount } = renderTicket(b);
      const svg =
        container.querySelector(".eticket-k__qr svg")?.innerHTML ?? "";
      unmount();
      expect(svg).not.toBe("");
      return svg;
    };
    const base = { id: 5, showtimeId: 3, seats: ["C1", "C2"] };

    expect(draw(base)).toBe(draw({ ...base }));
    expect(draw(base)).not.toBe(draw({ ...base, seats: ["C1", "C3"] }));
    expect(draw(base)).not.toBe(draw({ ...base, showtimeId: 9 }));
    expect(draw(base)).not.toBe(draw({ ...base, id: 6 }));
  });

  it("size compact đổi class biến thể", () => {
    const { container, unmount } = renderTicket({}, "compact");
    expect(container.querySelector(".eticket-k--compact")).toBeInTheDocument();
    unmount();

    const full = renderTicket({});
    expect(
      full.container.querySelector(".eticket-k--full"),
    ).toBeInTheDocument();
  });
});
