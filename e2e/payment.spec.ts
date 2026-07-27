import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

// Luồng thanh toán THẺ qua Stripe test-mode (có GHI dữ liệu).
// Tự bỏ qua khi máy/CI không có key => CI không phụ thuộc mạng ra Stripe.
const API = "http://localhost:4000";
const hasStripe = Boolean(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY,
);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL("/");
}

async function deleteBookingAsAdmin(request: APIRequestContext, id: number) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: "admin@cinema.vn", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const del = await request.delete(`${API}/api/bookings/${id}`);
  expect(del.ok()).toBeTruthy();
}

test("thanh toán bằng thẻ Stripe test → e-ticket", async ({
  page,
  request,
}) => {
  test.skip(!hasStripe, "Thiếu STRIPE_SECRET_KEY/STRIPE_PUBLISHABLE_KEY");
  test.setTimeout(90_000); // iframe Stripe + xác nhận qua mạng

  let createdId: number | null = null;
  try {
    await login(page, "a@cinema.vn", "123456");

    await page.goto("/cinemas");
    await page.locator(".venue-k").last().click();
    await page.locator(".time-k-btn").last().click();
    await expect(page).toHaveURL(/\/seats\/\d+/);

    // ① ghế cuối lưới (tránh đụng test khác chạy song song)
    await expect(page.locator(".seatmap-k__grid")).toBeVisible();
    await page.locator(".seatmap-k__seat:not(.is-booked)").last().click();
    await expect(page.locator(".os-k__seatlist")).not.toHaveText("Chưa chọn");

    // ② bỏ qua bắp nước
    await page.locator(".os-k__cta").click();
    await expect(page.locator(".fnb-k, .fnb-k__msg").first()).toBeVisible();

    // ③ thẻ
    await page.locator(".os-k__cta").click();
    await expect(page.locator(".pay-k")).toBeVisible();
    await page.locator(".pay-k__card", { hasText: "Stripe" }).click();
    await expect(page.locator(".pay-k__stripe")).toBeVisible();

    // Payment Element dựng nhiều iframe; iframe nhập liệu có title cố định này.
    const frame = page.frameLocator(
      'iframe[title="Secure payment input frame"]',
    );
    await frame
      .getByPlaceholder("1234 1234 1234 1234")
      .fill("4242424242424242");
    await frame.getByPlaceholder("MM / YY").fill("12 / 34");
    await frame.getByPlaceholder("CVC").fill("123");

    await page.getByRole("button", { name: "Thanh toán" }).click();

    // ④ vé điện tử
    await expect(page.locator(".ticket-k__successtitle")).toBeVisible({
      timeout: 45_000,
    });
    const code = await page.locator(".eticket-k__code").first().innerText();
    expect(code).toMatch(/N°TK-\d{5}/);
    createdId = Number(code.replace(/\D/g, ""));
    expect(createdId).toBeGreaterThan(0);
    await expect(page.locator(".eticket-k__paid")).toContainText("pi_");
  } finally {
    if (createdId) await deleteBookingAsAdmin(request, createdId);
  }
});
