import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "test/renderWithProviders";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import AdminRooms from "./AdminRooms";

const API = "http://localhost:4000/api";

let posted: Record<string, unknown>[];
let patched: Array<{ id: string; body: Record<string, unknown> }>;
let deleted: string[];

beforeEach(() => {
  posted = [];
  patched = [];
  deleted = [];
  server.use(
    http.post(`${API}/rooms`, async ({ request }) => {
      posted.push((await request.clone().json()) as Record<string, unknown>);
      return undefined;
    }),
    http.patch(`${API}/rooms/:id`, async ({ params, request }) => {
      patched.push({
        id: params.id as string,
        body: (await request.clone().json()) as Record<string, unknown>,
      });
      return undefined;
    }),
    http.delete(`${API}/rooms/:id`, ({ params }) => {
      deleted.push(params.id as string);
      return undefined;
    }),
  );
});

const setup = async () => {
  const r = renderWithProviders(<AdminRooms />, {
    route: "/admin/rooms",
    user: fx.admin,
  });
  await screen.findByText("Phòng 1");
  return r;
};

// Cột thứ hai của bảng là tên phòng (cột đầu là rạp).
const rows = () =>
  Array.from(
    document.querySelectorAll(".adm-k__table tbody tr td:nth-child(2)"),
    (td) => td.textContent,
  );

const rowOf = (name: string) =>
  screen.getByText(name).closest("tr") as HTMLElement;

const dialog = () => screen.getByRole("dialog");

const field = (label: string) =>
  (
    within(dialog()).getByText(label).closest(".adm-k__field") as HTMLElement
  ).querySelector("input, select") as HTMLInputElement;

const type = async (label: string, value: string) => {
  const el = field(label);
  await userEvent.clear(el);
  await userEvent.type(el, value);
};

describe("AdminRooms", () => {
  it("liệt kê phòng kèm tên rạp, layout và hàng VIP", async () => {
    await setup();
    const r1 = rowOf("Phòng 1");
    expect(within(r1).getByText("Cinema Hoàn Kiếm")).toBeInTheDocument();
    expect(within(r1).getByText("2D")).toBeInTheDocument();
    expect(within(r1).getByText("C")).toBeInTheDocument(); // hàng VIP
    expect(rows()).toEqual(["Phòng 1", "Phòng IMAX"]);
  });

  it("bộ lọc rạp thu hẹp danh sách", async () => {
    await setup();
    await userEvent.selectOptions(
      screen.getByRole("combobox"),
      "Cinema Hải Châu",
    );

    await waitFor(() => expect(rows()).toEqual(["Phòng IMAX"]));
    expect(screen.getByText("1 mục")).toBeInTheDocument();
  });

  it("tìm kiếm khớp cả tên phòng lẫn tên rạp", async () => {
    await setup();
    const box = screen.getByPlaceholderText("Tìm phòng hoặc rạp...");
    await userEvent.type(box, "hải châu");

    await waitFor(() => expect(rows()).toEqual(["Phòng IMAX"]));
  });

  it("thiếu trường bắt buộc thì báo lỗi và không gọi API", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "+ Thêm phòng" }));
    await type("Tên phòng", "Phòng thiếu rạp");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(
      await screen.findByText("Nhập đủ rạp, tên, số hàng, số cột."),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(0);
  });

  it("thêm phòng đổi số hàng/cột sang SỐ và tách hàng VIP thành mảng viết hoa", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "+ Thêm phòng" }));
    await userEvent.selectOptions(field("Rạp"), "Cinema Hoàn Kiếm");
    await type("Tên phòng", "Phòng 2");
    await type("Số hàng", "6");
    await type("Số cột", "8");
    await type("Hàng VIP (vd: E,F)", "e, f");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      cinemaId: 1,
      name: "Phòng 2",
      rows: 6,
      cols: 8,
      vipRows: ["E", "F"],
    });
    expect(await screen.findByText("Phòng 2")).toBeInTheDocument();
  });

  it("sửa phòng: form điền sẵn dữ liệu cũ rồi PATCH đúng id", async () => {
    await setup();
    await userEvent.click(
      within(rowOf("Phòng IMAX")).getByRole("button", { name: "Sửa" }),
    );

    expect(field("Tên phòng")).toHaveValue("Phòng IMAX");
    expect(field("Số hàng")).toHaveValue(4);

    await type("Số hàng", "5");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0].id).toBe("2");
    expect(patched[0].body).toMatchObject({ rows: 5 });
  });

  it("chặn xoá phòng còn suất chiếu, không gọi API", async () => {
    const alerted = vi.spyOn(window, "alert").mockImplementation(() => {});
    await setup();
    await userEvent.click(
      within(rowOf("Phòng 1")).getByRole("button", { name: "Xóa" }),
    );
    await userEvent.click(
      within(dialog()).getByRole("button", { name: "Xóa" }),
    );

    // Fixture: phòng 1 gánh 2 suất chiếu.
    expect(alerted).toHaveBeenCalledWith(
      "Không thể xóa: còn 2 suất chiếu liên quan.",
    );
    expect(deleted).toHaveLength(0);
    alerted.mockRestore();
  });

  it("xoá được phòng không còn suất chiếu nào", async () => {
    // Không phòng nào trong fixture rảnh -> bỏ hết suất chiếu để dựng tình huống.
    server.use(http.get(`${API}/showtimes`, () => HttpResponse.json([])));
    await setup();
    await userEvent.click(
      within(rowOf("Phòng 1")).getByRole("button", { name: "Xóa" }),
    );
    await userEvent.click(
      within(dialog()).getByRole("button", { name: "Xóa" }),
    );

    await waitFor(() => expect(deleted).toEqual(["1"]));
    await waitFor(() => expect(rows()).toEqual(["Phòng IMAX"]));
  });
});
