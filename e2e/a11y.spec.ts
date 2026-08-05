import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Cổng trợ năng: quét axe-core trên trình duyệt THẬT với CSS thật và dữ liệu
// thật từ Postgres — nhờ vậy mới bắt được lỗi tương phản màu (happy-dom trong
// unit test không áp CSS nên hoàn toàn mù với loại lỗi này).
//
// Chỉ ĐỌC, đúng luật của smoke.spec.ts: đi tới bước ③ của luồng đặt vé nhưng
// không bấm Thanh toán, không tạo/sửa/xoá gì.

// Quy tắc được phép bỏ qua — phải kèm lý do ngay tại chỗ. Cố tình để RỖNG:
// tương phản màu KHÔNG được đưa vào đây (đã chốt là sửa token cho đạt chuẩn).
const EXCLUDED_RULES: string[] = [];

// Chỉ chặn ở critical/serious. moderate/minor vẫn in ra để biết mà không làm
// đỏ CI: đặt ngưỡng ở "mọi vi phạm" thì lần đầu sẽ đỏ vì những thứ còn tranh
// cãi được, rồi kết cục là ai đó tắt cả cổng.
const BLOCKING = ["critical", "serious"];

// Quét khi hiệu ứng đã tắt. Hero mở bằng animation opacity 0→1 dài 480ms; máy
// CI chạy song song nên axe từng chộp đúng lúc nó mới tới ~86%, và báo trắng
// trên đỏ là 4,33:1 trong khi màu thật đạt 4,72:1 — một lỗi tương phản không
// có thật, chỉ xuất hiện khi máy chậm. CSS của app vốn đã tôn trọng
// prefers-reduced-motion, nên bật cờ này là quét đúng màu cuối.
test.use({ reducedMotion: "reduce" });

async function scan(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page })
    .disableRules(EXCLUDED_RULES)
    .analyze();

  const blocking = violations.filter((v) => BLOCKING.includes(v.impact ?? ""));
  const light = violations.filter((v) => !BLOCKING.includes(v.impact ?? ""));

  if (light.length)
    console.log(
      `[a11y] ${name} — ${light.length} vi phạm nhẹ (không chặn): ` +
        light.map((v) => `${v.id}(${v.impact})`).join(", "),
    );

  // Thông điệp phải nêu ĐÍCH DANH nút/ô nào sai, không thì người sửa phải tự
  // đi dò lại toàn trang.
  const report = blocking
    .map(
      (v) =>
        `\n  • [${v.impact}] ${v.id}: ${v.help}\n` +
        v.nodes
          .slice(0, 4)
          // Kèm luôn dữ liệu của axe (vd tỉ lệ tương phản đo được và ngưỡng
          // cần đạt) — không có nó thì người sửa phải tự đi dò lại từng màu.
          .map(
            (n) =>
              `      ${n.target.join(" ")}  ${JSON.stringify(n.any.map((a) => a.data))}`,
          )
          .join("\n"),
    )
    .join("");

  expect(blocking, `${name} có vi phạm trợ năng:${report}\n`).toEqual([]);
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL("/");
}

// --- Trang công khai -------------------------------------------------------

test("a11y: trang chủ", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".movie-k").first()).toBeVisible();
  await scan(page, "/");
});

test("a11y: danh sách phim", async ({ page }) => {
  await page.goto("/movies");
  await expect(page.locator(".movie-k").first()).toBeVisible();
  await scan(page, "/movies");
});

test("a11y: chi tiết phim", async ({ page, request }) => {
  // Lấy phim còn suất chưa chiếu (không hardcode id): panel đặt vé chỉ chào bán
  // suất chưa chiếu nên phim đầu bảng có thể rỗng tùy giờ chạy.
  const res = await request.get("http://localhost:4000/api/showtimes");
  const showtimes = (await res.json()) as { movieId: number; time: string }[];
  const p = (n: number): string => String(n).padStart(2, "0");
  const d = new Date();
  const nowKey = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  const upcoming = showtimes.find((s) => s.time >= nowKey);
  expect(upcoming, "cần ít nhất một suất chưa chiếu trong DB").toBeTruthy();

  await page.goto(`/movie/${upcoming!.movieId}`);
  await expect(page.locator(".book-k")).toBeVisible();
  await scan(page, "/movie/:id");
});

test("a11y: danh sách rạp", async ({ page }) => {
  await page.goto("/cinemas");
  await expect(page.locator(".venue-k").first()).toBeVisible();
  await scan(page, "/cinemas");
});

test("a11y: chi tiết rạp", async ({ page }) => {
  await page.goto("/cinemas");
  await page.locator(".venue-k").first().click();
  await expect(page).toHaveURL(/\/cinema\/\d+/);
  await expect(page.locator(".venue-hero__title")).toBeVisible();

  // Khối lịch chiếu nằm trong <Reveal> — chưa cuộn tới thì nó còn opacity:0 và
  // axe bỏ qua. Không chờ ở đây thì phép quét thành MAY RỦI: chạy nhanh là
  // xanh, chạy chậm là đỏ. Đúng cách này mới lộ ra lỗi tương phản ở nút giờ.
  await page.locator(".sched-k").first().scrollIntoViewIfNeeded();
  await expect(
    page.locator(".ui-reveal.is-visible .sched-k").first(),
  ).toBeVisible();

  await scan(page, "/cinema/:id");
});

