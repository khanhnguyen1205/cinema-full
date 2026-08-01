import { describe, it, expect, vi } from "vitest";
import { cloneElement, type ReactElement } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "test/renderWithProviders";
import { fx } from "test/fixtures";
import AdminOverview from "./AdminOverview";

// happy-dom không có layout thật: `ResponsiveContainer` đo được 0px nên recharts
// bỏ qua, không vẽ SVG nào và mọi khẳng định về biểu đồ sẽ hỏng. Thay nó bằng
// khung kích thước cố định để biểu đồ vẽ thật — nhờ vậy mới kiểm được phần tổng
// hợp doanh thu theo phim/rạp (dữ liệu đó KHÔNG hiện ở đâu khác trên trang).
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(children as ReactElement<Record<string, unknown>>, {
        width: 600,
        height: 260,
      }),
  };
});

const setup = async () => {
  const r = renderWithProviders(<AdminOverview />, {
    route: "/admin",
    user: fx.admin,
  });
  await screen.findByRole("heading", { name: "Tổng quan" });
  // Tiêu đề hiện ngay từ lần render đầu, lúc mọi con số còn là 0 — phải chờ
  // đơn đặt vé về rồi mới khẳng định, không thì đo nhầm trạng thái rỗng.
  await waitFor(() =>
    expect(tile("Đơn đặt vé")).toBe(String(fx.bookings.length)),
  );
  return r;
};

const tile = (label: string) =>
  (
    screen.getByText(label).closest(".adm-k__stat") as HTMLElement
  ).querySelector(".adm-k__stat-num")?.textContent;

const revCard = (label: string) =>
  (
    screen.getByText(label).closest(".adm-k__rev-card") as HTMLElement
  ).querySelector(".adm-k__rev-num")?.textContent;

const chart = (title: string) =>
  screen.getByText(title).closest(".adm-k__chartbox") as HTMLElement;

describe("AdminOverview", () => {
  it("đếm đúng số lượng từng bảng dữ liệu", async () => {
    await setup();
    expect(tile("Phim")).toBe(String(fx.movies.length));
    expect(tile("Rạp")).toBe(String(fx.cinemas.length));
    expect(tile("Phòng")).toBe(String(fx.rooms.length));
    expect(tile("Suất chiếu")).toBe(String(fx.showtimes.length));
    expect(tile("Đơn đặt vé")).toBe(String(fx.bookings.length));
  });

  it("cộng tổng doanh thu và doanh thu bắp nước từ mọi đơn", async () => {
    await setup();
    // Fixture: 105.000 + 240.000 tổng đơn; bắp nước chỉ có ở đơn thứ hai.
    expect(revCard("Tổng doanh thu")).toBe("345.000 ₫");
    expect(revCard("Doanh thu bắp nước")).toBe("45.000 ₫");
  });

  it("đếm vé bán theo SỐ GHẾ chứ không phải số đơn", async () => {
    await setup();
    // 1 ghế + 2 ghế = 3 vé trên 2 đơn.
    expect(revCard("Tổng vé bán")).toBe("3");
  });

  it("biểu đồ theo phim gộp doanh thu ghế và hiện tên phim", async () => {
    await setup();
    const box = chart("Doanh thu vé theo phim (Top 6)");
    // Cả hai đơn cùng phim 1 -> một cột duy nhất mang tên phim.
    expect(within(box).getByText("Điện Biên Phủ")).toBeInTheDocument();
    expect(within(box).queryByText("Endgame")).not.toBeInTheDocument();
  });

  it("biểu đồ theo rạp hiện tên rạp thay vì mã số", async () => {
    await setup();
    const box = chart("Doanh thu vé theo rạp");
    expect(within(box).getByText("Cinema Hoàn Kiếm")).toBeInTheDocument();
    expect(within(box).queryByText("#1")).not.toBeInTheDocument();
  });
});
