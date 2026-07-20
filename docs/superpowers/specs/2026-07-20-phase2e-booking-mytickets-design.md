# GĐ2e — Redesign Booking Wizard + MyTickets (Kinetic + Query + TSX) — Design Spec

Ngày: 2026-07-20 · Lát **2e** của lộ trình chuyên nghiệp hoá (GĐ2 — Kinetic
Cinematic Redesign + Data Layer). Tiền đề: 2a–2d đã xong (design-system, Query
infra, Home/Movies/MovieDetail/Cinemas/CinemaDetail đã Kinetic + TSX + Query).

## 1. Mục tiêu & phạm vi

Tái thiết kế toàn bộ **luồng đặt vé** (`src/pages/booking/*`) **và** trang
`MyTickets` (`/tickets`) theo ngôn ngữ **Kinetic Cinematic**, convert sang **TSX**,
và chuyển tầng dữ liệu sang **TanStack Query** — **không rơi rớt** bất kỳ tính
năng nào hiện có.

- **Trong phạm vi:** BookingWizard (4 bước: ① ghế → ② bắp nước → ③ thanh toán →
  ④ vé điện tử), các component con, và MyTickets.
- **Giữ nguyên (không rơi rớt):** 4 bước; giữ ghế phía server (hold/release/
  heartbeat/xử lý **409**); poll ghế trống ở bước ①; đồng hồ giữ ghế 8 phút; F&B
  không bắt buộc; QR thật; re-check ghế trống ngay trước khi đặt; đặt **một**
  booking (không PATCH từng ghế); MyTickets chia sắp-chiếu/đã-xem theo ngày suất.
- **Ngoài phạm vi (YAGNI):** không thêm tính năng mới; **không đổi** server/gateway
  (`server/*.js`), không đổi hợp đồng API (`services/api.ts`), không thêm phương
  thức thanh toán thật, không thêm dependency mới.

**Tiêu chí thành công:** (1) mỗi bước đạt "wow" nhìn thấy được, e-ticket là điểm
nhấn; (2) 6 gate CI luôn xanh sau mỗi lát; (3) không mất tính năng; (4) responsive
+ a11y (seat-map thao tác được bằng bàn phím) + reduced-motion đạt chuẩn §7 của
spec GĐ2 gốc.

## 2. Tầng dữ liệu — `queries/booking.ts` + keys mới

Wizard/MyTickets **thôi tự `fetch`/`setInterval`/`useEffect`**; chuyển sang hook có
kiểu. Thêm file `src/queries/booking.ts`.

**Keys mới (bổ sung vào `src/queries/keys.ts`, giữ key cũ):**

```ts
occupiedSeats: (id: number | string) => ["occupiedSeats", id] as const,
concessions: ["concessions"] as const,
myBookings: ["bookings", "mine"] as const,
```

**Query hook:**

- `useOccupiedSeats(showtimeId, opts?: { poll?: boolean })` — `useQuery` với
  `queryKey: qk.occupiedSeats(showtimeId)`, `queryFn: () => getOccupiedSeats(id)`,
  `refetchInterval: opts?.poll ? 10000 : false`. Thay `setInterval` thủ công. Bước
  ① bật poll, bước ②③ tắt.
- `useConcessions()` — `useQuery` bọc `getConcessions`; Query lo `isLoading/isError/
  refetch` thay state thủ công + nút "Thử lại".
- `useMyBookings()` — `useQuery` bọc `getBookings` (gateway đã scope theo caller),
  `queryKey: qk.myBookings`; dùng cho MyTickets.

**Mutation hook:**

- `useCreateBooking()` — `useMutation` bọc `createBooking`; `onSuccess` →
  `queryClient.invalidateQueries` cho `qk.myBookings` và
  `qk.occupiedSeats(showtimeId)`.

**Cố ý KHÔNG bọc `holdSeats`/`releaseSeats` thành mutation.** Chúng là hiệu ứng
phụ theo thay đổi lựa chọn ghế + heartbeat + cleanup khi rời trang, không hợp mô
hình cache của Query. Wizard tiếp tục gọi trực tiếp, giữ nguyên logic **409**
(drop ghế xung đột, về bước ①, báo lỗi). Điều này thoả yêu cầu "áp Query cho
occupied-seats/hold" ở mức hợp lý mà không thêm phức tạp thừa.

**Suy dẫn `booked` (không ghi đè cache):** hiện wizard trừ ghế-mình-đang-chọn khỏi
tập occupied sau mỗi poll. Với Query, `SeatStep`/wizard **suy dẫn** bằng `useMemo`:
`booked = new Set(occupiedFromQuery)` rồi loại các `seatNumber` đang `selected` —
không viết đè vào cache Query. Giữ đúng hành vi cũ, sạch hơn.

## 3. Kiến trúc component — convert TSX + giữ ranh giới

Giữ nguyên cấu trúc file hiện có (đã tách tốt); chỉ `.jsx → .tsx`, làm rõ props,
không gộp/xé lại trừ chỗ đáng. Wizard là **bộ não** giữ state; các step là
**component trình bày** nhận props (không tự fetch).