test("a11y: trang tìm kiếm", async ({ page }) => {
  await page.goto("/search?q=a");
  await expect(page.locator(".search-k__head, h1").first()).toBeVisible();
  await scan(page, "/search");
});

// Trang 404 cũng phải quét: nó là màn hình DUY NHẤT người dùng thấy khi đi
// lạc, nên đây là chỗ tệ nhất để có lỗi trợ năng.
test("a11y: trang 404", async ({ page }) => {
  await page.goto("/duong-dan-khong-ton-tai");
  await expect(page.locator(".nf-k__title")).toBeVisible();
  await scan(page, "/404");
});

test("a11y: đăng nhập", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("your@email.com")).toBeVisible();
  await scan(page, "/login");
});

test("a11y: đăng ký", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByPlaceholder("your@email.com")).toBeVisible();
  await scan(page, "/register");
});

// --- Sau khi đăng nhập -----------------------------------------------------

test("a11y: vé của tôi", async ({ page }) => {
  await login(page, "a@cinema.vn", "123456");
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Vé của tôi" })).toBeVisible();
  // Tiêu đề hiện NGAY, còn danh sách vé nạp bất đồng bộ — quét luôn là quét một
  // trang chưa có nội dung. Chỗ này từng xanh ở máy dev (Neon ở xa, vé chưa kịp
  // vẽ) và đỏ trên CI (Postgres localhost, vé hiện tức thì), tức cái xanh kia là
  // may chứ không phải đúng. Chờ tới khi có vé HOẶC có ô "chưa có vé" rồi mới quét.
  await page
    .locator(".mytk-k__item, .mytk-k__empty")
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
  await scan(page, "/tickets");
});

test("a11y: ba bước đầu của luồng đặt vé", async ({ page }) => {
  await login(page, "a@cinema.vn", "123456");
  await page.goto("/cinemas");
  await page.locator(".venue-k").first().click();
  await page.locator(".time-k-btn").first().click();
  await expect(page).toHaveURL(/\/seats\/\d+/);

  // ① sơ đồ ghế
  await expect(page.locator(".seatmap-k__grid")).toBeVisible();
  await scan(page, "/seats/:id bước ① chọn ghế");

  // Ghế CUỐI, không phải ghế đầu. smoke.spec.ts cũng vào đúng rạp đầu / suất
  // đầu và cũng bấm ghế đầu tiên còn trống; Playwright chạy hai spec song song
  // nên ai giữ ghế trước thì người kia ăn 409, wizard bỏ ghế trùng, và
  // .os-k__seatlist đứng yên ở "Chưa chọn". Đây là chỗ chập chờn có sẵn, chỉ
  // chưa nổ vì lịch chạy cũ; hai spec phải giành hai ghế khác nhau.
  await page.locator(".seatmap-k__seat:not(.is-booked)").last().click();
  await expect(page.locator(".os-k__seatlist")).not.toHaveText("Chưa chọn");

  // ② bắp nước
  await page.locator(".os-k__cta").click();
  await expect(page.locator(".fnb-k, .fnb-k__msg").first()).toBeVisible();
  await scan(page, "/seats/:id bước ② bắp nước");

  // ③ thanh toán — KHÔNG bấm Thanh toán để không ghi dữ liệu
  await page.locator(".os-k__cta").click();
  await expect(page.locator(".pay-k")).toBeVisible();
  await scan(page, "/seats/:id bước ③ thanh toán");
});

// --- Quản trị --------------------------------------------------------------

test("a11y: bảng quản trị", async ({ page }) => {
  await login(page, "admin@cinema.vn", "admin123");

  await page.goto("/admin");
  await expect(page.locator(".adm-k__stat").first()).toBeVisible();
  await scan(page, "/admin tổng quan");

  for (const [path, label] of [
    ["/admin/movies", "phim"],
    ["/admin/showtimes", "suất chiếu"],
    ["/admin/bookings", "đơn đặt vé"],
  ]) {
    await page.goto(path);
    await expect(page.locator(".adm-k__table")).toBeVisible();
    await scan(page, `/admin ${label}`);
  }
});

test("a11y: hộp thoại đang mở", async ({ page }) => {
  // Dialog là nơi lỗi trợ năng hay nằm nhất (focus, aria-modal, nhãn) mà quét
  // trang đóng không bao giờ thấy.
  await login(page, "admin@cinema.vn", "admin123");
  await page.goto("/admin/movies");
  await page.getByRole("button", { name: "+ Thêm phim" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await scan(page, "/admin/movies + modal thêm phim");
});
