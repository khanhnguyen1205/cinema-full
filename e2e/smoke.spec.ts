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
  // Bấm một chip thể loại (không phải "Tất cả") -> lưới vẫn còn thẻ.
  // Bọc trong toPass vì dải chip dựng lại khi dữ liệu thể loại về: cú bấm có
  // thể rơi đúng lúc React thay node, DOM nhận click nhưng handler thì không.
  const chip = page.locator(".genre-k-chip", { hasNotText: "Tất cả" }).first();
  await expect(async () => {
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true", {
      timeout: 1500,
    });
  }).toPass({ timeout: 15000 });
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
  request,
}) => {
  // Hỏi API lấy một phim CÒN suất chưa chiếu (không hardcode id).
  // Không lấy thẻ phim đầu bảng: panel chỉ chào bán suất chưa chiếu, mà phim đầu
  // bảng có thể đã chiếu hết suất -> test đỏ theo giờ chạy.
  const res = await request.get("http://localhost:4000/api/showtimes");
  const showtimes = (await res.json()) as { movieId: number; time: string }[];
  const p = (n: number): string => String(n).padStart(2, "0");
  const now = new Date();
  const nowKey = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
  const upcoming = showtimes.find((s) => s.time >= nowKey);
  expect(upcoming, "cần ít nhất một suất chưa chiếu trong DB").toBeTruthy();

  await page.goto(`/movie/${upcoming!.movieId}`);
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
  // Cùng lý do giòn như chip thể loại ở trên — xem chú thích ở đó.
  const chip = page.locator(".city-k-chip", { hasNotText: "Tất cả" }).first();
  await expect(async () => {
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true", {
      timeout: 1500,
    });
  }).toPass({ timeout: 15000 });
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

// Search nâng cao (chỉ đọc): ô toàn cục, trang /search, lọc Movies đồng bộ URL.
test("ô search toàn cục: dropdown gợi ý + Enter tới /search", async ({
  page,
}) => {
  await page.goto("/movies");
  // Chỉ combobox desktop nằm trong accessibility tree (bản mobile display:none)
  const box = page.getByRole("combobox", { name: /Tìm phim, rạp/ });
  await box.fill("aveng");
  await expect(page.locator(".gsearch__item").first()).toBeVisible();
  await box.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=aveng/);
});

// Ô search nằm trên Navbar nên có mặt ở mọi trang; nó từng chỉ đổi viền mờ khi
// nhận focus (1,97:1 — dưới ngưỡng 3:1 của WCAG 1.4.11). Phải Tab THẬT: gọi
// element.focus() không kích hoạt :focus-visible.
test("ô search toàn cục có vòng focus nhìn thấy được", async ({ page }) => {
  await page.goto("/");
  // PHẢI chờ navbar gắn xong rồi mới bấm Tab. Bấm sớm thì phím rơi vào lúc
  // React chưa mount, activeElement còn là <body>, và vòng lặp đếm hết lượt mà
  // không tới ô search — test đỏ giả. Đã cắn đúng lỗi này khi chạy song song.
  const box = page.getByRole("combobox", { name: /Tìm phim, rạp/ });
  await expect(box).toBeVisible();

  let daToi = false;
  for (let i = 0; i < 30 && !daToi; i++) {
    await page.keyboard.press("Tab");
    daToi = await page.evaluate(
      () => document.activeElement?.getAttribute("role") === "combobox",
    );
  }
  expect(daToi, "không Tab tới được ô search sau 30 lượt").toBe(true);

  const vien = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector(".gsearch__box")!);
    return { w: parseFloat(s.outlineWidth), style: s.outlineStyle };
  });
  expect(vien.style).not.toBe("none");
  expect(vien.w).toBeGreaterThanOrEqual(2);
});

test("trang /search hiển thị khu kết quả", async ({ page }) => {
  await page.goto("/search?q=a");
  await expect(page.locator(".search-k__sechd").first()).toBeVisible();
  await expect(page.locator(".movie-k").first()).toBeVisible();
});

test("Movies: lọc định dạng đồng bộ URL", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: "IMAX", exact: true }).click();
  await expect(page).toHaveURL(/fmt=IMAX/);
  await expect(page.locator(".movie-k").first()).toBeVisible();
});

// PWA: head có icon links + theme-color (tĩnh trong index.html, có ở cả dev).
test("head có apple-touch-icon + theme-color cho PWA", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
});

