# GĐ4 tính năng 5 — Thanh toán sandbox (Stripe test-mode)

Ngày: 2026-07-27
Trạng thái: đã duyệt (brainstorm), chờ plan thực thi

## Mục tiêu

Bước ③ của `BookingWizard` hiện chỉ là 3 radio demo (Momo / Thẻ / Tại quầy) — bấm "Thanh
toán" là `POST /api/bookings` ngay, không có đồng tiền nào đổi chủ và **server tin số
`totalPrice` do client gửi**. Tính năng này biến "Thẻ" thành một lần thanh toán **thật**
trên Stripe test-mode: server tự tính lại số tiền từ dữ liệu trong DB, thu tiền qua Stripe,
và chỉ tạo booking sau khi tự mình xác minh với Stripe rằng khoản đó đã `succeeded`.

Quyết định chốt qua brainstorm:

1. **Cổng thanh toán: Stripe test-mode** (key test lấy ngay sau khi đăng ký email, hỗ trợ
   VND, SDK chính chủ). Không làm VNPay.
2. **Payment Element nhúng tại chỗ**, không redirect — giữ được state wizard, hold ghế
   8 phút và ngôn ngữ thiết kế Kinetic.
3. **"Thẻ" → Stripe thật, giữ "Tại quầy" = trả sau (tạo đơn ngay), bỏ "Momo"** (giả hoàn toàn).
4. **Xác nhận đã trả tiền = server tự truy vấn lại Stripe** (`paymentIntents.retrieve`),
   không dùng webhook / Stripe CLI.
5. **Thiếu key Stripe ⇒ ẩn hẳn phương thức thẻ**, app chạy y như hiện nay.
6. **e2e Stripe có điều kiện**: chạy khi có key (máy dev), tự `skip` khi không có (CI).

Ngoài phạm vi (cố ý): webhook, hoàn tiền, lưu thẻ, VNPay, trả góp/thanh toán một phần.

## Kiến trúc

### Backend — thư mục mới `server/src/payments/`

| File | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `quote.ts` | **Thuần**. Từ `basePrice`, danh sách ghế (`["A3","H1"]`), `vipRows`/`coupleRows` của phòng và các dòng F&B `{price, qty}` → `{seatTotal, fnbTotal, serviceFee, total}`. | không gì |
| `verify.ts` | **Thuần**. `checkIntent(intent, {expectedAmount, userId})` → `{ok:true}` hoặc `{ok:false, reason}`. | không gì |
| `stripe.ts` | `isStripeEnabled()`, `getStripe()` (khởi tạo **lười**), `publishableKey()`. Đọc `process.env` **trực tiếp**, không import `env.ts`. | `stripe` (npm) |
| `routes.ts` | `GET /api/payments/config`, `POST /api/payments/intent`. | Prisma + 3 file trên |

`quote.ts` và `verify.ts` là hai đơn vị thuần **có unit test** nên tuyệt đối không được
import `env.ts` (nó throw khi thiếu `DATABASE_URL`, và job `checks` trên CI không có DB) —
đây là luật đã ghi trong CLAUDE.md, `static.ts` là tiền lệ.

**Vì sao nhân bản logic giá từ `src/lib/pricing.ts`:** `server/tsconfig.build.json` đặt
`rootDir: server/src` nên không import chéo ra `src/` được. `quote.ts` sao chép ~40 dòng
luật giá và **khoá bằng test số cứng** để hai bên không trôi khỏi nhau.

Luật giá (bám đúng `src/lib/pricing.ts`):

- `vipPrice(base) = round(base × 1.3 / 1000) × 1000`
- `couplePrice(base) = round(base × 1.6 / 1000) × 1000`
- Ghế đôi **thắng** VIP khi một hàng vừa nằm trong `vipRows` vừa trong `coupleRows`
- `SERVICE_FEE = 15000`, chỉ tính khi đơn có ít nhất 1 ghế
- `total = seatTotal + fnbTotal + serviceFee`

Hàng của một ghế = phần chữ cái đầu của `seatNumber` (`"H1"` → `"H"`).

### Mount trong `app.ts`

```
/auth → /api/occupied-seats → /api/holds → /api/payments → /api (catch-all) → SPA
```

Router riêng **phải** đứng trước catch-all `/api` (Express match theo thứ tự) và SPA vẫn
đứng cuối cùng. Đây đúng khuôn mẫu `occupied`/`holds` đang dùng.

