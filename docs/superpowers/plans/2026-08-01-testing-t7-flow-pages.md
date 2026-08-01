# T7 — Test cho các trang có luồng (Login · Register · BookingWizard · MyTickets)

Lát thứ 7 của spec `docs/superpowers/specs/2026-07-29-component-page-testing-design.md`.
Điểm xuất phát: **383 test**, statements **55.03%**, `src/pages` **71.80%** (sau T6, commit `d7f98be`).

## Nguyên tắc giữ nguyên từ T1–T6

- Đi qua **MSW** ở tầng HTTP; `services/*` và `queries/*` là mã **thật**, không `vi.mock`.
- **Không sửa hành vi app** để test xanh. Test đỏ vì app sai ⇒ dừng lại báo người dùng.
- Mỗi commit giữ **7 cổng CI xanh**, push thẳng `main`.
- `renderWithProviders` mặc định `waitForAuth: true` — mọi khẳng định sau render phải `await findBy…`.

## Quyết định đã chốt trước khi làm

- **`services/api.ts` đường đọc không kiểm `r.ok`: GIỮ NGUYÊN** (người dùng chọn phương án A,
  2026-08-01). Test nào cần chạm nhánh lỗi phải dùng `HttpResponse.error()` (lỗi mạng), không
  phải mã 500.
- **Không test luồng thẻ Stripe ở unit** — `StripePayForm` nạp `@stripe/stripe-js` thật; luồng
  thẻ đã có `e2e/payment.spec.ts` chạy trên Stripe test-mode thật. Unit chỉ khẳng định phần
  **hiện/ẩn phương thức** theo `usePaymentConfig()`.

## Chẻ commit

| # | Nội dung | Test |
| --- | --- | --- |
| 1 | hạ tầng: 6 handler MSW còn thiếu + fixture vé quá khứ | 0 |
| 2 | `Login` + `Register` | ~14 |
| 3 | `BookingWizard` bước ① ghế + ② bắp nước | ~12 |
| 4 | `BookingWizard` bước ③ thanh toán + ④ vé + xung đột ghế | ~10 |
| 5 | `MyTickets` | ~8 |
| 6 | `docs(test)` cập nhật bảng độ phủ | — |

---

## Commit 1 — hạ tầng

`src/test/msw/handlers.ts` thiếu 6 endpoint mà 4 trang này gọi; với
`onUnhandledRequest:"error"` thì thiếu handler = test đỏ ngay.

- `POST /auth/login` — trả `fx.user` khi đúng `a@cinema.vn`/`123456`, ngược lại **401**
  `{error:"Email hoặc mật khẩu không đúng."}` (khớp thông điệp cố tình chung chung của server thật).
- `POST /auth/register` — trả user mới (201); email đã tồn tại → **409**.
- `GET /api/bookings` — trả `bookings` (cổng thật đã scope theo caller).
- `POST /api/bookings` — 201 kèm `id` mới, giữ lại body để test đọc.
- `POST /api/holds` — mặc định `{ok:true}`; test xung đột **đè** bằng 409 + `conflicts`.
- `DELETE /api/holds` — `{}` 200.

`src/test/fixtures.ts`: thêm **booking #2** trỏ `showtimeId: 2` (suất **quá khứ**) để MyTickets
có dữ liệu cho cả hai tab. Đã rà: chỉ `ETicket.test.tsx` dùng `fx.bookings[0]` ⇒ an toàn.

## Commit 2 — Login + Register

**Login** (`src/pages/Login.test.tsx`)

1. Bỏ trống email/mật khẩu → `auth.fillAll`, **không** gọi `/auth/login`.
2. Sai mật khẩu → hiện đúng thông điệp **server trả về** (không phải chuỗi cứng của client).
3. Đăng nhập đúng → body gửi lên có `remember: true` (mặc định tick).
4. Bỏ tick "ghi nhớ" → `remember: false`.
5. Thành công **không có `state.from`** → về `/`.
6. Thành công **có `state.from = /tickets`** → tới `/tickets` (khẳng định bằng route đích trong `<Routes>`).
7. Đang gửi → nút submit `disabled` (chặn double-submit).
8. Nút con mắt đổi `type` password↔text và đổi `aria-label`.
9. Link "Đăng ký ngay" mang theo `state.from` sang `/register`.

**Register** (`src/pages/Register.test.tsx`)