// i18n: chuyển sang EN đổi nhãn điều hướng + <html lang> (chỉ đọc).
test("chuyển ngôn ngữ sang EN đổi nhãn điều hướng", async ({ page }) => {
  await page.goto("/");
  const links = page.locator(".nav-k__links");
  await expect(links.getByRole("link", { name: "Phim" })).toBeVisible();
  // Bấm nút EN trong bộ chuyển ngôn ngữ desktop (tránh bản mobile ẩn)
  await page
    .locator(".nav-k__right .lang-k")
    .getByRole("button", { name: "EN" })
    .click();
  // Nhãn điều hướng dịch sang tiếng Anh
  await expect(links.getByRole("link", { name: "Movies" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  // <html lang> cập nhật theo ngôn ngữ đã chọn
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

// Bộ chữ hiển thị và bộ chữ nhãn PHẢI phủ tiếng Việt.
//
// Bebas Neue (cũ) chỉ phát hành subset `latin`/`latin-ext`, nên mọi nguyên âm
// có dấu chồng rơi sang font dự phòng ngay giữa một từ — "DUYỆT THEO THỂ LOẠI"
// hiện thành "DUYệT THEO THể LOạI". Không cổng nào khác bắt được: axe không
// kiểm font fallback và unit test chạy trên happy-dom vốn không dựng chữ.
// Phép đo: ép "<font cần kiểm>, <mốc>" rồi so với chính "<mốc>". Trùng bề rộng
// nghĩa là chữ đã rơi về mốc, tức font thiếu glyph đó.
//
// Dùng HAI mốc và chỉ kết luận thiếu khi trùng CẢ HAI. Một mốc thôi thì báo
// nhầm: Anton vẽ "ỹ" rộng 92,19px còn Barlow 92,20px — lệch 0,01px nên phép so
// tưởng là đã rơi về mốc, trong khi Anton có glyph đó hẳn hoi. Va chạm với cả
// hai mốc cùng lúc thì gần như không xảy ra.
//
// Đã thử `document.fonts.check()` trước — nó trả true cho cả chữ Hán trong
// Anton lẫn một font không tồn tại, tức chỉ kiểm "face đã tải chưa" chứ không
// kiểm glyph. Không dùng được.
//
// PHẢI `document.fonts.load()` trước khi đo. @fontsource chia mỗi bộ chữ thành
// nhiều @font-face theo `unicode-range`, và trình duyệt chỉ tải subset nào màn
// hình thật sự cần. Bản đầu của test này đo thẳng, nên nó chỉ đúng chừng nào
// trang chủ TÌNH CỜ có sẵn chữ tiếng Việt đúng bộ chữ đó — lúc các tiêu đề mục
// chuyển từ Anton sang Barlow Condensed, subset `vietnamese` của Anton không
// còn ai gọi, phép đo rơi về mốc và test tố cáo nhầm là font thiếu glyph.
test("font hiển thị và font nhãn có glyph tiếng Việt", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const thieu = await page.evaluate(async () => {
    const KY_TU = "ỆẾỀỘẬỌƯỞỹ";
    const css = getComputedStyle(document.documentElement);
    const dau = (v: string) => v.split(",")[0].trim();
    const vaiTro = {
      display: dau(css.getPropertyValue("--font-display")),
      head: dau(css.getPropertyValue("--font-head")),
      mono: dau(css.getPropertyValue("--font-mono")),
      body: dau(css.getPropertyValue("--font-body")),
    };
    // Ép tải đúng subset chứa các ký tự này, rồi mới đo.
    await Promise.all(
      Object.values(vaiTro).map((f) =>
        document.fonts.load(`100px ${f}`, KY_TU),
      ),
    );

    const rong = (ch: string, family: string) => {
      const s = document.createElement("span");
      s.style.cssText = `position:absolute;visibility:hidden;font-size:100px;font-family:${family}`;
      s.textContent = ch;
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return w;
    };
    const MOC = ["monospace", "serif"];
    const out: string[] = [];
    for (const [ten, font] of Object.entries(vaiTro))
      for (const ch of KY_TU) {
        const roiVe = MOC.every(
          (m) => Math.abs(rong(ch, `${font}, ${m}`) - rong(ch, m)) < 0.5,
        );
        if (roiVe) out.push(`${ten} (${font}) thiếu "${ch}"`);
      }
    return out;
  });
  expect(thieu, thieu.join(" · ")).toEqual([]);
});

// Không trang nào được kéo CẢ TRANG trượt ngang trên điện thoại.
//
// Khu quản trị từng dựng khung 666px trong màn hình 390px: .adm-k__side là
// grid item nên min-width mặc định là auto, nó nở theo bề rộng tự nhiên của
// dải tab thay vì để .adm-k__nav cuộn. Bảng dữ liệu ĐƯỢC PHÉP trượt (chúng có
// .adm-k__tablewrap riêng) — thứ bị cấm là chính tài liệu trượt.
test("không trang nào tràn ngang ở khổ điện thoại", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAdmin(page);
  const routes = [
    "/",
    "/movies",
    "/cinemas",
    "/search?q=cgv",
    "/login",
    "/register",
    "/tickets",
    "/admin",
    "/admin/movies",
    "/admin/rooms",
    "/admin/showtimes",
    "/admin/bookings",
    "/admin/reviews",
  ];
  const tran: string[] = [];
  for (const r of routes) {
    await page.goto(r);
    await page.waitForLoadState("networkidle");
    const d = await page.evaluate(() => {
      const de = document.documentElement;
      return { sw: de.scrollWidth, cw: de.clientWidth };
    });
    if (d.sw > d.cw + 1) tran.push(`${r} (${d.sw} > ${d.cw})`);
  }
  expect(tran, tran.join(" · ")).toEqual([]);
});
