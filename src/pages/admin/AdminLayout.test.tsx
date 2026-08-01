import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "test/renderWithProviders";
import { fx } from "test/fixtures";
import AdminLayout from "./AdminLayout";

// Navbar cũng có link "Phim"/"Rạp" -> mọi truy vấn link phải giới hạn trong
// sidebar quản trị, nếu không sẽ bắt nhầm link của thanh điều hướng chung.
const side = () =>
  document.querySelector(".adm-k__nav") as HTMLElement | null as HTMLElement;

const setup = async (route = "/admin") => {
  const r = renderWithProviders(
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<p>KHUNG TỔNG QUAN</p>} />
        <Route path="movies" element={<p>KHUNG PHIM</p>} />
      </Route>
    </Routes>,
    { route, user: fx.admin },
  );
  await screen.findByText("KHUNG TỔNG QUAN", undefined, { timeout: 2000 });
  return r;
};

describe("AdminLayout", () => {
  it("có đủ 6 mục điều hướng quản trị", async () => {
    await setup();
    expect(
      within(side())
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual([
      "Tổng quan",
      "Phim",
      "Phòng",
      "Suất chiếu",
      "Đơn đặt vé",
      "Đánh giá",
    ]);
  });

  it("đánh dấu mục đang mở và đổi khi chuyển trang", async () => {
    await setup();
    expect(within(side()).getByRole("link", { name: "Tổng quan" })).toHaveClass(
      "is-active",
    );

    await userEvent.click(within(side()).getByRole("link", { name: "Phim" }));

    expect(await screen.findByText("KHUNG PHIM")).toBeInTheDocument();
    expect(within(side()).getByRole("link", { name: "Phim" })).toHaveClass(
      "is-active",
    );
    // `end` trên link index: ở /admin/movies thì "Tổng quan" KHÔNG được sáng.
    expect(
      within(side()).getByRole("link", { name: "Tổng quan" }),
    ).not.toHaveClass("is-active");
  });

  it("nội dung trang con hiện trong vùng nội dung, không phải sidebar", async () => {
    await setup();
    const content = document.querySelector(".adm-k__content") as HTMLElement;
    expect(within(content).getByText("KHUNG TỔNG QUAN")).toBeInTheDocument();
  });
});
