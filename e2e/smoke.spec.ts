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
