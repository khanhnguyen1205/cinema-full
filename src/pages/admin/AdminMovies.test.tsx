import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "test/renderWithProviders";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import AdminMovies from "./AdminMovies";

const API = "http://localhost:4000/api";

// Ghi lại lời gọi ghi để phân biệt "chặn trước khi gọi API" với "gọi rồi server
// từ chối" — vẫn để handler mặc định trong handlers.ts ghi vào bảng bản sao.
let posted: Record<string, unknown>[];
let patched: Array<{ id: string; body: Record<string, unknown> }>;
let deleted: string[];

beforeEach(() => {
  posted = [];
  patched = [];
  deleted = [];
  server.use(
    http.post(`${API}/movies`, async ({ request }) => {
      posted.push((await request.clone().json()) as Record<string, unknown>);
      return undefined;
    }),
    http.patch(`${API}/movies/:id`, async ({ params, request }) => {
      patched.push({
        id: params.id as string,
        body: (await request.clone().json()) as Record<string, unknown>,
      });
      return undefined;
    }),
    http.delete(`${API}/movies/:id`, ({ params }) => {
      deleted.push(params.id as string);
      return undefined;
    }),
  );
});

const setup = async () => {
  const r = renderWithProviders(<AdminMovies />, {
    route: "/admin/movies",
    user: fx.admin,
  });
  await screen.findByText("Điện Biên Phủ");
  return r;
};

const rows = () =>
  Array.from(
    document.querySelectorAll(".adm-k__table tbody tr td:first-child"),
    (td) => td.textContent,
  );

const rowOf = (title: string) =>
  screen.getByText(title).closest("tr") as HTMLElement;

// Nhãn cột trong bảng trùng chữ với nhãn ô nhập ("Thể loại"), và nút xác nhận
// xoá trùng tên với nút "Xóa" ở mỗi dòng ⇒ mọi truy vấn trong hộp thoại phải
// giới hạn trong chính nó.
const dialog = () => screen.getByRole("dialog");

// Modal dùng <label> rời (không htmlFor) nên getByLabelText không bắt được;
// đi từ nhãn lên khối .adm-k__field rồi lấy ô nhập bên trong.
const field = (label: string) =>
  (
    within(dialog()).getByText(label).closest(".adm-k__field") as HTMLElement
  ).querySelector("input, textarea") as HTMLInputElement;

const confirmDelete = () =>
  userEvent.click(within(dialog()).getByRole("button", { name: "Xóa" }));

const type = async (label: string, value: string) => {
  const el = field(label);
  await userEvent.clear(el);
  await userEvent.type(el, value);
};

describe("AdminMovies", () => {
  it("liệt kê mọi phim kèm số lượng", async () => {
    await setup();
    expect(rows()).toEqual(fx.movies.map((m) => m.title));
    expect(screen.getByText(`${fx.movies.length} mục`)).toBeInTheDocument();
  });

  it("ô tìm kiếm lọc theo tên và báo rỗng khi không khớp", async () => {
    await setup();
    const box = screen.getByPlaceholderText("Tìm phim theo tên...");
    await userEvent.type(box, "endgame");

    await waitFor(() => expect(rows()).toEqual(["Endgame"]));
    expect(screen.getByText("1 mục")).toBeInTheDocument();

    await userEvent.clear(box);
    await userEvent.type(box, "khong-co-phim-nao");
    await waitFor(() =>
      expect(screen.getByText("Không có phim")).toBeInTheDocument(),
    );
  });

  it("mọi ô nhập trong form đều có nhãn nối đúng", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "+ Thêm phim" }));

    // <label> phải có htmlFor trỏ tới id của ô nhập; nhãn trần đứng cạnh input
    // là vi phạm axe (rule `label`, critical) và trình đọc màn hình đọc ô trống.
    expect(screen.getByLabelText("Tên phim")).toBeInTheDocument();
    expect(screen.getByLabelText("Thể loại")).toBeInTheDocument();
    expect(screen.getByLabelText("Thời lượng (phút)")).toBeInTheDocument();
    expect(screen.getByLabelText("Mô tả")).toBeInTheDocument();
    expect(screen.getByLabelText("Poster (URL, tùy chọn)")).toBeInTheDocument();
  });

  it("thiếu trường bắt buộc thì báo lỗi và không gọi API", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "+ Thêm phim" }));
    await type("Tên phim", "Phim Thiếu Thông Tin");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(
      await screen.findByText("Nhập đủ tên, thể loại, thời lượng."),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(0);
  });

  it("thêm phim gửi thời lượng dạng SỐ rồi hiện trong bảng", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "+ Thêm phim" }));
    await type("Tên phim", "Phim Mới");
    await type("Thể loại", "Drama");
    await type("Thời lượng (phút)", "101");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    // Form giữ mọi ô là chuỗi -> phải đổi sang số trước khi gửi.
    expect(posted[0]).toMatchObject({
      title: "Phim Mới",
      genre: "Drama",
      duration: 101,
    });
    expect(await screen.findByText("Phim Mới")).toBeInTheDocument();
  });

  it("sửa phim: form điền sẵn dữ liệu cũ, lưu thì PATCH đúng id", async () => {
    await setup();
    await userEvent.click(
      within(rowOf("Endgame")).getByRole("button", { name: "Sửa" }),
    );

    expect(field("Tên phim")).toHaveValue("Endgame");
    expect(field("Thời lượng (phút)")).toHaveValue(95);

    await type("Tên phim", "Endgame (bản chiếu lại)");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0].id).toBe("2");
    expect(patched[0].body).toMatchObject({ title: "Endgame (bản chiếu lại)" });
    expect(
      await screen.findByText("Endgame (bản chiếu lại)"),
    ).toBeInTheDocument();
  });

  it("chặn xoá phim còn suất chiếu, không gọi API", async () => {
    const alerted = vi.spyOn(window, "alert").mockImplementation(() => {});
    await setup();
    await userEvent.click(
      within(rowOf("Điện Biên Phủ")).getByRole("button", { name: "Xóa" }),
    );
    await confirmDelete();

    // Fixture: phim 1 còn 2 suất chiếu.
    expect(alerted).toHaveBeenCalledWith(
      "Không thể xóa: còn 2 suất chiếu liên quan.",
    );
    expect(deleted).toHaveLength(0);
    expect(rows()).toContain("Điện Biên Phủ");
    alerted.mockRestore();
  });

  it("xoá được phim chưa xếp lịch chiếu", async () => {
    await setup();
    await userEvent.click(
      within(rowOf("Phim Chưa Xếp Lịch")).getByRole("button", { name: "Xóa" }),
    );
    await confirmDelete();

    await waitFor(() => expect(deleted).toEqual(["3"]));
    await waitFor(() => expect(rows()).not.toContain("Phim Chưa Xếp Lịch"));
  });

  it("bấm huỷ trong hộp xác nhận thì không xoá gì", async () => {
    await setup();
    await userEvent.click(
      within(rowOf("Phim Chưa Xếp Lịch")).getByRole("button", { name: "Xóa" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Hủy" }));

    expect(deleted).toHaveLength(0);
    expect(rows()).toContain("Phim Chưa Xếp Lịch");
  });

  it("lỗi tải danh sách vẫn hiện khung trang", async () => {
    server.use(http.get(`${API}/movies`, () => HttpResponse.error()));
    renderWithProviders(<AdminMovies />, {
      route: "/admin/movies",
      user: fx.admin,
    });

    expect(await screen.findByText("Không có phim")).toBeInTheDocument();
  });
});
