import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { renderWithProviders } from "test/renderWithProviders";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import AdminBookings from "./AdminBookings";

const API = "http://localhost:4000/api";

let patched: Array<{ id: string; body: Record<string, unknown> }>;
let deleted: string[];

beforeEach(() => {
  patched = [];
  deleted = [];
  server.use(
    http.patch(`${API}/bookings/:id`, async ({ params, request }) => {
      patched.push({
        id: params.id as string,
        body: (await request.clone().json()) as Record<string, unknown>,
      });
      return undefined;
    }),
    http.delete(`${API}/bookings/:id`, ({ params }) => {
      deleted.push(params.id as string);
      return undefined;
    }),
  );
});

const setup = async () => {
  const r = renderWithProviders(<AdminBookings />, {
    route: "/admin/bookings",
    user: fx.admin,
  });
  await screen.findByText("#TK-00001");
  return r;
};

const codes = () =>
  Array.from(
    document.querySelectorAll(".adm-k__table tbody tr td:first-child"),
    (td) => td.textContent,
  );

const rowOf = (code: string) =>
  screen.getByText(code).closest("tr") as HTMLElement;

const dialog = () => screen.getByRole("dialog");

// Ghế trong mini seat map không có chữ, nhận diện bằng `title` (vd "C1 · VIP").
const seat = (n: string) =>
  within(dialog()).getByTitle(new RegExp(`^${n}( |$)`));

const summary = () =>
  document.querySelector(".sgm-k__summary")?.textContent ?? "";

// Mở hộp sửa ghế của một đơn rồi chờ sơ đồ dựng xong.
const openSeats = async (code: string) => {
  await userEvent.click(
    within(rowOf(code)).getByRole("button", { name: "Sửa ghế" }),
  );
  await screen.findByText(`Sửa ghế · ${code}`);
};

describe("AdminBookings", () => {
  it("liệt kê đơn kèm mã, khách, ghế và tổng tiền", async () => {
    await setup();
    expect(codes()).toEqual(["#TK-00001", "#TK-00002"]);

    const r1 = rowOf("#TK-00001");
    expect(within(r1).getByText("Người Dùng")).toBeInTheDocument();
    expect(within(r1).getByText("Điện Biên Phủ")).toBeInTheDocument();
    expect(within(r1).getByText("B3")).toBeInTheDocument();
    expect(within(r1).getByText("105.000 ₫")).toBeInTheDocument();
  });

  it("tìm theo tên khách hoặc tên phim, không khớp thì báo rỗng", async () => {
    await setup();
    const box = screen.getByPlaceholderText("Tìm theo khách hoặc phim...");

    await userEvent.type(box, "điện biên");
    await waitFor(() => expect(codes()).toHaveLength(2));

    await userEvent.clear(box);
    await userEvent.type(box, "endgame");
    await waitFor(() =>
      expect(screen.getByText("Không có đơn đặt vé")).toBeInTheDocument(),
    );
  });

  it("hộp sửa ghế mở với đúng ghế của đơn và tổng tiền hiện tại", async () => {
    await setup();
    await openSeats("#TK-00001");

    expect(summary()).toContain("B3");
    // 90.000 (ghế thường) + 15.000 phí; đơn này không có bắp nước.
    expect(summary()).toContain("105.000 ₫");
    expect(summary()).toContain("Thường ×1 · VIP ×0");
  });

  it("ghế do nguồn khác giữ thì khoá, không chọn được", async () => {
    await setup();
    await openSeats("#TK-00001");

    // showtime.bookedSeats của suất 1 là A1, A2.
    expect(seat("A1")).toBeDisabled();
    await userEvent.click(seat("A1"));
    expect(summary()).toContain("B3");
    expect(summary()).not.toContain("A1");
  });

  it("đổi ghế thì tính lại loại ghế, tiền ghế và tổng tiền rồi PATCH", async () => {
    await setup();
    await openSeats("#TK-00001");
    await userEvent.click(seat("C1")); // hàng C là VIP

    // 90.000 + 117.000 + 15.000 phí.
    await waitFor(() => expect(summary()).toContain("222.000 ₫"));
    expect(summary()).toContain("Thường ×1 · VIP ×1");

    await userEvent.click(
      within(dialog()).getByRole("button", { name: "Lưu" }),
    );

    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0].id).toBe("1");
    expect(patched[0].body).toEqual({
      seats: ["B3", "C1"],
      seatTypes: { standard: 1, vip: 1, couple: 0 },
      seatTotal: 207000,
      totalPrice: 222000,
    });
    await waitFor(() =>
      expect(
        within(rowOf("#TK-00001")).getByText("B3, C1"),
      ).toBeInTheDocument(),
    );
  });

  it("bỏ hết ghế thì không cho lưu (đơn rỗng vô nghĩa)", async () => {
    await setup();
    await openSeats("#TK-00001");
    await userEvent.click(seat("B3")); // bỏ chọn ghế duy nhất

    expect(summary()).toContain("Chưa chọn");
    expect(
      within(dialog()).getByRole("button", { name: "Lưu" }),
    ).toBeDisabled();
  });

  it("huỷ đơn sau khi xác nhận thì đơn biến mất khỏi bảng", async () => {
    await setup();
    await userEvent.click(
      within(rowOf("#TK-00002")).getByRole("button", { name: "Hủy" }),
    );
    await userEvent.click(
      within(dialog()).getByRole("button", { name: "Xóa" }),
    );

    await waitFor(() => expect(deleted).toEqual(["2"]));
    await waitFor(() => expect(codes()).toEqual(["#TK-00001"]));
  });

  it("đóng hộp xác nhận thì không huỷ đơn nào", async () => {
    await setup();
    await userEvent.click(
      within(rowOf("#TK-00002")).getByRole("button", { name: "Hủy" }),
    );
    await userEvent.click(
      within(dialog()).getByRole("button", { name: "Hủy" }),
    );

    expect(deleted).toHaveLength(0);
    expect(codes()).toHaveLength(2);
  });
});
