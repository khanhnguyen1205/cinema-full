import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

// Luồng review ĐẦY ĐỦ (có GHI dữ liệu) — tách khỏi smoke.spec.ts vốn chỉ đọc.
// Chọn phim user1 CHƯA review trong seed (movie 7) để tránh 409. Tự dọn ở finally.

const API = "http://localhost:4000";
const MOVIE_ID = 7; // user1 (a@cinema.vn) chưa review phim này trong seed
const MARKER = "E2E review test — sẽ xoá.";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL("/");
}

// Dọn cứng: admin xoá mọi review test còn sót trên phim (gateway cho admin DELETE).
async function cleanupAsAdmin(request: APIRequestContext) {
  const auth = await request.post(`${API}/auth/login`, {
    data: { email: "admin@cinema.vn", password: "admin123" },
  });
  expect(auth.ok()).toBeTruthy();
  const res = await request.get(`${API}/api/reviews?movieId=${MOVIE_ID}`);
  const list = (await res.json()) as Array<{ id: number; comment?: string }>;
  for (const r of list) {
    if (r.comment === MARKER) {
      await request.delete(`${API}/api/reviews/${r.id}`);
    }
  }
}

test("user viết & xoá đánh giá phim (ghi thật, tự dọn)", async ({
  page,
  request,
}) => {
  try {
    await login(page, "a@cinema.vn", "123456");
    await page.goto(`/movie/${MOVIE_ID}`);

    const section = page.locator(".rev-k");
    await section.scrollIntoViewIfNeeded();

    // Chấm 4 sao trong form input rồi gửi.
    await section.locator(".ui-stars--input .ui-stars__btn").nth(3).click();
    await section.locator(".rev-k__textarea").fill(MARKER);
    await section
      .getByRole("button", { name: /Gửi đánh giá|Cập nhật/ })
      .click();

    // Review của mình xuất hiện.
    await expect(section.getByText(MARKER, { exact: false })).toBeVisible();

    // Dọn qua UI: xoá review của chính mình (khối "Đánh giá của bạn").
    page.on("dialog", (d) => d.accept());
    await section
      .locator(".rev-k__mine")
      .getByRole("button", { name: "Xoá" })
      .click();
    await expect(section.getByText(MARKER, { exact: false })).toHaveCount(0);
  } finally {
    await cleanupAsAdmin(request);
  }
});
