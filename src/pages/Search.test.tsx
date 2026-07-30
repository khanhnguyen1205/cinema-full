import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "test/renderWithProviders";
import Search from "./Search";

function Probe() {
  const loc = useLocation();
  return (
    <span data-testid="path">
      {loc.pathname}
      {loc.search}
    </span>
  );
}

// Tiêu đề mỗi khu đi qua KineticHeading (tách từng ký tự, nối bằng nbsp) và
// "Phim"/"Rạp" còn trùng nhãn điều hướng ở Navbar -> nhận diện khu bằng thứ
// nó chứa, không bằng chữ.
const sectionWith = (selector: string) =>
  (document.querySelector(selector)?.closest("section") as HTMLElement) ?? null;
const moviesSec = () => sectionWith(".search-k__more");
const cinemasSec = () => sectionWith(".venue-k");
const showsSec = () => sectionWith(".search-k__shows");

const setup = async (route: string, ready: () => unknown) => {
  const r = renderWithProviders(
    <>
      <Search />
      <Probe />
    </>,
    { route },
  );
  await waitFor(() => expect(ready()).toBeTruthy());
  return r;
};

describe("Search", () => {
  it("chưa nhập gì thì chỉ gợi ý cách dùng, không có khu kết quả", async () => {
    await setup("/search", () =>
      screen.queryByText("Nhập từ khoá để tìm phim, rạp, suất chiếu."),
    );
    expect(document.querySelectorAll(".search-k__sechd")).toHaveLength(0);
  });

  it("?q= khớp tên rạp cho ra khu Rạp và khu Suất chiếu, không có khu Phim", async () => {
    await setup("/search?q=cinema", cinemasSec);
    expect(within(cinemasSec()!).getAllByText(/Cinema/).length).toBeGreaterThan(
      0,
    );
    expect(showsSec()).toBeTruthy();
    expect(moviesSec()).toBeNull(); // không phim nào tên "cinema"
  });

  it("tìm không dấu ra phim và mang từ khoá sang trang Phim", async () => {
    await setup("/search?q=dien bien", moviesSec);
    expect(within(moviesSec()!).getByText("Điện Biên Phủ")).toBeInTheDocument();
    expect(
      within(moviesSec()!).getByRole("link", {
        name: "Lọc chi tiết trên trang Phim →",
      }),
    ).toHaveAttribute("href", "/movies?q=dien%20bien");
  });

  it("khu suất chiếu bỏ qua suất đã chiếu", async () => {
    await setup("/search?q=dien bien", showsSec);
    // Phim 1 có 2 suất trong fixture, một suất đã qua.
    expect(within(showsSec()!).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("2 kết quả")).toBeInTheDocument(); // 1 phim + 1 suất
  });

  it("bấm một suất chuyển sang trang chọn ghế", async () => {
    await setup("/search?q=dien bien", showsSec);
    await userEvent.click(
      within(showsSec()!).getByRole("button", { name: /Chọn ghế/ }),
    );
    expect(screen.getByTestId("path")).toHaveTextContent("/seats/1");
  });

  it("gõ vào ô tìm kiếm ghi thẳng vào URL", async () => {
    await setup("/search", () =>
      screen.queryByText("Nhập từ khoá để tìm phim, rạp, suất chiếu."),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Tìm phim, rạp, suất chiếu..." }),
      "endgame",
    );
    await waitFor(() =>
      expect(screen.getByTestId("path")).toHaveTextContent("q=endgame"),
    );
    await waitFor(() => expect(moviesSec()).toBeTruthy());
    expect(within(moviesSec()!).getByText("Endgame")).toBeInTheDocument();
  });

  it("không khớp gì thì báo rỗng kèm chính từ khoá", async () => {
    await setup("/search?q=zzzz", () =>
      screen.queryByText("Không tìm thấy kết quả cho “zzzz”"),
    );
    expect(screen.getByText("Thử từ khoá ngắn hơn.")).toBeInTheDocument();
    expect(screen.getByText("0 kết quả")).toBeInTheDocument();
  });
});
