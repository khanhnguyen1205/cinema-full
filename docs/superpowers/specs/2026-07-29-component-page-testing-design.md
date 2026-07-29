# Lấp khoảng trống test — tầng component, page và server có trạng thái

**Ngày:** 2026-07-29
**Trạng thái:** đã duyệt (brainstorm 2026-07-29)
**Tiền đề:** lộ trình GĐ1→GĐ4 đã đóng trọn, app live tại
`https://cinema-full-a9xt.onrender.com`. Đây là hạng mục **(3)** trong danh sách
dọn nợ chất lượng sau lộ trình. Hạng mục (1) — dữ liệu seed chết — xong ở
`62bc73e`; hạng mục (2) — giám sát lỗi Sentry — **đã cân nhắc và bỏ** (`23acd83`
thêm spec, `368c777` gỡ).

## Vấn đề

Repo có **164 unit test / 29 file**, nhưng phân bố lệch hẳn: những gì **dễ test**
thì đã test, những gì **dễ hỏng** thì chưa.

**Đã có test:** `src/lib/*` (pricing, seatNav, search, time, cx, reviewStats),
10 primitive trong `components/ui/*`, `MovieCard`, `i18n/format`, `queries/keys`,
`hooks/useInstallPrompt`; phía server là các file **thuần** (collections,
reviews-validate, auth/helpers, email/lang, email/templates, payments/quote,
payments/verify, static, date-shift).

**Chưa có test — khoảng 6.400 dòng:**

| Vùng | Ví dụ nổi bật |
| --- | --- |
| `src/pages/*` (toàn bộ) | `MovieDetail` 678 dòng · `Movies` 458 · `BookingWizard` 404 · `Home` 308 · 6 trang admin |
| `src/components/*` có logic | Navbar · GlobalSearch · ETicket · Pagination · ConfirmDialog · ResendTicketButton · InstallButton |
| tầng dữ liệu client | `context/AuthContext` (127) · `services/api` (169) + `auth` (77) · `queries/*` (hook thật) · `hooks/usePagination` · 2 route guard |
| server có trạng thái | `api/gateway` (197 — **toàn bộ luật phân quyền**) · `api/repo` (149) · `api/holds` (94) · `api/occupied` · `auth/routes` · `auth/users` · `auth/tokens` · `auth/middleware` · `payments/amount` + `settle` · `email/send` |

Hệ quả: 7 cổng CI hiện chỉ thật sự chặn được hồi quy **ở tầng helper**. Luật
phân quyền của gateway — ai được đọc/ghi cái gì — chỉ được bảo vệ gián tiếp bởi
vài kịch bản e2e; `AuthContext` giữ cross-tab sync, silent refresh và idle logout
mà không có một dòng test nào.

## Mục tiêu

Viết test cho tầng component / page / server-có-trạng-thái sao cho 7 cổng CI chặn
được hồi quy **ở nơi lỗi thật sự đắt**: phân quyền, tiền, giữ ghế, phiên đăng
nhập, luồng đặt vé.

**Không phải mục tiêu:** con số coverage tròn trịa; test lại thứ e2e đã phủ tốt;
test chi tiết DOM/CSS (làm test giòn, cản redesign sau này).

## Quyết định đã chốt

1. **Phạm vi: đầy đủ** — cả client lẫn server.
2. **Chặn mạng bằng MSW** (giả lập ở tầng HTTP), không `vi.mock` module
   `services/*`. Lý do: test đi qua `services/*` và `queries/*` **thật** — đúng
   hai tầng đang không có test; mock ở tầng module sẽ nhảy qua chính chỗ cần phủ.
3. **Server test bằng `supertest` + Prisma giả**: bắn request thật vào app
   Express thật (đúng mount order, đúng middleware, đúng luật gateway), chỉ thay
   tầng Prisma. Chạy được trong CI job `checks` vốn **không có Postgres**, nhanh,
   và bắt được đúng loại lỗi đắt nhất.
4. **Coverage là cổng chặn**: đo bằng `@vitest/coverage-v8`, ngưỡng đặt **sau khi
   đo thực tế** ở lát cuối, đúng bằng mức đạt được. Từ đó code mới không kèm test
   sẽ làm tụt số ⇒ CI đỏ. Đây là thứ giữ thành quả lại lâu dài.
5. **Thứ tự làm: từ trong ra ngoài** (hạ tầng → luật server → tầng dữ liệu client
   → components → pages). Pages phụ thuộc toàn bộ hạ tầng phía dưới; làm ngược
   thì mỗi lát phải dựng lại mock từ đầu.

## Hạ tầng test (dùng lại cho mọi lát sau)

### Tách `vitest` thành 2 project

Vitest 3 hỗ trợ nhiều project trong một cấu hình. Hiện `vite.config.mjs` dùng
**một** khối `test` chung (`environment: "happy-dom"`,
`include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.ts"]`) — đủ
khi test toàn là hàm thuần, nhưng sẽ hỏng khi thêm MSW và khi test server cần
biến môi trường.

