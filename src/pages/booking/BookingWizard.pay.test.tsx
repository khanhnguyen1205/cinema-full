import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "test/renderWithProviders";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import type { Booking } from "types";
import BookingWizard from "./BookingWizard";

const API = "http://localhost:4000/api";

// Đơn đã POST lên gateway (thân + header ngôn ngữ) để khẳng định client gửi gì.
let posted: Array<{ body: Partial<Booking>; lang: string | null }>;

beforeEach(() => {
  posted = [];
  server.use(
    http.post(`${API}/bookings`, async ({ request }) => {
      const body = (await request.json()) as Partial<Booking>;
      posted.push({ body, lang: request.headers.get("x-lang") });
      return HttpResponse.json({ ...body, id: 3 }, { status: 201 });
    }),
  );
});

const setup = async () => {
  const r = renderWithProviders(
    <Routes>
      <Route path="/seats/:showtimeId" element={<BookingWizard />} />
    </Routes>,
    { route: "/seats/1", user: fx.user },
  );
  await screen.findByText("Điện Biên Phủ");
  return r;
};

const seat = (n: string) =>
  screen.getByRole("gridcell", { name: new RegExp(`^Ghế ${n},`) });

const seatList = () => document.querySelector(".os-k__seatlist")?.textContent;

// Chọn ghế rồi đi thẳng tới bước ③ (bỏ qua bắp nước).
const goToPay = async (seats = ["B1"]) => {
  const r = await setup();
  for (const s of seats) await userEvent.click(seat(s));
  await userEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  await userEvent.click(await screen.findByRole("button", { name: "Bỏ qua" }));
  await screen.findByText("Phương thức thanh toán");
  return r;
};

describe("BookingWizard — bước ③ thanh toán", () => {
  it("server chưa cấu hình Stripe thì chỉ có phương thức tại quầy", async () => {
    await goToPay();
    expect(screen.getByText("Thanh toán tại quầy")).toBeInTheDocument();
    expect(screen.queryByText("Thẻ quốc tế (Stripe)")).not.toBeInTheDocument();
    expect(screen.getByRole("radio")).toBeChecked();
  });

  it("server có Stripe thì hiện thẻ và chọn sẵn thẻ", async () => {
    server.use(
      http.get(`${API}/payments/config`, () =>
        HttpResponse.json({ enabled: true, publishableKey: "pk_test_giadinh" }),
      ),
    );
    await goToPay();

    const card = await screen.findByRole("radio", {
      name: /Thẻ quốc tế \(Stripe\)/,
    });
    expect(card).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Thanh toán tại quầy/ }),
    ).not.toBeChecked();
  });

  it("đặt vé tại quầy gửi đúng đơn hàng rồi hiện vé điện tử", async () => {
    await goToPay(["B1", "C1"]); // 1 ghế thường + 1 ghế VIP
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    const { body, lang } = posted[0];
    expect(body).toMatchObject({
      movieId: 1,
      showtimeId: 1,
      cinemaId: 1,
      roomId: 1,
      seats: ["B1", "C1"],
      seatTypes: { standard: 1, vip: 1, couple: 0 },
      paymentMethod: "counter",
      userId: fx.user.id,
      seatTotal: 207000, // 90.000 + 117.000
      fnbTotal: 0,
      serviceFee: 15000,
      totalPrice: 222000,
    });
    // Ngôn ngữ email vé đi kèm request (server không đọc được i18n của client).
    expect(lang).toBe("vi");
    // Không phải thẻ -> tuyệt đối không gửi paymentRef.
    expect(body.paymentRef).toBeUndefined();

    expect(await screen.findByText("Đặt vé thành công!")).toBeInTheDocument();
    expect(document.querySelector(".eticket-k__code")?.textContent).toContain(
      "TK-00003",
    );
  });

  it("gateway từ chối thì báo lỗi và giữ nguyên bước thanh toán", async () => {
    server.use(
      http.post(`${API}/bookings`, () =>
        HttpResponse.json({ error: "Ghế đã bán." }, { status: 409 }),
      ),
    );
    await goToPay();
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));

    expect(
      await screen.findByText("Đặt vé thất bại. Vui lòng thử lại."),
    ).toBeInTheDocument();
    expect(screen.getByText("Phương thức thanh toán")).toBeInTheDocument();
  });
});

describe("BookingWizard — ghế bị người khác chiếm", () => {
  it("giữ ghế trả 409 thì rớt đúng ghế đụng độ và quay về bước chọn ghế", async () => {
    server.use(
      http.post(`${API}/holds`, async ({ request }) => {
        const { seats } = (await request.json()) as { seats: string[] };
        // Chỉ B2 bị người khác giữ; B1 vẫn của mình.
        return seats.includes("B2")
          ? HttpResponse.json(
              { error: "Ghế vừa bị người khác giữ.", conflicts: ["B2"] },
              { status: 409 },
            )
          : HttpResponse.json({ ok: true, expiresAt: Date.now() + 480_000 });
      }),
    );
    await setup();
    await userEvent.click(seat("B1"));
    await userEvent.click(seat("B2"));

    expect(
      await screen.findByText(
        "Ghế B2 vừa được người khác giữ. Vui lòng chọn lại.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(seatList()).toBe("B1"));
    expect(screen.getByRole("grid")).toBeInTheDocument(); // vẫn ở bước ①
  });

  it("ghế bị bán ngay trước khi bấm thanh toán thì huỷ đặt và quay về bước ①", async () => {
    await goToPay(["B1"]);
    // Lần kiểm tra cuối ngay trước khi đặt thấy B1 đã bị bán.
    server.use(
      http.get(`${API}/occupied-seats`, () =>
        HttpResponse.json({ showtimeId: "1", seats: ["A1", "A2", "B1"] }),
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));

    expect(
      await screen.findByText(
        "Ghế B1 vừa được người khác đặt. Vui lòng chọn lại.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(seatList()).toBe("Chưa chọn");
    expect(posted).toHaveLength(0); // KHÔNG được tạo đơn nào
  });
});
