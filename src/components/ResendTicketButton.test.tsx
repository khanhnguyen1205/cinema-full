import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { server } from "test/msw/server";
import { renderWithProviders } from "test/renderWithProviders";
import ResendTicketButton from "./ResendTicketButton";

const API = "http://localhost:4000/api";
const enableEmail = () =>
  server.use(
    http.get(`${API}/emails/config`, () =>
      HttpResponse.json({ enabled: true }),
    ),
  );

describe("ResendTicketButton", () => {
  it("email chưa cấu hình -> không render gì (không báo lỗi)", async () => {
    // handler mặc định trả { enabled: false }
    const { container } = renderWithProviders(
      <ResendTicketButton bookingId={1} />,
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("email đã bật -> hiện nút gửi lại", async () => {
    enableEmail();
    renderWithProviders(<ResendTicketButton bookingId={1} />);
    expect(
      await screen.findByRole("button", { name: "Gửi lại vé qua email" }),
    ).toBeInTheDocument();
  });

  it("bấm gửi: khoá nút khi đang gửi, POST đúng bookingId, xong thì báo thành công", async () => {
    enableEmail();
    let sentBody: unknown = null;
    server.use(
      http.post(`${API}/emails/ticket`, async ({ request }) => {
        sentBody = await request.json();
        await delay(20);
        return HttpResponse.json({ ok: true });
      }),
    );
    renderWithProviders(<ResendTicketButton bookingId={42} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Gửi lại vé qua email" }),
    );

    expect(
      await screen.findByRole("button", { name: "Đang gửi…" }),
    ).toBeDisabled();
    expect(await screen.findByRole("status")).toHaveTextContent("Đã gửi!");
    expect(sentBody).toEqual({ bookingId: 42 });
  });

  it("gửi lỗi -> hiện đúng thông điệp của server", async () => {
    enableEmail();
    server.use(
      http.post(`${API}/emails/ticket`, () =>
        HttpResponse.json(
          { error: "Resend từ chối địa chỉ này." },
          { status: 502 },
        ),
      ),
    );
    renderWithProviders(<ResendTicketButton bookingId={1} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Gửi lại vé qua email" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Resend từ chối địa chỉ này.",
    );
  });
});
