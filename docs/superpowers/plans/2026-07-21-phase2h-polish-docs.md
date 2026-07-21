# GĐ2h — Polish + Docs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Khép GĐ2: sửa loginLimiter, audit & sửa a11y/console, dọn CSS chết, viết lại CLAUDE.md + README.md khớp thực tại GĐ1+2.

**Architecture:** Không thêm tính năng. 3 lát tuần tự; docs commit ở lát cuối.

**Tech Stack:** React 18 + TS 5.7 + Vite 6 + TanStack Query v5; Vitest + Playwright; express-rate-limit.

Spec: `docs/superpowers/specs/2026-07-21-phase2h-polish-docs-design.md`.

## Global Constraints

- Commit thẳng `main`; message tiếng Việt không dấu + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **KHÔNG commit CLAUDE.md/README.md** cho tới **Task 5** (2h/3) — đó là lát docs.
- 6 gate mỗi lát: `npx tsc --noEmit` · `npm run lint`(0 warning) · `npm run format:check` · `npx vitest run` · `npx playwright test` · `npm run build`.
- Giữ copy ràng buộc smoke: `your@email.com`, `••••••••`, nút "Đăng nhập".
- Screenshot `.mjs` để ở gốc project, import `chromium` từ `@playwright/test`, **xoá trước format:check**.
- Dọn CSS: nghi ngờ thì GIỮ; luôn verify build + screenshot.

---

## Task 1 — loginLimiter fix (2h/1a)

**Files:** Modify `server/auth-server.js` (khối `loginLimiter`, ~dòng 97-103).

- [ ] **Step 1:** Thêm `skipSuccessfulRequests: true` vào object `rateLimit({...})`:

```js
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, // 10 lan dang nhap SAI / IP / 15'
  skipSuccessfulRequests: true, // chi dem login that bai (dung y brute-force)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều lần thử. Vui lòng đợi rồi thử lại." },
});
```

- [ ] **Step 2: Restart auth server** (node, không nodemon): kill listener :4000, `npm run auth`, chờ `/auth/me` trả 200/401.

- [ ] **Step 3: Verify** — `npx playwright test` **2 lần liên tiếp**; cả 2 phải 11 passed (trước fix, lần 2 sẽ có ~2 fail do rate-limit tích luỹ).

- [ ] **Step 4:** format:check server file (`npx prettier --check server/auth-server.js`); nếu lệch, `--write`.

(Commit gộp với Task 2.)

---

## Task 2 — Audit & sửa a11y/console (2h/1b)

**Files:** Tạm `_audit.mjs` (gốc, xoá sau); sửa file trang/component tuỳ phát hiện.

- [ ] **Step 1: Viết `_audit.mjs`** — Playwright: đăng nhập admin, duyệt các route (`/`, `/movies`, phần tử `.movie-k` đầu → `/movie/:id`, `/cinemas`, `.venue-k` đầu → `/cinema/:id`, `/login`, `/register`, `/tickets`, `/admin`, `/admin/movies`, `/admin/rooms`, `/admin/showtimes`, `/admin/bookings`; và một `/seats/:id` qua CinemaDetail). Gắn `page.on("console")` + `page.on("pageerror")`, in mọi `error`/`warning` kèm URL. In tổng hợp.

- [ ] **Step 2: Chạy** `node _audit.mjs`; đọc danh sách.

- [ ] **Step 3: Sửa lỗi rõ** (mỗi lỗi 1 sửa nhỏ, giữ hành vi):
  - React "key" trùng/thiếu → thêm key ổn định.
  - controlled↔uncontrolled (`value` không kèm `onChange`, hoặc `value={undefined}`) → chuẩn hoá.
  - `<img>` thiếu `alt` → thêm alt mô tả.
  - nút/link chỉ-icon thiếu tên khả truy cập → `aria-label`.
  - warning `act()`/deps từ code của mình → xử lý.
  - Bỏ qua cảnh báo từ thư viện (recharts defaultProps, React Router future flags…) — ghi chú trong commit.

