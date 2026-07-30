import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "test/renderWithProviders";
import { fx } from "test/fixtures";
import type { User } from "types";
import MovieDetail from "./MovieDetail";

const setup = async (movieId: number, user: User | null = null) => {
  const r = renderWithProviders(
    <Routes>
      <Route path="/movie/:id" element={<MovieDetail />} />
    </Routes>,
    { route: `/movie/${movieId}`, user },
  );
  await screen.findByText("Đánh giá của khán giả");
  return r;
};

const box = () => document.querySelector(".rev-k") as HTMLElement;
const list = () => document.querySelector(".rev-k__list") as HTMLElement;
// Khối "Đánh giá của bạn" lặp lại nội dung review của chính mình, nên nhiều
// chuỗi/nút xuất hiện hai lần -> luôn soi có phạm vi.
const mineBox = () => document.querySelector(".rev-k__mine") as HTMLElement;

afterEach(() => vi.restoreAllMocks());

describe("MovieDetail — khu đánh giá của khán giả", () => {
  it("hiện điểm trung bình và số lượng đánh giá", async () => {
    await setup(1);
    // Fixture phim 1: 5 sao + 3 sao -> trung bình 4.0
    expect(box().querySelector(".rev-k__avg")?.textContent).toBe("4.0");
    expect(within(box()).getByText("2 đánh giá")).toBeInTheDocument();
  });

  it("liệt kê đánh giá, gắn badge 'Đã xem' đúng người đã mua vé", async () => {
    await setup(1);
    const rows = within(list()).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    // Người đã xác thực có badge; người kia thì không.
    const mine = rows.find((r) => r.textContent?.includes("Người Dùng"))!;
    const other = rows.find((r) => r.textContent?.includes("Khán Giả Khác"))!;
    expect(within(mine).getByText("Đã xem")).toBeInTheDocument();
    expect(within(other).queryByText("Đã xem")).not.toBeInTheDocument();
  });

  it("khách chưa đăng nhập được mời đăng nhập, không có ô nhập", async () => {
    await setup(1);
    expect(
      within(box()).getByRole("link", { name: "Đăng nhập" }),
    ).toBeInTheDocument();
    expect(
      within(box()).queryByRole("radiogroup", {
        name: "Chấm điểm từ 1 đến 5 sao",
      }),
    ).not.toBeInTheDocument();
  });

  it("user đã đánh giá phim này thì thấy khối 'Đánh giá của bạn' thay vì form", async () => {
    await setup(1, fx.user);
    expect(within(box()).getByText("Đánh giá của bạn")).toBeInTheDocument();
    expect(
      within(box()).getByRole("button", { name: "Sửa" }),
    ).toBeInTheDocument();
  });

  it("gửi đánh giá mới cho phim chưa từng đánh giá", async () => {
    await setup(2, fx.user);
    expect(
      within(box()).getByText("Chưa có đánh giá — hãy là người đầu tiên!"),
    ).toBeInTheDocument();

    await userEvent.click(within(box()).getByRole("radio", { name: "4 sao" }));
    await userEvent.type(
      within(box()).getByRole("textbox"),
      "Xem ổn, hình đẹp.",
    );
    await userEvent.click(
      within(box()).getByRole("button", { name: "Gửi đánh giá" }),
    );

    await waitFor(() =>
      expect(within(list()).getByText("Xem ổn, hình đẹp.")).toBeInTheDocument(),
    );
    expect(within(box()).getByText("1 đánh giá")).toBeInTheDocument();
    // Sau khi gửi, form nhường chỗ cho khối "Đánh giá của bạn".
    expect(within(box()).getByText("Đánh giá của bạn")).toBeInTheDocument();
  });

  it("chưa chọn sao mà bấm gửi thì báo lỗi, không gọi API", async () => {
    await setup(2, fx.user);
    await userEvent.click(
      within(box()).getByRole("button", { name: "Gửi đánh giá" }),
    );
    expect(
      within(box()).getByText("Vui lòng chọn số sao."),
    ).toBeInTheDocument();
    expect(
      within(box()).getByText("Chưa có đánh giá — hãy là người đầu tiên!"),
    ).toBeInTheDocument();
  });

  it("sửa đánh giá của mình: nạp sẵn nội dung cũ rồi cập nhật", async () => {
    await setup(1, fx.user);
    await userEvent.click(within(box()).getByRole("button", { name: "Sửa" }));

    const textarea = within(box()).getByRole("textbox");
    expect(textarea).toHaveValue("Rất hay.");

    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Xem lại vẫn hay.");
    await userEvent.click(
      within(box()).getByRole("button", { name: "Cập nhật" }),
    );

    await waitFor(() =>
      expect(within(list()).getByText("Xem lại vẫn hay.")).toBeInTheDocument(),
    );
    expect(within(box()).queryByText("Rất hay.")).not.toBeInTheDocument();
  });

  it("xoá đánh giá của mình sau khi xác nhận", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await setup(1, fx.user);
    await userEvent.click(
      within(mineBox()).getByRole("button", { name: "Xoá" }),
    );

    await waitFor(() =>
      expect(within(box()).queryByText("Rất hay.")).not.toBeInTheDocument(),
    );
    expect(within(box()).getByText("1 đánh giá")).toBeInTheDocument();
    // Xoá xong lại thấy form để đánh giá lại.
    expect(
      within(box()).getByRole("button", { name: "Gửi đánh giá" }),
    ).toBeInTheDocument();
  });

  it("bấm Xoá rồi huỷ hộp xác nhận thì giữ nguyên đánh giá", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await setup(1, fx.user);
    await userEvent.click(
      within(mineBox()).getByRole("button", { name: "Xoá" }),
    );
    expect(within(list()).getByText("Rất hay.")).toBeInTheDocument();
  });

  it("admin xoá được đánh giá của người khác", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await setup(1, fx.admin);
    const rows = within(list()).getAllByRole("listitem");
    const other = rows.find((r) => r.textContent?.includes("Khán Giả Khác"))!;

    await userEvent.click(within(other).getByRole("button", { name: "Xoá" }));
    await waitFor(() =>
      expect(within(box()).queryByText("Tạm được.")).not.toBeInTheDocument(),
    );
  });
});