10. Thiếu trường → `auth.fillAll`, không gọi API.
11. Mật khẩu < 6 ký tự → `auth.passMin`, không gọi API.
12. Xác nhận không khớp → `auth.passMismatch`, không gọi API.
13. Thành công → gọi `/auth/register` đúng body, rồi chuyển hướng theo `state.from`.
14. Email đã tồn tại (409) → hiện thông điệp server.

## Commit 3 — BookingWizard ① ②

`src/pages/booking/BookingWizard.seats.test.tsx`. Render tại route `/seats/1`
(suất 1 · phòng 1 · giá **90.000** · VIP hàng C · đôi hàng E).

1. Nạp meta: `OrderSummary` hiện tên phim, rạp, phòng, loại phòng.
2. Ghế `A1`/`A2` (từ `/occupied-seats`) hiện là **đã đặt** và bấm không chọn được.
3. Chọn `B1` → tên ghế vào ô "Ghế", tổng = **105.000 ₫** (90.000 + phí 15.000) — số cứng khớp `lib/pricing`.
4. Bấm lại `B1` → bỏ chọn, tổng về 0, CTA khoá lại.
5. Ghế VIP `C1` → tổng **132.000 ₫** (117.000 + 15.000).
6. CTA khoá khi chưa chọn ghế nào.
7. Chọn ghế thứ 9 → thông điệp `booking.maxSeats`, danh sách vẫn **8** ghế.
8. Mỗi lần đổi lựa chọn → `POST /api/holds` nhận đúng mảng ghế đang chọn.
9. Unmount → gọi `DELETE /api/holds?showtimeId=1`.
10. Bấm "Tiếp tục" → sang bước ②, danh mục F&B hiện ra.
11. Tăng số lượng bắp → dòng F&B + tổng cộng tăng đúng giá catalog.
12. Trần `MAX_ITEM_QTY` (10): bấm tăng quá 10 không tăng nữa.
13. "Bỏ qua" ở bước ② → sang bước ③.

## Commit 4 — BookingWizard ③ ④ + xung đột

`src/pages/booking/BookingWizard.pay.test.tsx`

1. `payments/config` `enabled:false` → chỉ có "Tại quầy", **không** có thẻ.
2. Đè config `enabled:true` → hiện thẻ và **tự chọn** thẻ.
3. Đặt vé tại quầy → `POST /api/bookings` body có `seats`, `seatTypes`, `totalPrice`,
   `showtimeId`, `userId` đúng + header `x-lang`.
4. Đặt xong → bước ④ hiện e-ticket + mã vé.
5. `POST /api/holds` trả **409 + conflicts** → rớt đúng ghế đụng độ, **về bước ①**, hiện `booking.conflictSeats`.
6. Re-check trước khi đặt: `/occupied-seats` trả thêm ghế đang chọn → `booking.clashSeats`,
   về bước ①, **không** có `POST /bookings` nào.
7. `POST /bookings` lỗi → `booking.bookFailed`, vẫn ở bước ③.

**Rủi ro đã lường:** hết giờ giữ ghế = `SeatHoldTimer` đếm 480 lần `setTimeout`. Tua bằng timer
giả có thể chậm/treo (bẫy đã cắn ở T4/T5). Nếu vậy: **tách test riêng cho `SeatHoldTimer`**
(truyền `seconds` nhỏ, khẳng định `onExpire` + `resetKey` đếm lại) và ghi chú lý do ngay trong
file test, thay vì tua 8 phút bên trong wizard.

## Commit 5 — MyTickets

`src/pages/MyTickets.test.tsx`

1. Đang tải → skeleton.
2. `GET /bookings` lỗi mạng → thông điệp lỗi + nút "Thử lại" refetch được.
3. Tab mặc định "Sắp tới" chỉ hiện vé của suất tương lai.
4. Chuyển tab "Đã xem" → chỉ vé quá khứ, có class `is-past`.
5. Không có vé → thông điệp rỗng đúng theo tab + nút về `/movies`.
6. Vé hiện đủ tên phim / rạp / phòng (enrich qua 4 lời gọi phụ).
7. Vé mà `getShowtime` hỏng → vẫn nằm ở tab "Sắp tới" (nhánh `!b.showtime?.time`).
8. `emails/config` tắt → không có nút gửi lại; bật → có.

## Commit 6 — docs

Chạy `npm run test:run -- --coverage`, cập nhật bảng trong
`docs/superpowers/plans/2026-07-29-testing-coverage-baseline.md`.
