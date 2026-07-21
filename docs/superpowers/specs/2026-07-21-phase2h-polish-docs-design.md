# GĐ2h — Polish + Docs (lát cuối GĐ2) — Design Spec

**Ngày:** 2026-07-21 · **Trạng thái:** Đã duyệt

Lát khép GĐ2. Không thêm tính năng — chỉ hoàn thiện chất lượng và đồng bộ tài liệu với thực tại GĐ1+2. Phạm vi đã chốt: loginLimiter fix · audit a11y/console · dọn CSS chết · viết lại CLAUDE.md + README.md. **Không** convert 3 file `.jsx` còn lại (`routes/PrivateRoute.jsx`, `routes/AdminRoute.jsx`, `components/admin/Modal.jsx`) — giữ nguyên theo quyết định.

## A. loginLimiter fix

`server/auth-server.js` — `loginLimiter` (express-rate-limit) hiện đếm **mọi** POST `/auth/login` (kể cả thành công) dù comment ghi "10 lần đăng nhập SAI". Thêm **`skipSuccessfulRequests: true`** để chỉ đếm lần **thất bại** — đúng ý brute-force, và làm e2e không còn dính rate-limit khi chạy nhiều lần trong 15'.

- Sửa: khối `loginLimiter = rateLimit({...})` (~dòng 97).
- **Cần restart :4000 thủ công** (node, không nodemon) để có hiệu lực.
- Verify: chạy `npx playwright test` **2 lần liên tiếp** → cả 2 xanh (trước đây lần 2 sẽ fail do tích luỹ).

## B. Audit a11y/console

Quét bằng Playwright, thu `console` (error + warning) và lỗi trang trên các route chính: `/`, `/movies`, `/movie/:id`, `/cinemas`, `/cinema/:id`, `/login`, `/register`, `/seats/:id` (đăng nhập), `/tickets`, `/admin`, `/admin/movies`, `/admin/bookings`.

- **Chỉ sửa lỗi rõ ràng:** React key trùng/thiếu, controlled↔uncontrolled input, `<img>` thiếu `alt`, nút/ível chỉ-icon thiếu `aria-label`, link rỗng, warning act(). **Không** redesign, không đổi hành vi.
- Ghi lại danh sách phát hiện + cách xử lý trong commit message.
- Mục tiêu: console **sạch** (0 error, 0 warning React) ở các trang chính. Cảnh báo từ thư viện bên thứ ba không sửa được thì ghi chú, bỏ qua.

## C. Dọn CSS chết (thận trọng — không được vỡ giao diện)

1. **File CSS orphan:** liệt kê mọi `src/**/*.css`, kiểm file nào **không** được `import` ở bất kỳ `.tsx/.ts/.jsx` nào → xoá.
2. **Class chết trong file còn dùng:** với mỗi file CSS còn sống (đặc biệt `styles/global.css`, `styles/utilities.css`, CSS trang), trích tên class, grep từng class qua `src` (mọi `.tsx/.jsx/.ts`). Xoá **chỉ** block có **0** tham chiếu.
   - **An toàn ghép động:** nhiều class ghép bằng template literal (vd `nav-k__navlink${...}`, `is-active`, `is-open`, `sm`, `ghost`, `danger`, `vip`, `couple`, `booked`, `selected`). Trước khi xoá một class nghi "chết", tìm cả **gốc/hậu tố** (vd tìm `is-active` chứ không chỉ `.adm-k__navlink.is-active`). Nếu không chắc → **giữ lại**.
3. Sau khi xoá: `npm run build` xanh + screenshot lại **≥4 trang tiêu biểu** (Home, MovieDetail, Booking seat step, Admin overview) desktop → so mắt không đổi.

## D. Docs rewrite (commit lần được phép duy nhất)

Cập nhật cho khớp thực tại GĐ1+2. Giữ các chỉnh sửa pending tốt (Vite/booking/holds) làm nền, mở rộng.

**CLAUDE.md** — sửa những điểm lỗi thời + bổ sung:
- "React 18 SPA (CRA)" → **Vite 6** + **TypeScript 5.7** (`allowJs`, `.tsx`/`.ts`; còn 3 file guard/shim `.jsx`).
- "no tests/linter/type checker; package.json only start+build" → **có đủ**: `typecheck`(tsc) · `lint`(ESLint 9 flat, 0 warning) · `format`(Prettier) · `test`(Vitest) · `e2e`(Playwright) · `build`; CI 6 cổng.
- Imports: `jsconfig.json` → **`tsconfig.json` paths** (baseUrl `src`).
- `src/services/api.js`/`auth.js` → **`.ts`**.
- Thêm mục **TanStack Query**: `src/queries/*` (`keys.ts` registry `qk`, `catalog.ts`, `booking.ts`, `admin.ts`), `QueryClientProvider`, mutations invalidate; poll ghế qua `refetchInterval`.
- Thêm mục **Design system Kinetic**: `styles/tokens.css` (token màu/type/spacing + `--surface-invert` bone), `components/ui/*` (primitive + kinetic: Button/Tag/Card/Field/Marquee/TicketEdge/KineticHeading/Modal…), ngôn ngữ neo-brutalist (mono label, viền cứng, đỏ, khối bone, `N°`), font self-host @fontsource; route DEV `/kitchen-sink`.
- `SeatSelection` → **`BookingWizard`** (4 bước, `src/pages/booking/`); `ETicket` tái dùng; `MyTickets` qua Query.
- Admin: **`AdminBookings` giờ sửa được** (sửa ghế + hủy), CRUD qua mutations `queries/admin.ts`.
- Structure: thêm `queries/`, `types/`, `components/ui/`, `lib/seatNav.ts`; test colocate `*.test.ts(x)` + `e2e/`.

**README.md** — cùng pass:
- Tech stack: React 18 + **TS + Vite + TanStack Query + Vitest + Playwright**.
- `src/services/api.js`→`.ts` trong đoạn mô tả.
- Mục **Scripts** đầy đủ: `typecheck`/`lint`/`format`/`format:check`/`test`/`test:run`/`e2e`/`build`/`preview`.
- Thêm mục ngắn **Design system** + **Testing & CI** (6 cổng).
- Giữ bảng 3 server + hướng dẫn chạy (đã đúng).

**Commit:** cả `CLAUDE.md` + `README.md` (đây là lát duy nhất được commit tài liệu).

## E. Chia lát

- **2h/1** — loginLimiter fix (§A) + audit & sửa a11y/console (§B).
- **2h/2** — dọn CSS chết (§C).
- **2h/3** — docs rewrite CLAUDE+README (§D) + verify CI cuối + cập nhật memory (GĐ2 hoàn tất).

Mỗi lát: 6 gate CI xanh; commit thẳng main; không commit tài liệu cho tới 2h/3.

## F. Ràng buộc

- Không đổi hành vi người dùng, không đổi copy ràng buộc smoke (`your@email.com`, `••••••••`, "Đăng nhập").
- Dọn CSS: nghi ngờ thì giữ; luôn verify build + screenshot.
- loginLimiter: chỉ thêm 1 option, không đổi limit/window/message.
