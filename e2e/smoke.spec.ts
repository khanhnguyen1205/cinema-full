import { test, expect } from "@playwright/test";

// Smoke: các luồng cốt lõi phải sống. Chỉ đọc, không tạo booking (không ghi db.json).

test("trang chủ tải được với thanh điều hướng", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Cinema/i);
  const nav = page.locator("nav.navbar");
  await expect(nav.getByRole("link", { name: "Trang chủ" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Phim" })).toBeVisible();
  // Chưa đăng nhập -> có nút Đăng nhập trên navbar
  await expect(nav.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
});

test("trang phim hiển thị tiêu đề và danh sách phim", async ({ page }) => {
  await page.goto("/movies");
  await expect(
    page.getByRole("heading", { name: "Tất cả phim" }),
  ).toBeVisible();
  // Dữ liệu tải từ gateway -> có ít nhất một thẻ phim
  await expect(page.locator(".movie-card").first()).toBeVisible();
});

test("đăng nhập admin và thấy mục Quản trị", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill("admin@cinema.vn");
  await page.getByPlaceholder("••••••••").fill("admin123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  // Đăng nhập thành công -> điều hướng về trang chủ, navbar đổi sang avatar
  await expect(page).toHaveURL("/");
  const avatar = page.locator(".user-avatar");
  await expect(avatar).toBeVisible();

  // Mở dropdown -> tài khoản admin có link Quản trị
  await avatar.click();
  await expect(page.getByRole("link", { name: "Quản trị" })).toBeVisible();
});
