# Cổng a11y + đo Lighthouse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa kiểm tra trợ năng thành cổng CI chạy được (đỏ khi có vi phạm critical/serious) sau khi sửa hết vi phạm hiện có, rồi đo Lighthouse trên bản build production và sửa những điểm đáng sửa.

**Architecture:** `axe-core` chạy trong Playwright (job `e2e` sẵn có, có Postgres + CSS + dữ liệu thật) quét 16 trạng thái. Vi phạm được sửa TRƯỚC, để commit đưa cổng vào CI là commit đã xanh. Lighthouse chạy tách rời trên prod-mode local, chỉ cho ra báo cáo — không vào CI.

**Tech Stack:** `@axe-core/playwright` 4.12 · Playwright chromium · Lighthouse (npx) · CSS variables trong `src/styles/tokens.css`.

## Global Constraints

- Spec a11y **chỉ đọc**: đi tới bước ③ của luồng đặt vé nhưng KHÔNG bấm Thanh toán, không tạo/sửa/xoá dữ liệu. Giống luật của `smoke.spec.ts`.
- Mọi copy hiển thị phải đi qua `t("area.key")` và thêm khoá vào **cả** `vi.json` lẫn `en.json`.
- Mỗi task giữ **7 cổng xanh**: `typecheck` · `lint` (0 warning) · `format:check` · `test:cov` (≥ ngưỡng 90/87/84/90) · `e2e` · `build` (+ job `docker` trên CI).
- Commit thẳng `main`, thông điệp commit viết bằng **file** (`git commit -F`) vì PowerShell 5.1 xé chuỗi có dấu `"`.
- `EXCLUDED_RULES` trong `e2e/a11y.spec.ts` phải **rỗng** khi kết thúc; tương phản màu không được đưa vào đó.
- Đổi màu = đổi diện mạo ⇒ phải chụp ảnh trước/sau và **đưa người dùng duyệt** trước khi commit.

---

## Vi phạm đã đo được (nền của mọi task bên dưới)

Chạy `npx playwright test e2e/a11y.spec.ts` ngày 2026-08-01: **10/12 test đỏ**, gom về **4 nguyên nhân gốc**.

| # | Rule | Impact | Ở đâu | Nguyên nhân |
| - | ---- | ------ | ----- | ----------- |
| 1 | `aria-prohibited-attr` | serious | `.ui-kinetic` (mọi trang) | `KineticHeading` đặt `aria-label` lên `<span>` không có role |
| 2 | `aria-allowed-attr` | critical | `button[data-seat]` | ghế dùng `role="gridcell"` + `aria-pressed` (gridcell không cho `aria-pressed`) |
| 3 | `label` | critical | input/textarea trong modal admin | `<label>` không có `htmlFor`, input không có `id` |
| 4 | `color-contrast` | serious | 23 phần tử | ba nhóm màu, xem bảng dưới |

**Số đo tương phản (fg / bg → tỉ lệ, cần 4.5):**

| Nhóm | Ví dụ | Màu | Đo được |
| ---- | ----- | ---- | ------- |
| Chữ trắng trên nền đỏ | `.nav-k__login`, `.ui-tag`, `.ui-btn--solid`, `.date-k-btn`, `.mytk-k__cta` | `#ffffff` trên `#e63030` | **4.34** |
| Chữ đỏ trên nền tối | `.venue-k__link` | `#e63030` trên `#111111` | **4.34** |
| Chữ xám nhỏ | `.foot-k__copy`, `.adm-k__side-title`, `.adm-k__count`, `th`, marquee | `#555555` trên `#0a0a0a`/`#161616` | **2.42–2.65** |
| Thanh bước bị mờ | `.stepper-k__no`, `.stepper-k__label` | `#781d1d` / `#494949` trên `#0a0a0a` | **1.87 / 2.19** |

Hai nhóm đỏ **kéo ngược chiều nhau**: chữ trắng trên nền đỏ cần đỏ **tối hơn**, chữ đỏ trên nền tối cần đỏ **sáng hơn**. Một token không phục vụ được cả hai ⇒ Task 4 tách token.