### Endpoint

**`GET /api/payments/config`** — công khai, không cần đăng nhập.

```json
{ "enabled": true, "publishableKey": "pk_test_..." }
```

Thiếu `STRIPE_SECRET_KEY` hoặc `STRIPE_PUBLISHABLE_KEY` ⇒ `{ "enabled": false }` (không có
trường `publishableKey`). **Không bao giờ** trả secret key.

**`POST /api/payments/intent`** — cần đăng nhập.

Body: `{ showtimeId: number, seats: string[], concessions: [{id, qty}] }`.
Server **không đọc bất kỳ con số tiền nào từ client**:

1. `401` nếu chưa đăng nhập; `503` nếu `!isStripeEnabled()`; `400` nếu thiếu/không hợp lệ
   `showtimeId` hoặc `seats` rỗng / quá `MAX_SEATS`(8).
2. Tra `Showtime` (→ `price`, `bookedSeats`) và `Room` (→ `vipRows`, `coupleRows`);
   `404` nếu không có.
3. Kiểm ghế: ghế đã bán (`bookedSeats` ∪ ghế trong `Booking` của suất) hoặc **đang bị
   người khác giữ** (`heldByOthers` trong `holds.ts`) ⇒ **`409 {conflicts: [...]}`** —
   *trước khi* charge.
4. Tra giá F&B từ bảng `Concession` theo `id` (bỏ qua id lạ), gọi `quote()`.
5. `stripe.paymentIntents.create({ amount: total, currency: "vnd",
   automatic_payment_methods: {enabled: true}, metadata: {userId, showtimeId, seats} })`.
   VND là zero-decimal ⇒ `amount` chính là số tiền nguyên, không nhân 100.
6. Trả `{ clientSecret, amount }`.

### Luồng đặt vé bằng thẻ

1. Bước ③ đọc `usePaymentConfig()`. `enabled=false` ⇒ chỉ hiện "Tại quầy", luồng cũ nguyên vẹn.
2. Chọn "Thẻ" ⇒ hiện `<PaymentElement>` (deferred mode `{mode:"payment", amount: total,
   currency:"vnd"}`). **Chưa tạo PaymentIntent** ⇒ quay lại bước ① đổi ghế không để lại rác.
3. Bấm "Thanh toán" → `elements.submit()` (validate form thẻ).
4. `POST /api/payments/intent` → `{clientSecret, amount}`.
5. `stripe.confirmPayment({ elements, clientSecret, redirect: "if_required" })` — thẻ xử lý
   tại chỗ, **không điều hướng** ⇒ hold ghế + đồng hồ 8 phút còn nguyên.
6. `paymentIntent.status === "succeeded"` ⇒ `POST /api/bookings` như cũ, **thêm
   `paymentRef: paymentIntent.id`**.
7. Gateway xác minh rồi mới tạo đơn (mục dưới).

### Gateway — nhánh `bookings` POST

Thêm vào `api/gateway.ts`, giữ nguyên mọi luật phân quyền hiện có:

- `paymentMethod === "card"`:
  1. Thiếu `paymentRef` ⇒ **`402`**.
  2. `getStripe().paymentIntents.retrieve(paymentRef)`; lỗi/không có ⇒ **`402`**.
  3. Tính lại tiền bằng đúng đường của `/intent` (showtime + room + concessions từ DB) →
     `checkIntent(intent, {expectedAmount, userId})`. Không đạt ⇒ **`402`** kèm lý do.
  4. Đạt ⇒ **ghi đè** `seatTotal`, `fnbTotal`, `serviceFee`, `totalPrice` bằng số server
     tự tính, rồi `handleRest` như cũ.
  5. `P2002` trên `paymentRef` (đơn đã tồn tại cho lần trả tiền này) ⇒ **trả về chính đơn
     đã có với `200`** thay vì lỗi.
- `paymentMethod !== "card"`: **`paymentRef` bị loại bỏ khỏi body**, hành vi y như hiện nay.

`checkIntent` từ chối khi: `status !== "succeeded"`, `amount !== expectedAmount`,
`currency !== "vnd"`, hoặc `metadata.userId !== userId` của người gọi.

### Database