- **project `client`** — `environment: "happy-dom"`, setup hiện có + MSW +
  polyfill `BroadcastChannel`.
- **project `server`** — `environment: "node"`, setup riêng **đặt
  `process.env.DATABASE_URL` giả trước khi import `app.ts`**. Không làm vậy thì
  `env.ts` throw (đúng cảnh báo đã ghi trong CLAUDE.md: "file server có unit test
  thì không được import `env.ts`" — nay ta cố tình import `app.ts`, nên phải xử
  lý bằng biến môi trường giả thay vì né).

### File mới

| File | Việc |
| --- | --- |
| `src/test/fixtures.ts` | dữ liệu mẫu **nhỏ**: 2 phim, 1 rạp, 1 phòng, 2 suất, 1 user, 1 booking, 1 review, 2 món F&B. **Không** dùng `db.json` (16 phim / 52 suất) — assertion sẽ mong manh và test đọc không hiểu |
| `src/test/msw/handlers.ts` | handler cho `/api/*` + `/auth/*` trả fixtures, đúng hợp đồng HTTP thật |
| `src/test/msw/server.ts` | `setupServer`, bật **`onUnhandledRequest: "error"`** — request không khai báo làm test đỏ, tránh "xanh giả" |
| `src/test/renderWithProviders.tsx` | bọc `QueryClientProvider` (`retry:false`, `gcTime:0`) + `MemoryRouter` (nhận `initialEntries`) + `AuthProvider`; tuỳ chọn nạp sẵn user |
| `server/src/test/prismaMock.ts` | bản giả của `db/prisma.ts` (`vi.mock`) — app Express vẫn là app thật |
| `server/src/test/setup.ts` | đặt `DATABASE_URL`/`JWT_SECRET` giả trước mọi import |

## Phạm vi test theo tầng

### Server (`supertest` + app thật + Prisma giả)

- **`api/gateway.ts`** — ma trận phân quyền đầy đủ: catalog đọc công khai / ghi
  chỉ admin; `users` chỉ admin; `bookings` GET giới hạn theo người gọi (admin
  thấy tất), POST **ép `userId` về người gọi** (thử giả mạo `userId` khác),
  PATCH/DELETE chỉ admin; `reviews` GET công khai + lọc `?movieId=`, POST cần đăng
  nhập và server tự đóng dấu `userId`/`userName`/`verified`/`createdAt`,
  PATCH/DELETE **owner-or-admin**.
- **`api/repo.ts`** — hợp đồng HTTP: POST→**201**, DELETE→**`{}` + 200**, id
  không tồn tại→**404**, list **`orderBy: {id:"asc"}`**, body lọc qua whitelist
  (không ghi được `id` hay field lạ), `P2025`→404, `P2002`/`P2003`→409.
- **`api/holds.ts`** — TTL 8 phút (fake timers), POST thay + gia hạn hold của
  chính mình, **409 kèm `conflicts`** khi ghế đang bị người khác giữ, DELETE
  release, POST `/bookings` thành công thì xoá hold.
- **`api/occupied.ts`** — hợp của ba nguồn (`showtime.bookedSeats` ∪ ghế trong
  booking ∪ ghế **người khác** đang giữ), và **không** lộ dữ liệu cá nhân.
- **`auth/routes.ts`** — register/login/logout/refresh/me; cookie **httpOnly**;
  `remember` → cookie có Max-Age vs cookie phiên; rate-limit **chỉ đếm lần sai**;
  email được chuẩn hoá (trim + lowercase); mật khẩu plaintext cũ **tự nâng cấp
  sang bcrypt** ở lần đăng nhập đúng đầu tiên.
- **`auth/tokens.ts` + `middleware.ts`** — ký/verify, token hỏng hoặc hết hạn ⇒
  không ra user.
- **`payments/amount.ts` + `settle.ts`** — server tự tính tiền từ DB (không tin số
  của client), chặn ghế đã bán hoặc đang bị người khác giữ bằng **409 trước khi
  charge**.
- **`email/send.ts`** — **không bao giờ throw**, kể cả khi provider lỗi.

### Client — tầng dữ liệu

- `services/api.ts` + `auth.ts`: đúng URL, `credentials:"include"`, gửi `x-lang`,
  **ném lỗi khi `!res.ok`**, `fetchMe` tự gọi `/auth/refresh` một lần khi gặp 401.
- `queries/*`: hook trả dữ liệu; mutation `invalidateQueries` **đúng key**.
- `context/AuthContext`: hydrate qua `fetchMe` sau `loading`; login/logout;
  đồng bộ cross-tab qua `BroadcastChannel`; silent refresh 13 phút; idle logout 30
  phút (fake timers); refresh hỏng ⇒ user về null.
- `routes/PrivateRoute` + `AdminRoute`: chuyển hướng `/login` giữ `state.from`;
  user thường vào `/admin` bị đẩy về `/`.
- `hooks/usePagination`.

### Client — components có logic