---

## File Structure

| Tệp | Trách nhiệm | Task |
| --- | ----------- | ---- |
| `e2e/a11y.spec.ts` | quét axe 16 trạng thái, luật đỏ, danh sách loại trừ | 5 (commit) |
| `src/components/ui/KineticHeading.tsx` | chữ trang trí + text cho trình đọc màn hình | 1 |
| `src/components/ui/ui.css` | thêm tiện ích `.ui-visually-hidden` | 1 |
| `src/pages/booking/SeatStep.tsx` | ô ghế trong lưới | 2 |
| `src/pages/admin/Admin{Movies,Rooms,Showtimes}.tsx` | form trong modal | 3 |
| `src/styles/tokens.css` | token màu | 4 |
| `src/components/ui/ui.css`, `src/pages/**/*.css` | nơi dùng token đỏ/xám | 4 |
| `src/pages/booking/Booking.css` | thanh bước | 4 |
| `scripts/lighthouse.mjs` | chạy Lighthouse lặp lại được | 6 |
| `docs/superpowers/plans/2026-08-01-lighthouse-baseline.md` | bảng điểm trước/sau | 6 |

---

### Task 1: `KineticHeading` — bỏ `aria-label` trên span trần

**Files:**
- Modify: `src/components/ui/KineticHeading.tsx`
- Modify: `src/components/ui/ui.css` (thêm `.ui-visually-hidden`)
- Test: `src/components/ui/KineticHeading.test.tsx`

**Interfaces:**
- Consumes: —
- Produces: `.ui-visually-hidden` (class CSS dùng lại được); `KineticHeading` giữ nguyên props `{ text: string; className?: string }`

Chữ hiện tại: từng ký tự là `<span aria-hidden>`, và cả khối mang `aria-label`. `aria-label` **bị cấm** trên phần tử không role — nghĩa là hiện tại trình đọc màn hình bỏ qua toàn bộ tiêu đề. Cách sửa đúng là để text thật trong DOM nhưng ẩn khỏi mắt.

- [ ] **Step 1: Sửa test cho hành vi mới**

```tsx
it("đọc được nguyên văn cho trình đọc màn hình, ký tự trang trí bị ẩn", () => {
  const { container } = render(<KineticHeading text="AB C" />);
  // Text thật nằm trong DOM (ẩn khỏi mắt), KHÔNG dùng aria-label trên span trần.
  expect(screen.getByText("AB C")).toHaveClass("ui-visually-hidden");
  expect(container.querySelector(".ui-kinetic")).not.toHaveAttribute("aria-label");
  expect(container.querySelectorAll(".ui-kinetic__word")).toHaveLength(2);
  expect(container.querySelectorAll(".ui-kinetic__ch")).toHaveLength(3);
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `npx vitest run src/components/ui/KineticHeading.test.tsx`
Expected: FAIL — vẫn còn `aria-label`, chưa có `.ui-visually-hidden`

- [ ] **Step 3: Sửa component**

```tsx
return (
  <span className={cx("ui-kinetic", className)}>
    {/* Text thật cho trình đọc màn hình: aria-label bị CẤM trên span không role
        (axe: aria-prohibited-attr), nên phải đưa chữ vào DOM rồi ẩn khỏi mắt. */}
    <span className="ui-visually-hidden">{text}</span>
    <span aria-hidden="true">
      {words.map((word, wi) => (
        /* ...nguyên phần dựng ký tự cũ... */
      ))}
    </span>
  </span>
);
```

- [ ] **Step 4: Thêm tiện ích vào `ui.css`**

```css
/* Ẩn khỏi mắt nhưng vẫn đọc được bằng trình đọc màn hình. Không dùng
   display:none hay visibility:hidden — cả hai đều xoá khỏi cây trợ năng. */
.ui-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 5: Chạy lại test + toàn bộ unit**