```prisma
model Booking {
  ...
  paymentRef String? @unique   // "pi_3Q..." — null với đơn "Tại quầy" và đơn cũ
}
```

`@unique` là chốt chống dùng lại một lần trả tiền cho nhiều đơn (và là cơ sở của
idempotency ở trên). Cột nullable ⇒ 3 đơn trong seed không bị ảnh hưởng. Migration
`booking_payment_ref` áp lên Neon dev bằng `npm run prisma:migrate`; trên Render nó tự áp
khi container khởi động (`prisma migrate deploy` đã nằm trong CMD) — không cần thao tác tay.

Kéo theo: `collections.ts` thêm `paymentRef` vào `writable` của `bookings`;
`src/types/index.ts` thêm `paymentRef?: string | null`.

### Frontend

File mới:

- `src/services/payments.ts` — `getPaymentConfig()`, `createPaymentIntent(payload)`
  (`credentials:"include"` như mọi fetch khác).
- `src/queries/payments.ts` — `usePaymentConfig()` (`staleTime: Infinity`), key `qk.paymentConfig`.
- `src/pages/booking/StripePayForm.tsx` — `<Elements>` + `<PaymentElement>` + hàm submit.

Sửa:

- `PaymentStep.tsx` — danh sách phương thức **sinh động**: `card` (chỉ khi `enabled`) +
  `counter`; bỏ `momo`. Khi chọn `card` thì render `StripePayForm` ngay dưới. Hiện gợi ý
  thẻ test `4242 4242 4242 4242 · ngày tương lai bất kỳ · CVC bất kỳ`.
- `BookingWizard.tsx` — mặc định `paymentMethod` = `card` khi bật, ngược lại `counter`
  (đặt qua effect khi config về). Giữ **một** nút hành động duy nhất là `.os-k__cta`
  "Thanh toán" của `OrderSummary`: `PaymentStep` đăng ký hàm submit của mình lên một
  `ref` do wizard giữ; `onPrimary` ở bước ③ gọi ref đó khi method là `card`, còn `counter`
  thì gọi thẳng `confirm()` như hiện nay.
- `ETicket.tsx` + `AdminBookings.tsx` — hiện nhãn "Đã thanh toán · `pi_…`" khi có
  `paymentRef` (chỉ đọc, không sửa được).

`appearance` của Elements chỉnh theo token Kinetic (nền `--surface-2`, viền cứng, chữ mono,
accent `--red`); `locale` lấy theo `i18n.language`.

Dependency mới: `@stripe/stripe-js` + `@stripe/react-stripe-js` (client), `stripe` (server).

### i18n

Keys mới trong namespace `booking`, thêm vào **cả** `vi.json` và `en.json`: tên + mô tả 2
phương thức còn lại, "Đang xử lý thanh toán…", "Thẻ bị từ chối", "Thanh toán chưa hoàn
tất", "Chưa cấu hình thanh toán thẻ", gợi ý thẻ test. Không còn key nào của `momo`.

### Biến môi trường

`STRIPE_SECRET_KEY` và `STRIPE_PUBLISHABLE_KEY` — **cả hai đều ở phía server**.
Publishable key đi ra client qua `GET /api/payments/config` chứ **không** làm biến `VITE_*`:
đổi key trên Render không phải build lại image, và `.env.example` chỉ chứa placeholder.
Thiếu key ⇒ `enabled:false`, server vẫn khởi động bình thường (khác `DATABASE_URL`).

## Xử lý lỗi & tình huống biên

| Tình huống | Xử lý |
|---|---|
| Thẻ bị từ chối (`4000 0000 0000 0002`) | Hiện lý do Stripe trả về, **ở lại bước ③**, ghế vẫn giữ, thử lại được (lần sau tạo intent mới) |
| Đã trả tiền nhưng `POST /bookings` lỗi mạng | Gửi lại **cùng `paymentRef`**; nếu đơn đã kịp tạo thì `@unique` → P2002 → **trả về đơn đã có (200)** ⇒ không mất tiền, không trùng đơn |
| Hết 8 phút giữ ghế khi đang điền thẻ | Đồng hồ đưa về bước ①; intent chỉ tạo lúc bấm "Thanh toán" nên **chưa trừ tiền** |
| Ghế bị người khác chiếm ngay trước khi trả | `POST /intent` trả **409 + conflicts** *trước khi* charge → bỏ ghế vướng, về bước ① (dùng lại cơ chế 409 sẵn có của wizard) |
| Số tiền client hiển thị lệch số server tính | Stripe báo lỗi tích hợp ngay ở dev; `quote.test.ts` khoá số cứng để không xảy ra ở prod |
| Thiếu key Stripe | `config.enabled=false` ⇒ ẩn phương thức thẻ; `POST /intent` trả `503` |
| Render free ngủ 15' | Chỉ chậm request đầu, không ảnh hưởng luồng |