Navbar (menu mobile, `aria-expanded`/`aria-controls`, Esc) · GlobalSearch
(debounce, nhóm phim/rạp/suất, ↑↓/Enter/Esc, Enter rỗng → `/search?q=`) · ETicket
(mã vé, QR, nhãn "Đã thanh toán · pi_…") · Pagination · ConfirmDialog ·
ResendTicketButton (**render `null` khi email tắt**) · InstallButton (chỉ hiện khi
cài được).

### Client — pages

Test theo **hành vi người dùng thấy**, không bám chi tiết DOM/CSS:

- **Home** — danh sách phim từ MSW, chuyển tab hero.
- **Movies** — chip thể loại/điểm/định dạng đẩy vào `searchParams`, "Xóa lọc"
  thật sự xoá, tìm tên **không dấu** ("dien bien" khớp).
- **MovieDetail** — phễu TP → rạp → ngày → suất; **chỉ suất chưa chiếu** được
  chào bán; khu đánh giá (gửi/sửa/xoá, badge "Đã xem").
- **Cinemas · CinemaDetail · Search** — lọc thành phố, đếm "N suất" theo suất còn
  chiếu được, `/search?q=` ra ba nhóm.
- **Login · Register** — thông báo lỗi, chuyển hướng sau khi đăng nhập (kể cả
  `state.from`).
- **BookingWizard** — đi hết 4 bước; **tối đa 8 ghế**; tổng tiền khớp
  `lib/pricing`; **409 ⇒ rớt đúng ghế xung đột**; hết giờ giữ ghế ⇒ quay về bước
  ①; không cho lùi lại sau khi đã tạo đơn.
- **MyTickets** — tách tab sắp tới / đã xem.
- **6 trang admin** — bảng render, tìm/lọc/phân trang, guard "còn suất chiếu thì
  không cho xoá phim/phòng", sửa ghế và huỷ đơn.

## Coverage làm cổng chặn

- Thêm `@vitest/coverage-v8` + script `test:cov`.
- CI job `checks` chạy `test:cov` **thay cho** `test:run` ⇒ **vẫn 7 cổng**, cổng
  cũ mạnh lên (không thêm job mới).
- Ngưỡng (`coverage.thresholds`) chốt ở lát cuối, **đúng bằng mức đo được**,
  không bịa số tròn.
- Loại khỏi phép đo: `e2e/`, `scripts/`, `src/pages/dev/`, `server/prisma/seed.ts`,
  `*.config.*`, `src/types/`, `src/i18n/locales/*.json`, chính các file trong
  `src/test/` và `server/src/test/`.

## Rủi ro đã lường trước

- **`happy-dom` + MSW**: nếu MSW không chặn được `fetch` của happy-dom → phương án
  2 là đặt `environment: "jsdom"` cho riêng nhóm file đó; nhưng CLAUDE.md ghi
  jsdom từng lỗi `ERR_REQUIRE_ESM` trên Node 22 → phương án 3 là
  `vi.stubGlobal("fetch")` bọc quanh MSW. **Chốt ngay ở lát T1**, không để lộ ra ở
  lát sau.
- **`BroadcastChannel`** có thể thiếu trong happy-dom ⇒ polyfill nhỏ trong setup.
- **Stripe** (`@stripe/react-stripe-js`) phải mock — test tuyệt đối không chạm
  mạng Stripe.
- **recharts** trong `AdminOverview` không vẽ khi container cao/rộng bằng 0 ⇒ mock
  `ResponsiveContainer`.
- **Rate limiter** của `auth/routes` giữ trạng thái giữa các test trong cùng
  process ⇒ phải reset (hoặc dùng IP khác nhau) để test không phụ thuộc thứ tự.

## Nguyên tắc cứng

**Test không được sửa hành vi app.** Nếu trong lúc viết test lòi ra bug thật:
dừng, báo người dùng, sửa ở **commit riêng** — không lặng lẽ đổi code sản phẩm cho
test xanh, cũng không hạ assertion xuống cho vừa hành vi sai.

## Chẻ lát

| Lát | Nội dung |
| --- | --- |
| T1 | hạ tầng: vitest 2 project · MSW · fixtures · `renderWithProviders` · `prismaMock` · đo coverage lần đầu (chưa đặt ngưỡng) |
| T2 | server: `gateway` (ma trận phân quyền) + `repo` (hợp đồng HTTP) |
| T3 | server: `auth/routes` · `tokens`/`middleware` · `holds` · `occupied` · `payments` · `email/send` |
| T4 | client tầng dữ liệu: `services` · `queries` · `AuthContext` · 2 route guard · `usePagination` |
| T5 | components có logic (7 cái) |
| T6 | pages công khai: Home · Movies · MovieDetail · Cinemas · CinemaDetail · Search |
| T7 | pages có luồng: Login · Register · BookingWizard · MyTickets |
| T8 | 6 trang admin |
| T9 | chốt ngưỡng coverage + sửa CI + cập nhật CLAUDE.md/README |

Mỗi lát = 1 commit, **7 cổng xanh**, push thẳng `main` (nếp làm việc của repo).

**Ước lượng:** thêm khoảng **150–250 test**, đưa tổng từ 164 lên tầm 350–400.
