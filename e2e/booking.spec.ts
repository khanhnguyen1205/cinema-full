import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

// Luồng đặt vé ĐẦY ĐỦ (có GHI dữ liệu) — tách khỏi smoke.spec.ts vốn chỉ đọc.
// CI chạy trên Postgres dùng-xong-vứt; ở local chạy trên Neon dev, nên test tự
// dọn đơn vừa tạo bằng quyền admin để không để lại rác.

// e2e chỉ chạy ở chế độ dev (web :3000 + API :4000), nên địa chỉ API là cố định.
const API = "http://localhost:4000";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL("/");
}

// Xoá đơn test bằng quyền admin (gateway chỉ cho admin DELETE /api/bookings/:id).
async function deleteBookingAsAdmin(request: APIRequestContext, id: number) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: "admin@cinema.vn", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const del = await request.delete(`${API}/api/bookings/${id}`);
  expect(del.ok()).toBeTruthy();
}

test("đặt vé đầy đủ: chọn ghế → bắp nước → thanh toán → e-ticket → Vé của tôi", async ({
  page,
  request,
}) => {
  let createdId: number | null = null;
  try {
    // Người dùng THƯỜNG (không phải admin) — đúng vai người mua vé.
    await login(page, "a@cinema.vn", "123456");

    // Chọn rạp/suất ở CUỐI danh sách để tránh đụng suất mà smoke test đang giữ ghế.
    await page.goto("/cinemas");
    await page.locator(".venue-k").last().click();
    await expect(page).toHaveURL(/\/cinema\/\d+/);
    await page.locator(".time-k-btn").last().click();
    await expect(page).toHaveURL(/\/seats\/\d+/);

    // ① Ghế — lấy ghế trống ở cuối lưới (giảm khả năng trùng với test khác).
    await expect(page.locator(".seatmap-k__grid")).toBeVisible();
    await page.locator(".seatmap-k__seat:not(.is-booked)").last().click();
    await expect(page.locator(".os-k__seatlist")).not.toHaveText("Chưa chọn");

    // ② Bắp nước — bỏ qua, đi tiếp.
    await page.locator(".os-k__cta").click();
    await expect(page.locator(".fnb-k, .fnb-k__msg").first()).toBeVisible();

    // ③ Thanh toán (demo) — bấm nút "Thanh toán" để GHI đơn thật.
    await page.locator(".os-k__cta").click();
    await expect(page.locator(".pay-k")).toBeVisible();
    await page.getByRole("button", { name: "Thanh toán" }).click();

    // ④ Vé điện tử
    await expect(page.locator(".ticket-k__successtitle")).toBeVisible();
    await expect(page.locator(".eticket-k").first()).toBeVisible();
    const code = await page.locator(".eticket-k__code").first().innerText();
    expect(code).toMatch(/N°TK-\d{5}/);
    createdId = Number(code.replace(/\D/g, "")); // "N°TK-00004" -> 4
    expect(createdId).toBeGreaterThan(0);

    // Vé phải xuất hiện ở "Vé của tôi" (suất trong db có thể đã qua -> thử cả 2 tab).
    await page.locator(".ticket-k__primary").click();
    await expect(page).toHaveURL("/tickets");
    const ticket = page.getByText(code, { exact: false });
    if (
      !(await ticket
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      await page.getByRole("tab", { name: "Đã xem" }).click();
    }
    await expect(ticket.first()).toBeVisible();
  } finally {
    if (createdId) await deleteBookingAsAdmin(request, createdId);
  }
});
