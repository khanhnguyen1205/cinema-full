import { test, expect } from "@playwright/test";

// Smoke: các luồng cốt lõi phải sống. Chỉ đọc, không tạo booking (không ghi db.json).

test("trang chủ tải được với thanh điều hướng", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Cinema/i);
  // Link điều hướng desktop nằm trong .nav-k__links (tránh trùng bản mobile ẩn)
  const links = page.locator(".nav-k__links");
  await expect(links.getByRole("link", { name: "Trang chủ" })).toBeVisible();
  await expect(links.getByRole("link", { name: "Phim" })).toBeVisible();
  // Chưa đăng nhập -> có nút Đăng nhập trên navbar
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
});

test("trang chủ: hero và thẻ phim hiển thị", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero-k")).toBeVisible();
  await expect(page.locator(".hero-k__title")).toBeVisible();
  // Lưới "đang chiếu" dựng từ MovieCard -> có ít nhất một thẻ
  expect(await page.locator(".movie-k").count()).toBeGreaterThan(0);
});

test("menu mobile mở được", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  const burger = page.locator(".nav-k__hamburger");
  await expect(burger).toBeVisible();
  await burger.click();
  await expect(page.locator("#nav-mobile.is-open")).toBeVisible();
});

test("trang phim hiển thị tiêu đề, danh sách và lọc theo thể loại", async ({
  page,
}) => {
  await page.goto("/movies");
  await expect(
    page.getByRole("heading", { name: "Tất cả phim" }),
  ).toBeVisible();
  // Lưới dựng từ MovieCard -> có ít nhất một thẻ .movie-k
  await expect(page.locator(".movie-k").first()).toBeVisible();
  // Bấm một chip thể loại (không phải "Tất cả") -> lưới vẫn còn thẻ
  const chip = page.locator(".genre-k-chip", { hasNotText: "Tất cả" }).first();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".movie-k").first()).toBeVisible();
});

test("đăng nhập admin và thấy mục Quản trị", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill("admin@cinema.vn");
  await page.getByPlaceholder("••••••••").fill("admin123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  // Đăng nhập thành công -> điều hướng về trang chủ, navbar đổi sang avatar
  await expect(page).toHaveURL("/");
  const avatar = page.locator(".nav-k__avatar");
  await expect(avatar).toBeVisible();

  // Mở dropdown -> tài khoản admin có link Quản trị
  await avatar.click();
  await expect(page.getByRole("link", { name: "Quản trị" })).toBeVisible();
});

test("trang chi tiết phim: hero, panel đặt vé và giờ chiếu", async ({
  page,
}) => {
  // Vào từ trang phim để lấy một phim thật (không hardcode id)
  await page.goto("/movies");
  await page.locator(".movie-k").first().click();
  await expect(page).toHaveURL(/\/movie\/\d+/);
  // Panel đặt vé hiển thị
  await expect(page.locator(".book-k")).toBeVisible();
  // Có ít nhất một nút giờ chiếu -> bấm -> nút Đặt vé bật (không disabled)
  const timeBtn = page.locator(".time-k-btn").first();
  await expect(timeBtn).toBeVisible();
  await timeBtn.click();
  await expect(page.locator(".book-k__cta")).toBeEnabled();
});

test("trang rạp: tiêu đề, danh sách và lọc theo thành phố", async ({
  page,
}) => {
  await page.goto("/cinemas");
  await expect(
    page.getByRole("heading", { name: "Rạp chiếu phim" }),
  ).toBeVisible();
  await expect(page.locator(".venue-k").first()).toBeVisible();
  const chip = page.locator(".city-k-chip", { hasNotText: "Tất cả" }).first();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
});

test("trang chi tiết rạp: hero và giờ chiếu", async ({ page }) => {
  // Vào từ trang rạp để lấy một rạp thật
  await page.goto("/cinemas");
  await page.locator(".venue-k").first().click();
  await expect(page).toHaveURL(/\/cinema\/\d+/);
  await expect(page.locator(".venue-hero__title")).toBeVisible();
  await expect(page.locator(".time-k-btn").first()).toBeVisible();
});

// Đăng nhập admin dùng lại ở luồng đặt vé (route /seats được PrivateRoute bảo vệ).
async function loginAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill("admin@cinema.vn");
  await page.getByPlaceholder("••••••••").fill("admin123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL("/");
}

test("luồng đặt vé: chọn ghế và qua các bước (không thanh toán)", async ({
  page,
}) => {
  await loginAdmin(page);

  // Vào một suất thật qua rạp -> nút giờ điều hướng thẳng /seats
  await page.goto("/cinemas");
  await page.locator(".venue-k").first().click();
  await expect(page).toHaveURL(/\/cinema\/\d+/);
  await page.locator(".time-k-btn").first().click();
  await expect(page).toHaveURL(/\/seats\/\d+/);

  // Bước ①: sơ đồ ghế hiển thị, chọn một ghế trống
  await expect(page.locator(".seatmap-k__grid")).toBeVisible();
  await page.locator(".seatmap-k__seat:not(.is-booked)").first().click();
  await expect(page.locator(".os-k__seatlist")).not.toHaveText("Chưa chọn");

  // Sang bước ② rồi ③ (KHÔNG bấm Thanh toán -> không ghi db.json)
  await page.locator(".os-k__cta").click();
  await expect(page.locator(".fnb-k, .fnb-k__msg").first()).toBeVisible();
  await page.locator(".os-k__cta").click();
  await expect(page.locator(".pay-k")).toBeVisible();
});

test("trang vé của tôi hiển thị sau khi đăng nhập", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Vé của tôi" })).toBeVisible();
  await expect(page.locator(".mytk-k__tab").first()).toBeVisible();
});

// Admin: vào bảng quản trị (chỉ đọc, không ghi db.json).
test("admin: vào bảng quản trị phim", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin");
  await expect(page.locator(".adm-k__nav").first()).toBeVisible();
  await page.locator(".adm-k__nav").getByRole("link", { name: "Phim" }).click();
  await expect(page).toHaveURL(/\/admin\/movies/);
  await expect(page.locator(".adm-k__table")).toBeVisible();
});

// MovieDetail: khu đánh giá của khán giả hiển thị (chỉ đọc, từ seed mẫu).
test("phim: khu đánh giá của khán giả hiển thị điểm + danh sách", async ({
  page,
}) => {
  await page.goto("/movie/1");
  await expect(
    page.getByText("Đánh giá của khán giả", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".rev-k__item").first()).toBeVisible();
  await expect(page.locator(".rev-k__badge").first()).toBeVisible(); // badge "Đã xem"
});