| File | Đổi |
|---|---|
| `BookingWizard.jsx → .tsx` | Orchestrator: giữ state (step, selected, qty, paymentMethod, expired…), gọi hook §2 thay `useEffect fetch`; giữ nguyên logic hold/409/expire/confirm/re-check. |
| `SeatStep.jsx → .tsx` | Seat map kinetic + roving tabindex (§5). |
| `ConcessionStep.jsx → .tsx` | Nhận `catalog/qty/onChange/loading/error/onRetry` props thuần; redesign thẻ. |
| `PaymentStep.jsx → .tsx` | Props thuần, redesign card radio. |
| `TicketStep.jsx → .tsx` | E-ticket "bone" dùng `TicketEdge`; tái dùng `ETicket` (§6). |
| `OrderSummary.jsx → .tsx` | Sidebar sticky kinetic. |
| `BookingStepper.jsx → .tsx` | Thanh bước kinetic (N° + rule). |
| `SeatHoldTimer.jsx → .tsx` | Đồng hồ, **không đổi logic**. |
| `Booking.css` | Viết lại kinetic, xoá sạch class cũ. |

**Types:** tái dùng `Movie/Showtime/Room/Cinema/Concession/Booking` từ
`services/api`; kiểu layout ghế (`SeatCell`/`SeatRow`) lấy/khớp từ `lib/pricing`
(đọc `pricing.ts`, không tự chế type trùng). **Không thêm dependency**
(`qrcode.react` đã có).

## 4. Hướng thị giác Kinetic

Nền gần đen; Bebas display khổng lồ; nhãn mono chữ hoa nhỏ; viền cứng 1–2px; khối
**bone** đảo màu (nền trắng ngà, chữ đen) cho phần giống vé in; đánh số `N°`; mép
vé đục lỗ; chuyển động chỉ `transform/opacity` + nhánh `prefers-reduced-motion`.

**Bố cục ①–③:** 2 cột — `booking-main` (trái) + `OrderSummary` sticky (phải);
mobile xếp dọc, summary xuống dưới thành thanh tổng + CTA dính đáy.

**Thanh bước (`BookingStepper`):** mỗi bước `N°01 CHỌN GHẾ` (số Bebas + nhãn mono),
rule nối; bước xong đánh dấu/đảo màu, bước hiện gạch đỏ. Đồng hồ giữ ghế cùng hàng;
`≤60s` chuyển đỏ nhấp (tôn trọng reduced-motion).