Run: `npm run test:run`
Expected: PASS toàn bộ. Nếu test trang nào đó tìm tiêu đề bằng `getByLabelText` thì sửa sang `getByText` — ghi chú lý do.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/KineticHeading.tsx src/components/ui/ui.css src/components/ui/KineticHeading.test.tsx
git commit -F <file thông điệp>
```

---

### Task 2: ô ghế — `aria-pressed` → `aria-selected`

**Files:**
- Modify: `src/pages/booking/SeatStep.tsx:132`
- Test: `src/pages/booking/BookingWizard.seats.test.tsx`

**Interfaces:**
- Consumes: —
- Produces: ô ghế giữ `role="gridcell"`, trạng thái chọn nay ở `aria-selected`

`role="gridcell"` không cho `aria-pressed` (axe: `aria-allowed-attr`, critical). `aria-selected` là thuộc tính hợp lệ của gridcell và diễn tả đúng nghĩa "ghế đang được chọn".

- [ ] **Step 1: Thêm khẳng định vào test ghế**

```tsx
it("ghế đang chọn được đánh dấu bằng aria-selected", async () => {
  await setup();
  expect(seat("B1")).toHaveAttribute("aria-selected", "false");
  await pick("B1");
  expect(seat("B1")).toHaveAttribute("aria-selected", "true");
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `npx vitest run src/pages/booking/BookingWizard.seats.test.tsx`
Expected: FAIL — thuộc tính hiện là `aria-pressed`

- [ ] **Step 3: Đổi thuộc tính**

```tsx
aria-selected={isSel}
```

- [ ] **Step 4: Chạy lại**

Run: `npx vitest run src/pages/booking/BookingWizard.seats.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

---

### Task 3: form admin — nối `<label>` với ô nhập

**Files:**
- Modify: `src/pages/admin/AdminMovies.tsx` (5 ô), `src/pages/admin/AdminRooms.tsx` (6 ô), `src/pages/admin/AdminShowtimes.tsx` (5 ô)
- Test: `src/pages/admin/AdminMovies.test.tsx`

**Interfaces:**
- Consumes: —
- Produces: mọi ô nhập trong modal admin có `id` và `<label htmlFor>` khớp

Nhãn hiện là `<label>` trần đứng cạnh input (axe: `label`, critical) — chính lý do các test T8 phải đi vòng qua `.adm-k__field` thay vì `getByLabelText`.

- [ ] **Step 1: Thêm test cho một form**

```tsx
it("mọi ô nhập trong form đều có nhãn nối đúng", async () => {
  await setup();
  await userEvent.click(screen.getByRole("button", { name: "+ Thêm phim" }));
  expect(screen.getByLabelText("Tên phim")).toBeInTheDocument();
  expect(screen.getByLabelText("Thể loại")).toBeInTheDocument();
  expect(screen.getByLabelText("Thời lượng (phút)")).toBeInTheDocument();
  expect(screen.getByLabelText("Mô tả")).toBeInTheDocument();
});
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `npx vitest run src/pages/admin/AdminMovies.test.tsx`
Expected: FAIL — "Found a label with the text ... however no form control was found associated to that label"

- [ ] **Step 3: Nối nhãn (mẫu lặp cho từng ô, cả ba tệp)**

```tsx
<div className="adm-k__field">
  <label htmlFor="adm-movie-title">{t("admin.fMovieTitle")}</label>
  <input id="adm-movie-title" value={form.title} onChange={set("title")} />
</div>
```

Tiền tố id: `adm-movie-*`, `adm-room-*`, `adm-showtime-*` (tránh trùng khi hai form cùng nằm trong DOM).

- [ ] **Step 4: Chạy lại toàn bộ unit**

Run: `npm run test:run`
Expected: PASS (test T8 dùng `.adm-k__field` vẫn chạy được vì cấu trúc DOM không đổi)

- [ ] **Step 5: Commit**

---

### Task 4: tương phản màu (task đổi diện mạo — cần duyệt ảnh)

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: các tệp CSS dùng `--red` làm **nền có chữ trắng** hoặc `--text-dim` cho chữ nhỏ
- Modify: `src/pages/booking/Booking.css:52-87` (thanh bước)

**Interfaces:**
- Consumes: —
- Produces: hai token mới `--red-bg` (nền có chữ trắng) và `--red-text` (chữ đỏ trên nền tối); `--text-dim`/`--text-muted` sáng lên

- [ ] **Step 1: Thêm token mới, sửa hai token xám**

```css
--red: #e63030;        /* GIỮ: viền, bóng cứng, số lớn trang trí */
--red-bg: #dd2b2b;     /* nền có chữ trắng: 4.72:1 (cũ #e63030 chỉ 4.34) */
--red-text: #ff5a5a;   /* chữ đỏ trên nền tối: 6.2:1 (cũ #e63030 chỉ 4.34) */
--text-muted: #a3a3a3; /* cũ #888 — nâng để giữ bậc với --text-dim */
--text-dim: #8a8a8a;   /* cũ #555 = 2.65:1, không đạt */
```

- [ ] **Step 2: Đổi nơi dùng**

Quy tắc: `background: var(--red)` **kèm chữ trắng** → `var(--red-bg)`. `color: var(--red)` cho **chữ thường** → `var(--red-text)`. Viền/bóng/số lớn giữ `--red`.
Tìm nơi cần đổi:

```bash
grep -rn "var(--red)" src --include=*.css
```

Điểm đã biết phải đổi: `.nav-k__login` · `.ui-tag` · `.ui-btn--solid` · `.date-k-btn` · `.mytk-k__cta` · `.hero-k__label` · `.venue-k__link` (chữ đỏ → `--red-text`).

- [ ] **Step 3: Bỏ cách làm mờ bằng opacity ở thanh bước**

```css
.stepper-k__item {           /* bỏ opacity: 0.5 */
  ...
}
.stepper-k__item.is-current { opacity: 1; }   /* giữ, nay là mặc định */
.stepper-k__no { color: var(--red-text); }
.stepper-k__label { color: var(--text-dim); }
```

Lý do: `opacity: 0.5` là thứ kéo `--red` xuống `#781d1d` (1.87:1) và `--text-muted` xuống `#494949` (2.19:1). Trạng thái bước nay thể hiện bằng **màu**, không bằng độ mờ.

- [ ] **Step 4: Chạy lại quét a11y**

Run: `npx playwright test e2e/a11y.spec.ts`
Expected: 12/12 PASS. Còn đỏ chỗ nào thì sửa tiếp theo đúng số axe báo, KHÔNG thêm vào `EXCLUDED_RULES`.

- [ ] **Step 5: Chụp ảnh trước/sau và xin duyệt**

Chụp desktop + mobile các trang: `/` · `/movies` · `/cinemas` · `/seats/:id` (bước ②) · `/admin`. Đăng thành Artifact để người dùng xem trên điện thoại. **Chờ duyệt rồi mới commit.**

- [ ] **Step 6: Commit sau khi được duyệt**

---

### Task 5: đưa cổng a11y vào CI

**Files:**
- Create: `e2e/a11y.spec.ts` (đã viết ở lát thu thập, nay mới commit)
- Modify: `package.json` (devDependency `@axe-core/playwright`)

**Interfaces:**
- Consumes: `EXCLUDED_RULES` rỗng, `BLOCKING = ["critical","serious"]`
- Produces: 12 test a11y chạy trong job `e2e`

- [ ] **Step 1: Xác nhận xanh tại chỗ**

Run: `npm run e2e`
Expected: 32 test PASS (20 cũ + 12 a11y)

- [ ] **Step 2: 7 cổng**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:cov && npm run build`

- [ ] **Step 3: Commit + push, chờ CI xanh**

---

### Task 6: đo Lighthouse

**Files:**
- Create: `scripts/lighthouse.mjs`
- Create: `docs/superpowers/plans/2026-08-01-lighthouse-baseline.md`

**Interfaces:**
- Consumes: bản build production trong `build/` + `server/dist/`
- Produces: bảng điểm 4 trang × 4 chuyên mục

- [ ] **Step 1: Viết script**

```js
// scripts/lighthouse.mjs — đo Lighthouse trên bản build production đang chạy.
// Dùng Chromium của Playwright nên không phải cài thêm trình duyệt.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";

const BASE = process.env.LH_BASE ?? "http://localhost:4100";
const ROUTES = ["/", "/movies", "/movie/1", "/cinemas"];

for (const route of ROUTES) {
  execFileSync(
    "npx",
    ["lighthouse", `${BASE}${route}`, "--quiet", "--output=json",
     `--output-path=lighthouse-${route.replace(/\W+/g, "_")}.json`,
     "--chrome-flags=--headless=new"],
    { stdio: "inherit", env: { ...process.env, CHROME_PATH: chromium.executablePath() } },
  );
}
```

- [ ] **Step 2: Dựng prod-mode local rồi chạy**

```bash
npm run build
NODE_ENV=production PORT=4100 npm run start:prod   # cửa sổ riêng
node scripts/lighthouse.mjs
```

- [ ] **Step 3: Ghi bảng điểm "trước" vào docs**

Bốn chuyên mục: Performance · Accessibility · Best Practices · SEO, chế độ mobile.

- [ ] **Step 4: Sửa những điểm rẻ mà báo cáo chỉ ra**

Chỉ làm những thứ sau, mỗi thứ chỉ khi báo cáo thật sự nêu:
1. Thiếu `<meta name="description">` → thêm vào `index.html`.
2. Ảnh poster thiếu `width`/`height` → thêm thuộc tính vào `MovieCard.tsx` để chặn layout shift.
3. `font-display` → kiểm `@fontsource` đã đặt `swap` chưa.

- [ ] **Step 5: DỪNG LẠI HỎI nếu đòn bẩy lớn nhất là tách bundle**

Nếu báo cáo chỉ ra `recharts` (~200KB, chỉ admin dùng) là nguyên nhân chính: **hỏi người dùng** trước khi tách route admin bằng `React.lazy`. Đây là thay đổi cấu trúc route, không nằm trong phạm vi đã duyệt.

- [ ] **Step 6: Đo lại, ghi cột "sau", commit**

Báo cáo JSON **không commit** (thêm `lighthouse-*.json` vào `.gitignore`).

---

### Task 7: cập nhật tài liệu

**Files:**
- Modify: `CLAUDE.md` (mục Testing), `README.md`

- [ ] **Step 1: Ghi đúng bộ cổng**

**Số cổng CI KHÔNG đổi** — vẫn sáu cổng + job `docker`. Kiểm tra a11y nằm *bên trong* cổng `e2e`. Ghi rõ: 12 test axe, luật chặn critical/serious, `EXCLUDED_RULES` rỗng và muốn thêm phải kèm lý do.

- [ ] **Step 2: Ghi lại quyết định màu**

Ba token đỏ (`--red` trang trí · `--red-bg` nền có chữ trắng · `--red-text` chữ đỏ trên nền tối) và **lý do phải tách**: chữ trắng trên đỏ cần đỏ tối hơn, chữ đỏ trên nền tối cần đỏ sáng hơn — một token không phục vụ được cả hai. Không có dòng này thì người sau sẽ "dọn dẹp" gộp lại và làm đỏ CI.

- [ ] **Step 3: Trỏ tới bảng điểm Lighthouse**

- [ ] **Step 4: Commit + push**

---

## Self-review

- **Spec coverage:** cổng a11y (Task 5) · 16 trạng thái quét (đã có trong tệp spec, Task 5 commit) · luật critical/serious (Task 5) · `EXCLUDED_RULES` rỗng (ràng buộc chung + Task 4 Step 4) · sửa tương phản bằng token (Task 4) · Lighthouse đo+sửa+báo cáo (Task 6) · không staging (không có task nào — đúng ý spec) · tài liệu (Task 7). Không thấy mục nào của spec thiếu task.
- **Placeholder:** các bước sửa đều có mã hoặc số cụ thể. Task 6 Step 4 liệt kê đúng ba thứ được phép sửa kèm điều kiện, thay vì "sửa những gì tìm được".
- **Type consistency:** `.ui-visually-hidden` (Task 1) là tên duy nhất dùng cho tiện ích ẩn; `--red-bg`/`--red-text`/`--text-dim`/`--text-muted` (Task 4) dùng nhất quán ở Task 7.