- [ ] **Step 4: Chạy lại `node _audit.mjs`** → xác nhận trang chính 0 error, 0 warning (của app). Xoá `_audit.mjs`.

- [ ] **Step 5: 6 gate** + commit 2h/1:

```bash
npx tsc --noEmit && npm run lint && npm run format:check && npx vitest run && npx playwright test && npm run build
git add server/auth-server.js <cac file da sua>
git commit -m "fix(GD2h/1): loginLimiter skipSuccessful + sua a11y/console"
git push origin main
```

---

## Task 3 — Dọn CSS chết (2h/2)

**Files:** Xoá/sửa `src/**/*.css` tuỳ phát hiện; tạm `_deadcss.mjs` hoặc dùng rg.

- [ ] **Step 1: File CSS orphan** — liệt kê `src/**/*.css`; với mỗi file, grep tên file trong `src` (`import "./X.css"` hoặc `import "styles/X.css"`). File 0 import → ứng viên xoá. Kiểm từng cái rồi `git rm`.

Run: `for f in $(rg --files src -g '*.css'); do b=$(basename "$f"); n=$(rg -l "$b" src --glob '*.ts*' --glob '*.jsx' | wc -l); echo "$n  $f"; done`
Expected: cột `0` = orphan (xử lý), `>=1` = còn dùng.

- [ ] **Step 2: Class chết** — với mỗi CSS còn sống, trích class (`rg -o '\.[a-zA-Z][\w-]+' file.css | sort -u`), grep từng class-stem qua `src` (`.tsx/.jsx`). Block 0 tham chiếu → xoá. **An toàn ghép động:** với hậu tố trạng thái (`is-active/is-open/is-picked/is-past/vip/couple/booked/selected/ghost/danger/sm/compact/full`) tìm cả hậu tố; không chắc → GIỮ. Ưu tiên `styles/global.css` + `styles/utilities.css` (nơi dễ tồn đọng class cũ nhất).

- [ ] **Step 3: Verify không vỡ** — `npm run build`; viết `_shot.mjs` chụp Home `/`, MovieDetail (qua `.movie-k`), Booking seat step (login → `/cinemas` → `.venue-k` → `.time-k-btn` → `/seats`), Admin `/admin` — desktop; so mắt với trước. Xoá `_shot.mjs`.

- [ ] **Step 4: 6 gate** + commit 2h/2:

```bash
npx tsc --noEmit && npm run lint && npm run format:check && npx vitest run && npx playwright test && npm run build
git add -A src
git commit -m "chore(GD2h/2): don CSS chet (orphan + class 0 tham chieu)"
git push origin main
```

---

## Task 4 — Docs rewrite: CLAUDE.md (2h/3a)

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1: Đọc `CLAUDE.md` hiện tại** (đã có pending edits). Sửa theo §D spec:
  - Mở đầu "What this is": React 18 **+ TypeScript, build bằng Vite 6** (không CRA).
  - "Commands": bỏ dòng "no tests/linter/type checker"; thêm `npm run typecheck` / `lint` / `lint:fix` / `format` / `format:check` / `test` (Vitest watch) / `test:run` / `e2e` (Playwright) / `preview`; ghi **6 cổng CI**.
  - Imports: `jsconfig.json` → **`tsconfig.json`** (`baseUrl: src`, paths).
  - `src/services/api.js`→`api.ts`, `auth.js`→`auth.ts` (mọi chỗ nhắc).
  - `src/lib/pricing.js`→`pricing.ts`; thêm `lib/seatNav.ts`.
  - Thêm mục **`src/queries/`**: `keys.ts` (registry `qk`), `catalog.ts`, `booking.ts`, `admin.ts`; QueryClientProvider (trong ErrorBoundary, ngoài AuthProvider); mutations invalidate; poll ghế `refetchInterval` 10s.
  - Thêm mục **Design system Kinetic**: `styles/tokens.css` + `utilities.css`, `components/ui/*` (barrel `index.ts`), ngôn ngữ neo-brutalist (mono/viền cứng/đỏ/bone `--surface-invert`/`N°`), font @fontsource self-host, route DEV `/kitchen-sink` (chỉ `import.meta.env.DEV`).
  - Booking: `SeatSelection`→**`BookingWizard`** (`src/pages/booking/`, 4 bước ①ghế②F&B③thanh toán④e-ticket), `ETicket` tái dùng, `MyTickets` qua Query.
  - Admin: `AdminBookings` **giờ sửa được** (sửa ghế + hủy) — sửa câu "read-only"; CRUD qua `queries/admin.ts` mutations; `Pagination.tsx`/`ConfirmDialog.tsx`.
  - Project structure: thêm `queries/`, `types/`, `components/ui/`; test `*.test.ts(x)` colocate + `e2e/`; ghi rõ **còn 3 file `.jsx`**: `routes/PrivateRoute.jsx`, `routes/AdminRoute.jsx`, `components/admin/Modal.jsx` (shim re-export `ui/Modal`).
  - Giữ nguyên các mục vẫn đúng (auth backend, gateway, holds, db.json — đã cập nhật ở pending).

