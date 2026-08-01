import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "test/renderWithProviders";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import MyTickets from "./MyTickets";

const API = "http://localhost:4000/api";

// Fixture: vé #1 gắn suất 1 (còn 2 ngày nữa) — vé #2 gắn suất 2 (đã chiếu).
const UPCOMING_SEATS = "B3";
const PAST_SEATS = "D2, D3";

function Probe() {
  const loc = useLocation();
  return <span data-testid="path">{loc.pathname}</span>;
}

const setup = async () => {
  const r = renderWithProviders(
    <>
      <MyTickets />
      <Probe />
    </>,
    { route: "/tickets", user: fx.user },
  );
  // waitForAuth: chờ kiểm tra phiên xong thì trang mới render.
  await screen.findByRole("tab", { name: "Sắp tới" });
  return r;
};

const tickets = () => document.querySelectorAll(".mytk-k__item");

describe("MyTickets", () => {
  it("chào đúng tên người đang đăng nhập", async () => {
    await setup();
    expect(await screen.findByText("Người Dùng")).toBeInTheDocument();
  });

  it("hiện khung xương trong lúc tải danh sách vé", async () => {
    server.use(
      http.get(`${API}/bookings`, async () => {
        await new Promise((r) => setTimeout(r, 60));
        return HttpResponse.json(fx.bookings);
      }),
    );
    await setup();
    expect(document.querySelectorAll(".ui-skeleton").length).toBeGreaterThan(0);
    await waitFor(() => expect(tickets()).toHaveLength(1));
  });

  it("lỗi tải vé thì báo lỗi và cho thử lại", async () => {
    // Đường ĐỌC của services/api không kiểm r.ok (quyết định giữ nguyên ở T7),
    // nên chỉ lỗi mạng thật mới bật được nhánh này.
    let fail = true;
    server.use(
      http.get(`${API}/bookings`, () => {
        if (fail) return HttpResponse.error();
        return HttpResponse.json(fx.bookings);
      }),
    );
    await setup();

    expect(
      await screen.findByText("Không tải được vé. Thử lại nhé."),
    ).toBeInTheDocument();

    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(tickets()).toHaveLength(1));
  });

  it("tab mặc định chỉ hiện vé của suất chưa chiếu", async () => {
    await setup();
    await waitFor(() => expect(tickets()).toHaveLength(1));

    expect(screen.getByRole("tab", { name: "Sắp tới" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const item = tickets()[0] as HTMLElement;
    expect(within(item).getByText(UPCOMING_SEATS)).toBeInTheDocument();
    expect(item).not.toHaveClass("is-past");
  });

  it("tab 'Đã xem' chỉ hiện vé của suất đã chiếu và làm mờ vé", async () => {
    await setup();
    await waitFor(() => expect(tickets()).toHaveLength(1));

    await userEvent.click(screen.getByRole("tab", { name: "Đã xem" }));
    await waitFor(() => {
      const item = tickets()[0] as HTMLElement;
      expect(within(item).getByText(PAST_SEATS)).toBeInTheDocument();
      expect(item).toHaveClass("is-past");
    });
    expect(tickets()).toHaveLength(1);
  });

  it("vé hiện đủ phim, rạp và phòng lấy từ các lời gọi bổ sung", async () => {
    await setup();
    await waitFor(() => expect(tickets()).toHaveLength(1));

    const item = tickets()[0] as HTMLElement;
    expect(within(item).getByText("Điện Biên Phủ")).toBeInTheDocument();
    expect(within(item).getByText(/Cinema Hoàn Kiếm/)).toBeInTheDocument();
    expect(within(item).getByText(/Phòng 1/)).toBeInTheDocument();
  });

  it("không có vé nào thì mời đi đặt vé", async () => {
    server.use(http.get(`${API}/bookings`, () => HttpResponse.json([])));
    await setup();

    expect(await screen.findByText("Chưa có vé sắp tới")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Đặt vé ngay" }));
    expect(screen.getByTestId("path")).toHaveTextContent("/movies");

    await userEvent.click(screen.getByRole("tab", { name: "Đã xem" }));
    expect(await screen.findByText("Chưa có vé đã xem")).toBeInTheDocument();
  });

  it("vé không tra được suất chiếu thì vẫn nằm ở tab 'Sắp tới'", async () => {
    server.use(
      http.get(`${API}/bookings`, () => HttpResponse.json([fx.bookings[1]])),
      // Suất của vé quá khứ bị xoá khỏi hệ thống -> enrich trả null.
      http.get(`${API}/showtimes/:id`, () =>
        HttpResponse.json({ error: "Not found" }, { status: 404 }),
      ),
    );
    await setup();
    await waitFor(() => expect(tickets()).toHaveLength(1));
    expect(
      within(tickets()[0] as HTMLElement).getByText(PAST_SEATS),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Đã xem" }));
    expect(await screen.findByText("Chưa có vé đã xem")).toBeInTheDocument();
  });

  it("server chưa bật email thì không có nút gửi lại vé", async () => {
    const { unmount } = await setup();
    await waitFor(() => expect(tickets()).toHaveLength(1));
    expect(
      screen.queryByRole("button", { name: "Gửi lại vé qua email" }),
    ).not.toBeInTheDocument();

    unmount(); // dựng lại từ đầu để cấu hình email mới có hiệu lực
    server.use(
      http.get(`${API}/emails/config`, () =>
        HttpResponse.json({ enabled: true }),
      ),
    );
    await setup();
    expect(
      await screen.findByRole("button", { name: "Gửi lại vé qua email" }),
    ).toBeInTheDocument();
  });
});