## Kiểm thử

- **Unit (Vitest, không cần DB/mạng):**
  - `quote.test.ts` — số cứng với `base = 75000`: thường 75.000 · VIP `round1000(97.500)` =
    **98.000** · đôi **120.000** · phí dịch vụ 15.000 · đơn không ghế ⇒ phí dịch vụ 0 ·
    hàng vừa VIP vừa đôi ⇒ tính giá đôi · F&B cộng đúng theo `price × qty`.
  - `verify.test.ts` — 4 ca: hợp lệ · lệch tiền · khác `userId` · `status !== "succeeded"`.
- **e2e:** `e2e/payment.spec.ts` — user thường → ghế cuối danh sách → chọn "Thẻ" → điền
  `4242…` trong iframe Stripe → ra e-ticket → `finally` xoá đơn qua admin API (đúng khuôn
  `booking.spec.ts`). **`test.skip` khi thiếu `STRIPE_SECRET_KEY`** ⇒ CI xanh và không gọi
  mạng ra Stripe; máy dev có key thì chạy thật.
- **Sửa `booking.spec.ts`:** chọn "Tại quầy" trước khi bấm "Thanh toán" (mặc định giờ là
  thẻ khi có key). Ràng buộc cũ giữ nguyên: placeholder `your@email.com` / `••••••••`,
  nút "Đăng nhập", nút "Thanh toán".
- 7 cổng CI giữ nguyên xanh, **không cần thêm secret nào vào GitHub**.

## Rủi ro đã biết

- **VND trên tài khoản Stripe test:** VND là zero-decimal và được Stripe hỗ trợ làm đơn vị
  hiển thị, nhưng tài khoản test tạo ở một số quốc gia có thể từ chối. Phát hiện ngay ở lát
  T3 (curl tạo intent). Phương án dự phòng nếu bị từ chối: giữ nguyên toàn bộ kiến trúc,
  chỉ đổi `currency` sang `usd` với tỷ giá quy đổi cố định khai báo một chỗ trong
  `quote.ts` (`amountForStripe()`), ghi rõ trong README là con số demo.
- **Lệch luật giá giữa `src/lib/pricing.ts` và `server/src/payments/quote.ts`:** hai bản sao
  có thể trôi khỏi nhau khi sửa giá về sau. Giảm thiểu bằng test số cứng ở cả hai phía và
  một dòng chú thích trỏ chéo trong mỗi file.

## Chia lát thực thi

Mỗi lát = 1 commit + push thẳng `main`, app luôn xanh:

| Lát | Nội dung |
|---|---|
| **T1** | Cột `paymentRef` + migration + `collections.ts` + `types` (chưa đổi hành vi) |
| **T2** | `payments/quote.ts` + `payments/verify.ts` thuần + unit test (TDD) |
| **T3** | `payments/stripe.ts` + `payments/routes.ts` + mount `app.ts`; verify bằng curl |
| **T4** | Gateway: bắt buộc `paymentRef` khi `card`, xác minh, ghi đè tổng tiền, idempotency |
| **T5** | Client: services + queries + dựng lại `PaymentStep` + `StripePayForm` + i18n + CSS |
| **T6** | `paymentRef` ở vé/admin + `payment.spec.ts` + sửa `booking.spec.ts` + CLAUDE/README/.env.example + screenshot duyệt |

## Việc người dùng cần làm (trước lát T3)

1. Đăng ký `dashboard.stripe.com/register` (test mode không cần thông tin doanh nghiệp).
2. Bật **Test mode** → Developers → API keys → copy `pk_test_…` và `sk_test_…`.
3. Dán vào `.env` (đã gitignore):
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
4. *(Tuỳ chọn, sau khi xong)* thêm 2 biến đó vào Environment của service trên Render để
   bản live cũng bật thanh toán thẻ.
