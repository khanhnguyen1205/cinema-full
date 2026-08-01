import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "test/renderWithProviders";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import BookingWizard from "./BookingWizard";

const API = "http://localhost:4000/api";

// Suất 1: phòng 1 (5 hàng × 6 cột, VIP hàng C, đôi hàng E), giá thường 90.000.
// Handler occupied-seats mặc định trả A1 + A2 -> hai ghế đó phải là "đã đặt".
let held: string[][];
let released: string[];

beforeEach(() => {
  held = [];
  released = [];
  server.use(
    http.post(`${API}/holds`, async ({ request }) => {
      const body = (await request.json()) as { seats: string[] };
      held.push(body.seats);
      return HttpResponse.json({ ok: true, expiresAt: Date.now() + 480_000 });
    }),
    http.delete(`${API}/holds`, ({ request }) => {
      released.push(new URL(request.url).searchParams.get("showtimeId") ?? "");
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

const setup = async () => {
  const r = renderWithProviders(
    <Routes>
      <Route path="/seats/:showtimeId" element={<BookingWizard />} />
    </Routes>,
    { route: "/seats/1", user: fx.user },
  );
  // Chờ meta của suất về (OrderSummary hiện tên phim) rồi mới khẳng định.
  await screen.findByText("Điện Biên Phủ");
  return r;
};

const seat = (n: string) =>
  screen.getByRole("gridcell", { name: new RegExp(`^Ghế ${n},`) });

const pick = (n: string) => userEvent.click(seat(n));

const total = () => document.querySelector(".os-k__total-amount")?.textContent;
const seatList = () => document.querySelector(".os-k__seatlist")?.textContent;
const cta = () => screen.getByRole("button", { name: "Tiếp tục" });

describe("BookingWizard — bước ① chọn ghế", () => {
  it("hiện thông tin suất chiếu ở cột tóm tắt đơn hàng", async () => {
    await setup();
    expect(screen.getByText("Điện Biên Phủ")).toBeInTheDocument();
    expect(
      screen.getByText("Cinema Hoàn Kiếm · Phòng 1 · 2D"),
    ).toBeInTheDocument();
    expect(seatList()).toBe("Chưa chọn");
  });

  it("ghế đã có người đặt thì đánh dấu và bấm không ăn", async () => {
    await setup();
    expect(seat("A1")).toHaveAttribute("aria-disabled", "true");
    expect(seat("A1").getAttribute("aria-label")).toContain("đã đặt");

    await pick("A1");
    expect(seatList()).toBe("Chưa chọn");
    expect(total()).toBe("0 ₫");
  });

  it("chọn ghế thường: tổng = giá ghế + phí dịch vụ", async () => {
    await setup();
    await pick("B1");

    expect(seatList()).toBe("B1");
    // 90.000 (giá suất) + 15.000 (SERVICE_FEE) — số cứng khớp lib/pricing.
    expect(total()).toBe("105.000 ₫");
    expect(screen.getByText("Ghế thường (×1)")).toBeInTheDocument();
  });

  it("ghế đang chọn được đánh dấu bằng aria-selected", async () => {
    await setup();
    // role="gridcell" KHÔNG cho aria-pressed (axe: aria-allowed-attr, critical)
    // nên trạng thái chọn phải nằm ở aria-selected.
    expect(seat("B1")).toHaveAttribute("aria-selected", "false");
    await pick("B1");
    expect(seat("B1")).toHaveAttribute("aria-selected", "true");
    expect(seat("B1")).not.toHaveAttribute("aria-pressed");
  });

  it("bấm lại ghế đang chọn thì bỏ chọn và khoá nút tiếp tục", async () => {
    await setup();
    await pick("B1");
    await pick("B1");

    expect(seatList()).toBe("Chưa chọn");
    expect(total()).toBe("0 ₫");
    expect(cta()).toBeDisabled();
  });

  it("ghế VIP tính theo giá VIP (×1.3 làm tròn nghìn)", async () => {
    await setup();
    await pick("C1");

    // 117.000 + 15.000.
    expect(total()).toBe("132.000 ₫");
    expect(screen.getByText("Ghế VIP (×1)")).toBeInTheDocument();
  });

  it("ghế đôi tính theo giá ghế đôi (×1.6 làm tròn nghìn)", async () => {
    await setup();
    await pick("E1");

    // 144.000 + 15.000.
    expect(total()).toBe("159.000 ₫");
    expect(screen.getByText("Ghế đôi (×1)")).toBeInTheDocument();
  });

  it("chưa chọn ghế nào thì không cho đi tiếp", async () => {
    await setup();
    expect(cta()).toBeDisabled();
    await pick("B1");
    expect(cta()).toBeEnabled();
  });

  it("chặn ở ghế thứ 9 và báo giới hạn", async () => {
    await setup();
    const eight = ["A3", "A4", "A5", "A6", "B1", "B2", "B3", "B4"];
    for (const s of eight) await pick(s);
    expect(seatList()).toBe(eight.join(", "));

    await pick("B5");
    expect(
      await screen.findByText("Chỉ chọn tối đa 8 ghế mỗi lần."),
    ).toBeInTheDocument();
    expect(seatList()).toBe(eight.join(", "));
  });

  it("mỗi lần đổi lựa chọn thì gửi lại toàn bộ danh sách ghế đang giữ", async () => {
    await setup();
    await waitFor(() => expect(held.length).toBeGreaterThan(0));
    expect(held[0]).toEqual([]); // giữ rỗng lúc vào trang

    await pick("B1");
    await waitFor(() => expect(held.at(-1)).toEqual(["B1"]));
    await pick("B2");
    await waitFor(() => expect(held.at(-1)).toEqual(["B1", "B2"]));
    await pick("B1");
    await waitFor(() => expect(held.at(-1)).toEqual(["B2"]));
  });

  it("rời trang thì nhả hết ghế đang giữ của mình", async () => {
    const { unmount } = await setup();
    await pick("B1");
    unmount();

    await waitFor(() => expect(released).toEqual(["1"]));
  });
});

describe("BookingWizard — bước ② bắp nước", () => {
  const goToFnb = async () => {
    await setup();
    await pick("B1");
    await userEvent.click(cta());
    await screen.findByText("Thêm bắp nước");
  };

  it("bấm tiếp tục thì sang bước bắp nước", async () => {
    await goToFnb();
    expect(screen.getByText("Bắp rang bơ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ qua" })).toBeInTheDocument();
  });

  it("thêm món thì tổng cộng tăng đúng giá trong danh mục", async () => {
    await goToFnb();
    await userEvent.click(
      screen.getByRole("button", { name: "Thêm Bắp rang bơ" }),
    );

    // 90.000 ghế + 45.000 bắp + 15.000 phí.
    await waitFor(() => expect(total()).toBe("150.000 ₫"));
    expect(screen.getByText("Bắp rang bơ (×1)")).toBeInTheDocument();
  });

  it("bớt món về 0 thì dòng bắp nước biến mất khỏi tóm tắt", async () => {
    await goToFnb();
    const add = screen.getByRole("button", { name: "Thêm Bắp rang bơ" });
    await userEvent.click(add);
    await waitFor(() => expect(total()).toBe("150.000 ₫"));

    await userEvent.click(
      screen.getByRole("button", { name: "Bớt Bắp rang bơ" }),
    );
    await waitFor(() => expect(total()).toBe("105.000 ₫"));
    expect(screen.queryByText("Bắp rang bơ (×1)")).not.toBeInTheDocument();
  });

  it("không cho vượt trần 10 phần mỗi món", async () => {
    await goToFnb();
    const add = screen.getByRole("button", { name: "Thêm Bắp rang bơ" });
    for (let i = 0; i < 12; i++) await userEvent.click(add);

    const card = add.closest(".fnb-k__card") as HTMLElement;
    expect(within(card).getByText("10")).toBeInTheDocument();
    expect(add).toBeDisabled();
  });

  it("bấm bỏ qua thì sang thẳng bước thanh toán", async () => {
    await goToFnb();
    await userEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));

    expect(
      await screen.findByText("Phương thức thanh toán"),
    ).toBeInTheDocument();
  });

  it("nút quay lại của thanh bước đưa về chọn ghế, giữ nguyên ghế đã chọn", async () => {
    await goToFnb();
    await userEvent.click(screen.getByRole("button", { name: /Quay lại/ }));

    expect(await screen.findByRole("grid")).toBeInTheDocument();
    expect(seatList()).toBe("B1");
  });
});
