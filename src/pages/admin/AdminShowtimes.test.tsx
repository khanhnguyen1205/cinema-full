import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { renderWithProviders } from "test/renderWithProviders";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import AdminShowtimes from "./AdminShowtimes";

const API = "http://localhost:4000/api";

let posted: Record<string, unknown>[];
let patched: Array<{ id: string; body: Record<string, unknown> }>;
let deleted: string[];

beforeEach(() => {
  posted = [];
  patched = [];
  deleted = [];
  server.use(
    http.post(`${API}/showtimes`, async ({ request }) => {
      posted.push((await request.clone().json()) as Record<string, unknown>);
      return undefined;
    }),
    http.patch(`${API}/showtimes/:id`, async ({ params, request }) => {
      patched.push({
        id: params.id as string,
        body: (await request.clone().json()) as Record<string, unknown>,
      });
      return undefined;
    }),
    http.delete(`${API}/showtimes/:id`, ({ params }) => {
      deleted.push(params.id as string);
      return undefined;
    }),
  );
});

const setup = async () => {
  const r = renderWithProviders(<AdminShowtimes />, {
    route: "/admin/showtimes",
    user: fx.admin,
  });
  await screen.findByText("Endgame");
  return r;
};

const col = (n: number) =>
  Array.from(
    document.querySelectorAll(`.adm-k__table tbody tr td:nth-child(${n})`),
    (td) => td.textContent,
  );

const dialog = () => screen.getByRole("dialog");

const field = (label: string) =>
  (
    within(dialog()).getByText(label).closest(".adm-k__field") as HTMLElement
  ).querySelector("input, select") as HTMLInputElement;

const save = () => userEvent.click(screen.getByRole("button", { name: "Lưu" }));

describe("AdminShowtimes", () => {
  it("xếp suất theo thời gian tăng dần kèm nhãn rạp · phòng · loại", async () => {
    await setup();
    // Fixture: suất quá khứ (-48h) → +48h → +72h; hai suất đầu cùng phim 1.
    expect(col(1)).toEqual(["Điện Biên Phủ", "Điện Biên Phủ", "Endgame"]);
    expect(col(2)[2]).toBe("Cinema Hải Châu · Phòng IMAX · IMAX");
    expect(screen.getByText(`${fx.showtimes.length} mục`)).toBeInTheDocument();
  });

  it("lọc theo rạp và tìm theo tên phim", async () => {
    await setup();
    await userEvent.selectOptions(
      screen.getByRole("combobox"),
      "Cinema Hải Châu",
    );
    await waitFor(() => expect(col(1)).toEqual(["Endgame"]));

    await userEvent.selectOptions(screen.getByRole("combobox"), "Tất cả rạp");
    await userEvent.type(
      screen.getByPlaceholderText("Tìm theo tên phim..."),
      "endgame",
    );
    await waitFor(() => expect(col(1)).toEqual(["Endgame"]));
  });

  it("thiếu trường bắt buộc thì báo lỗi và không gọi API", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "+ Thêm suất" }));
    await save();

    expect(
      await screen.findByText("Nhập đủ phim, phòng, ngày, giờ, giá."),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(0);
  });

  it("chọn phòng thì tự điền giá gợi ý theo loại phòng", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "+ Thêm suất" }));
    await userEvent.selectOptions(
      field("Phòng (Rạp · Phòng · Loại)"),
      "Cinema Hải Châu · Phòng IMAX · IMAX",
    );

    // ROOM_TYPE_PRICE.IMAX
    expect(field("Giá (₫)")).toHaveValue(120000);
  });

  it("thêm suất ghép ngày + giờ thành một mốc thời gian và gửi giá dạng số", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "+ Thêm suất" }));
    await userEvent.selectOptions(field("Phim"), "Endgame");
    await userEvent.selectOptions(
      field("Phòng (Rạp · Phòng · Loại)"),
      "Cinema Hoàn Kiếm · Phòng 1 · 2D",
    );
    // Ô ngày/giờ là input type=date|time — gõ từng ký tự không ăn, đặt thẳng giá trị.
    fireEvent.change(field("Ngày"), { target: { value: "2026-09-15" } });
    fireEvent.change(field("Giờ"), { target: { value: "19:45" } });
    await save();

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({
      movieId: 2,
      roomId: 1,
      time: "2026-09-15T19:45:00",
      price: 75000, // giá gợi ý của phòng 2D
      bookedSeats: [], // suất mới luôn trống ghế
    });
  });

  it("sửa suất: tách sẵn ngày/giờ của suất cũ và GIỮ NGUYÊN ghế đã bán", async () => {
    await setup();
    const row = screen.getByText("Endgame").closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Sửa" }));

    const st = fx.showtimes[2];
    expect(field("Ngày")).toHaveValue(st.time.slice(0, 10));
    expect(field("Giờ")).toHaveValue(st.time.slice(11, 16));

    fireEvent.change(field("Giá (₫)"), { target: { value: "150000" } });
    await save();

    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0].id).toBe("3");
    expect(patched[0].body).toMatchObject({
      price: 150000,
      bookedSeats: st.bookedSeats,
    });
  });

  it("xoá suất chiếu sau khi xác nhận", async () => {
    await setup();
    const row = screen.getByText("Endgame").closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Xóa" }));
    await userEvent.click(
      within(dialog()).getByRole("button", { name: "Xóa" }),
    );

    await waitFor(() => expect(deleted).toEqual(["3"]));
    await waitFor(() => expect(col(1)).not.toContain("Endgame"));
  });
});
