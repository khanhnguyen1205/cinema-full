import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import { renderWithProviders } from "test/renderWithProviders";
import Home from "./Home";

const API = "http://localhost:4000/api";

// Home điều hướng bằng useNavigate -> quan sát bằng đường dẫn + state.
function Probe() {
  const loc = useLocation();
  return (
    <span data-testid="path">
      {loc.pathname}
      {(loc.state as { genre?: string } | null)?.genre
        ? `#${(loc.state as { genre: string }).genre}`
        : ""}
    </span>
  );
}

const setup = async () => {
  const r = renderWithProviders(
    <>
      <Home />
      <Probe />
    </>,
  );
  // Chờ qua khỏi khối skeleton (hero chỉ hiện khi đã có phim).
  await screen.findByText("Phim nổi bật");
  return r;
};

const hero = () => screen.getByText("Phim nổi bật").closest("section")!;
// Tiêu đề hero đi qua KineticHeading (mỗi ký tự một <span>) nên getByText không
// khớp — đọc textContent của chính khối tiêu đề.
const heroTitle = () =>
  hero().querySelector(".hero-k__title")?.textContent ?? "";

describe("Home", () => {
  it("hiện skeleton trước, rồi tới lưới phim thật", async () => {
    const { container } = renderWithProviders(<Home />);
    // Trước khi dữ liệu về: chưa có tiêu đề khu "Phim đang chiếu".
    expect(screen.queryByText("Phim đang chiếu")).not.toBeInTheDocument();

    expect(await screen.findByText("Phim đang chiếu")).toBeInTheDocument();
    expect(container.querySelectorAll(".movie-k").length).toBe(
      fx.movies.length,
    );
  });

  it("hero mở bằng phim đầu tiên và có nút đặt vé", async () => {
    await setup();
    expect(heroTitle()).toBe("Điện Biên Phủ");
    expect(
      within(hero()).getByRole("button", { name: "▶ Đặt vé" }),
    ).toBeInTheDocument();
  });

  it("bấm tab N°02 chuyển sang phim thứ hai", async () => {
    await setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Phim nổi bật 2" }),
    );
    expect(heroTitle()).toBe("Endgame");
  });

  it("mũi tên tiến/lùi xoay vòng qua danh sách nổi bật", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "Phim sau" }));
    expect(heroTitle()).toBe("Endgame");

    // Lùi từ phim đầu phải vòng về phim CUỐI, không âm chỉ số.
    await userEvent.click(screen.getByRole("button", { name: "Phim trước" }));
    await userEvent.click(screen.getByRole("button", { name: "Phim trước" }));
    expect(heroTitle()).toBe(fx.movies[fx.movies.length - 1].title);
  });

  it("bấm nút đặt vé ở hero mở trang chi tiết phim đang xem", async () => {
    await setup();
    await userEvent.click(
      within(hero()).getByRole("button", { name: "▶ Đặt vé" }),
    );
    expect(screen.getByTestId("path")).toHaveTextContent("/movie/1");
  });

  it("ô thể loại mang genre sang trang Phim", async () => {
    const { container } = await setup();
    // Nhãn hiển thị là bản đã dịch, còn state mang MÃ thể loại của DB.
    // Thẻ phim cũng in nhãn thể loại -> chỉ soi trong lưới ô thể loại.
    const tiles = container.querySelector(".genre-k-grid") as HTMLElement;
    await userEvent.click(
      within(tiles).getByRole("button", { name: /Khoa học viễn tưởng/ }),
    );
    expect(screen.getByTestId("path")).toHaveTextContent("/movies#Sci-Fi");
  });

  it("dải thống kê đếm đúng số phim/rạp/thành phố/suất chiếu", async () => {
    const { container } = await setup();
    const nums = Array.from(
      container.querySelectorAll(".stats-k__num"),
      (n) => n.textContent,
    );
    expect(nums).toEqual([
      String(fx.movies.length),
      String(fx.cinemas.length),
      String(fx.cities.length),
      String(fx.showtimes.length),
    ]);
  });

  it("bấm một rạp mở trang rạp đó", async () => {
    await setup();
    await userEvent.click(screen.getByText("Cinema Hải Châu"));
    expect(screen.getByTestId("path")).toHaveTextContent("/cinema/2");
  });

  it("tải phim lỗi thì báo lỗi kèm nút Thử lại (không phải trang trắng)", async () => {
    // Lỗi MẠNG (fetch reject) — services/api không kiểm r.ok ở đường đọc, nên
    // một mã 500 vẫn "thành công" và trả thân lỗi; chỉ mất mạng mới ra isError.
    server.use(http.get(`${API}/movies`, () => HttpResponse.error()));
    renderWithProviders(<Home />);
    expect(
      await screen.findByText(
        "Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.",
      ),
    ).toBeInTheDocument();

    // Nút Thử lại phải gọi lại API — lần này cho nó trả bình thường.
    server.use(http.get(`${API}/movies`, () => HttpResponse.json(fx.movies)));
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Phim đang chiếu")).toBeInTheDocument();
  });
});
