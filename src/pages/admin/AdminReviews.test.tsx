import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { renderWithProviders } from "test/renderWithProviders";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import AdminReviews from "./AdminReviews";

const API = "http://localhost:4000/api";

let deleted: string[];

beforeEach(() => {
  deleted = [];
  server.use(
    http.delete(`${API}/reviews/:id`, ({ params }) => {
      deleted.push(params.id as string);
      return undefined; // rơi xuống handler mặc định (xoá thật khỏi bảng giả)
    }),
  );
});

const setup = async () => {
  const r = renderWithProviders(<AdminReviews />, {
    route: "/admin/reviews",
    user: fx.admin,
  });
  await screen.findByText("Rất hay.");
  return r;
};

// Cột 2 là người viết đánh giá.
const users = () =>
  Array.from(
    document.querySelectorAll(".adm-k__table tbody tr td:nth-child(2)"),
    (td) => td.textContent,
  );

const rowOf = (comment: string) =>
  screen.getByText(comment).closest("tr") as HTMLElement;

const dialog = () => screen.getByRole("dialog");

describe("AdminReviews", () => {
  it("liệt kê đánh giá mới nhất trước, kèm phim và dấu đã xem", async () => {
    await setup();
    // Sắp xếp theo id giảm dần -> đánh giá #2 đứng trước #1.
    expect(users()).toEqual(["Khán Giả Khác", "Người Dùng"]);

    const mine = rowOf("Rất hay.");
    expect(within(mine).getByText("Điện Biên Phủ")).toBeInTheDocument();
    expect(within(mine).getByText("✓")).toBeInTheDocument(); // verified

    // Đánh giá chưa xác thực đã xem thì không có dấu.
    expect(within(rowOf("Tạm được.")).queryByText("✓")).not.toBeInTheDocument();
    expect(screen.getByText(`${fx.reviews.length} mục`)).toBeInTheDocument();
  });

  it("lọc theo số sao", async () => {
    await setup();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Lọc theo số sao" }),
      "3 sao",
    );

    await waitFor(() => expect(users()).toEqual(["Khán Giả Khác"]));
    expect(screen.getByText("1 mục")).toBeInTheDocument();
  });

  it("tìm được theo tên người dùng, tên phim và nội dung bình luận", async () => {
    await setup();
    const box = screen.getByPlaceholderText(
      "Tìm theo phim / người dùng / nội dung...",
    );

    await userEvent.type(box, "khán giả");
    await waitFor(() => expect(users()).toEqual(["Khán Giả Khác"]));

    await userEvent.clear(box);
    await userEvent.type(box, "rất hay");
    await waitFor(() => expect(users()).toEqual(["Người Dùng"]));

    await userEvent.clear(box);
    await userEvent.type(box, "điện biên");
    await waitFor(() => expect(users()).toHaveLength(2));

    await userEvent.clear(box);
    await userEvent.type(box, "không-có-gì-khớp");
    await waitFor(() =>
      expect(screen.getByText("Không có đánh giá")).toBeInTheDocument(),
    );
  });

  it("quản trị xoá được đánh giá của người khác", async () => {
    await setup();
    await userEvent.click(
      within(rowOf("Tạm được.")).getByRole("button", { name: "Xóa" }),
    );
    await userEvent.click(
      within(dialog()).getByRole("button", { name: "Xóa" }),
    );

    await waitFor(() => expect(deleted).toEqual(["2"]));
    await waitFor(() => expect(users()).toEqual(["Người Dùng"]));
  });

  it("bấm huỷ trong hộp xác nhận thì giữ nguyên đánh giá", async () => {
    await setup();
    await userEvent.click(
      within(rowOf("Tạm được.")).getByRole("button", { name: "Xóa" }),
    );
    await userEvent.click(
      within(dialog()).getByRole("button", { name: "Hủy" }),
    );

    expect(deleted).toHaveLength(0);
    expect(users()).toHaveLength(2);
  });
});