- [ ] **Step 2:** `npx prettier --check CLAUDE.md` bị `.prettierignore` bỏ qua (md ignored) → không cần format md. Đọc lại rà mạch lạc, không mâu thuẫn.

(Commit gộp Task 5.)

---

## Task 5 — Docs rewrite: README.md + verify + memory (2h/3b)

**Files:** Modify `README.md`; memory.

- [ ] **Step 1: Sửa `README.md`** theo §D:
  - Câu mở: thêm **TypeScript + Vite + TanStack Query**.
  - Mọi `src/services/api.js`→`.ts`, `auth.js`→`.ts`.
  - Mục **Scripts** đầy đủ (typecheck/lint/format/format:check/test/test:run/e2e/build/preview) — mô tả ngắn mỗi lệnh.
  - Thêm mục ngắn **Tech stack** (React 18, TS 5.7, Vite 6, TanStack Query v5, Vitest, Playwright, Express+JWT+bcrypt, json-server).
  - Thêm mục ngắn **Design system** (Kinetic neo-brutalist, tokens + `components/ui`, font @fontsource) + **Testing & CI** (6 cổng, GitHub Actions).
  - Giữ bảng 3 server + hướng dẫn chạy.

- [ ] **Step 2: 6 gate cuối** (docs không ảnh hưởng code nhưng chạy cho chắc):

Run: `npx tsc --noEmit && npm run lint && npm run format:check && npx vitest run && npx playwright test && npm run build`
Expected: tất cả xanh.

- [ ] **Step 3: Commit docs + push:**

```bash
git add CLAUDE.md README.md
git commit -m "docs(GD2h/3): cap nhat CLAUDE.md + README.md khop GD1+2 (Vite/TS/Query/kinetic/test)"
git push origin main
```

- [ ] **Step 4: Verify CI** qua API `.../actions/runs?per_page=1` → `conclusion: success`.

- [ ] **Step 5: Cập nhật memory** `professionalization-roadmap.md`: **GĐ2 HOÀN TẤT** (2a–2h xong), tiếp GĐ3 (Express+Prisma+Postgres, Docker, deploy). Cập nhật `MEMORY.md` index.

---

## Self-Review (đã chạy)

- **Spec coverage:** §A→Task1; §B→Task2; §C→Task3; §D CLAUDE→Task4, README→Task5; §E lát→(2h/1=Task1+2, 2h/2=Task3, 2h/3=Task4+5). ✓
- **Placeholder:** các bước audit/dọn CSS/docs mô tả quy trình cụ thể + lệnh; nội dung chính xác phụ thuộc phát hiện runtime (bản chất audit) — chấp nhận, có tiêu chí rõ (0 warning app; 0 tham chiếu; danh mục sửa docs liệt kê từng điểm). ✓
- **Ràng buộc docs-commit:** chỉ Task 5 commit CLAUDE/README; Task 1-3 push code không kèm docs. ✓
- **Rủi ro:** dọn CSS có thể vỡ giao diện → bắt buộc screenshot verify (Task3/Step3) + nguyên tắc "nghi ngờ thì giữ".