**① Seat map:** màn hình = thanh cong + nhãn mono `MÀN HÌNH CHIẾU` + scanline mờ.
Ghế ô vuông mép cứng; trạng thái đọc bằng **cả màu lẫn ký hiệu** (a11y): thường
(viền), VIP (đặc/đỏ nhạt), đôi (ô rộng gấp đôi), đang chọn (đảo bone + ✓), đã đặt
(gạch chéo + mờ, `disabled`). Legend mono. **Bỏ nút zoom thủ công** → seat map
responsive tự co + **khung cuộn ngang** khi phòng rộng trên mobile (gợi ý "vuốt
ngang").

**② Bắp nước:** thẻ món mép cứng, emoji lớn, tên Bebas, giá mono; bộ đếm −/số/+
tactile; nhóm theo danh mục có tiêu đề mono; thẻ đã chọn đảo viền đỏ.

**③ Thanh toán:** 3 thẻ radio lớn (Momo/Thẻ/Quầy); chọn = đảo bone + dấu. Giữ dòng
"demo — không lưu thẻ thật".

**④ Vé điện tử (`TicketStep`):** điểm nhấn — khối **bone** (`TicketEdge`, mép đục
lỗ), cuống QR tách bằng răng cưa, mã `N°TK-00042`, barcode/mono.

**Sidebar (`OrderSummary`):** khối tối viền cứng, breakdown mono, `TỔNG CỘNG` Bebas
đỏ lớn; CTA solid đỏ; lỗi hiện băng đỏ.

## 5. Seat map — điều hướng bàn phím (roving tabindex)

Chuẩn a11y **grid pattern**, logic gói trong `SeatStep` (state `focusedSeat` +
`onKeyDown`), không rò ra wizard.

- **Một tab-stop** cho cả bản đồ: chỉ ô đang focus `tabIndex=0`, còn lại `-1`. Tab
  từ ngoài vào rơi vào ghế đang focus (mặc định ghế chọn-được đầu tiên).
- **Mũi tên** `←↑↓→` di chuyển focus theo lưới hàng×cột; nhảy qua vị trí trống
  (aisle/khe ghế đôi) tới ghế kế; **kẹp biên** (không cuộn vòng). `Home`/`End` =
  đầu/cuối hàng nếu rẻ để thêm, không thì bỏ (YAGNI).
- **Enter/Space** = chọn/bỏ ghế đang focus (`onToggle`). Ghế **đã đặt** vẫn focus
  được (đọc nhãn) nhưng không toggle.
- **ARIA:** container `role="grid"` + `aria-label="Sơ đồ ghế"`; mỗi ghế button với
  `aria-label` đầy đủ (`"Ghế A5, VIP, 120.000₫, đang chọn"` / `"…, đã đặt"`) +
  `aria-pressed`. Focus ring rõ (token `--focus`), không bị hover che.
- **Focus bám `seatNumber`, không theo index** → không nhảy lung tung khi poll cập
  nhật `booked`.

## 6. MyTickets — redesign + Query

- Convert `MyTickets.jsx → .tsx`; thay `useEffect + getBookings` bằng
  `useMyBookings()`. Giữ logic enrich (movie/showtime/cinema/room) + chia
  **sắp chiếu / đã xem** theo ngày suất.
- Visual Kinetic: header Bebas lớn + nhãn mono; mỗi vé = **thẻ e-ticket bone**
  (đồng bộ bước ④), có QR, mã `N°TK-…`, trạng thái (sắp chiếu = viền đỏ, đã xem =
  mờ). Empty state ("chưa có vé") + nút "Đặt vé ngay". Loading → `Skeleton`,
  error → nút thử lại.
- **Tái dùng:** tách phần thẻ vé thành component chung `ETicket` để bước ④ và
  MyTickets không lặp markup. Vị trí đặt (`components/` hay `booking/`) quyết khi
  viết plan, ưu tiên tái dùng thật (không tách non).

## 7. Kiểm thử

- **6 gate xanh mỗi commit:** `typecheck · lint (0 warning) · format:check ·
  test:run · e2e · build`.
- **Unit (Vitest):** key builder mới (`qk.occupiedSeats/concessions/myBookings`);
  nếu tách helper thuần điều hướng lưới ghế (next-seat theo phím) → test riêng.
- **Playwright smoke (read-only, không ghi `db.json`):** vào `/seats/:id` từ một
  suất thật, thấy màn hình + ghế; chọn 1 ghế → hiện trong summary; sang bước ② rồi
  ③. **Không** bấm "Thanh toán" (tránh ghi booking). MyTickets: theo cách smoke
  hiện tại (kiểm redirect/login nếu chưa có phiên trong e2e; không ghi dữ liệu).
- **Screenshot** desktop (1280) + mobile (390) mỗi lát gửi review.

## 8. Chẻ lát (mỗi lát ≥1 commit thẳng `main`, gate xanh)

1. **2e/1 — Query infra booking:** keys + `queries/booking.ts` + unit test (chưa
   đổi UI).
2. **2e/2 — Wizard khung sang TSX + wire Query:** `BookingWizard/BookingStepper/
   SeatHoldTimer/OrderSummary` → TSX, dùng hook §2, **giữ layout tạm** để cô lập
   rủi ro data trước visual.
3. **2e/3 — SeatStep kinetic + roving tabindex** (phần nặng nhất).
4. **2e/4 — Concession + Payment kinetic.**
5. **2e/5 — TicketStep e-ticket bone + component `ETicket` tái dùng.**
6. **2e/6 — MyTickets kinetic + Query** (dùng `ETicket`).
7. **2e/7 — Playwright smoke mở rộng + verify CI + push.**

Ranh giới lát có thể gộp/tách khi viết plan nếu một lát quá to/nhỏ. Mỗi lát kết
thúc: TSX + Query (nơi có data) + redesign + gate xanh + screenshot.

## 9. Ràng buộc (áp mọi lát)

- **0 warning ESLint**; luôn đọc output; xử `react-refresh`/`exhaustive-deps` bằng
  disable có chú thích khi chính đáng (giữ pattern `seatKey` hiện có).
- **Absolute imports** từ `src` root; sibling cùng thư mục dùng `./`.
- **Không thêm dependency mới.**
- **Copy tiếng Việt.** Giá VND `toLocaleString("vi-VN")` + `₫`.
- **Commit thẳng `main`.** **Không** add `CLAUDE.md`/`README.md` vào commit lát.
- Cuối commit body: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Gotcha HMR:** thêm `.tsx`/xoá `.jsx` → Vite trắng trang → kill :3000 +
  `rm -rf node_modules/.vite` + `npm start`. Screenshot fullPage cuộn dần để
  `Reveal` hiện.

## 10. Rủi ro & giảm thiểu

- **Roving tabindex phức tạp** → tách helper thuần (next-seat theo phím) + unit
  test; giữ logic trong `SeatStep`.
- **Chạm data 2 lần** → lát 2e/2 wire Query giữ layout tạm, tách rủi ro data khỏi
  visual trước khi redesign nặng ở 2e/3.
- **Lặp markup e-ticket** → component `ETicket` dùng chung bước ④ + MyTickets.
- **HMR trắng trang khi đổi ext** → quy trình restart + xoá `.vite`.
- **Smoke ghi `db.json`** → dừng ở bước ③, không bấm "Thanh toán".
