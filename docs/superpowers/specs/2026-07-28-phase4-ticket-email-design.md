# GĐ4 tính năng 6 — Email vé (Resend)

**Ngày:** 2026-07-28
**Trạng thái:** đã duyệt (brainstorm 2026-07-28)
**Tiền đề:** tính năng cuối của GĐ4. Năm tính năng trước (review · search nâng cao ·
i18n · PWA · thanh toán Stripe) đã xong và đang chạy trên `main`.

## Mục tiêu

Sau khi đặt vé thành công, người dùng nhận **email chứa vé** (mã vé, phim, rạp,
phòng, ngày giờ, ghế, bắp nước, tổng tiền, mã QR đính kèm). Có thêm nút **"Gửi lại
vé"** ở bước ④ của wizard và ở trang "Vé của tôi".

**Không làm** (đã cân nhắc và loại): email chào mừng khi đăng ký; email nhắc trước
giờ chiếu (đòi scheduler chạy nền, mà Render free ngủ sau ~15' nên cron trong
process không đáng tin).

## Quyết định đã chốt

1. **Phạm vi:** chỉ email vé + nút gửi lại. Nút gửi lại cứu được ca email lần đầu
   lỗi, và cho phép thử lại mà không phải đặt vé mới (rồi phải dọn DB).
2. **Nhà cung cấp: Resend**, gọi qua **HTTP API** — không dính rủi ro Render chặn
   cổng SMTP như phương án Gmail/nodemailer. Free 3.000 email/tháng.
   - **Ràng buộc đã biết:** chưa verify domain riêng thì Resend **chỉ cho gửi tới
     chính email chủ tài khoản**. User seed (`a@cinema.vn`…) là email giả nên sẽ bị
     từ chối — đúng như thiết kế "gửi lỗi không được làm hỏng gì". Để xem email
     thật, người dùng đăng ký một tài khoản trên app bằng Gmail thật rồi đặt vé.
   - **Không** đưa email cá nhân vào `db.json` (repo public).
   - Khi nào verify domain, **code không phải sửa một dòng nào**.
3. **QR:** sinh PNG ở server, **đính kèm file** (`ve-TK-00007.png`). Gmail chặn ảnh
   `data:` base64 nên không nhúng inline được; phương án "ảnh tải từ server" bị loại
   vì mã vé tuần tự khiến URL QR của vé người khác đoán được, lại thêm một endpoint
   công khai.
4. **Ngôn ngữ:** theo ngôn ngữ UI lúc đặt vé. Client gửi header `x-lang: vi|en`.
   Server **không import được** `src/i18n` (`rootDir: server/src`) nên giữ một bảng
   chuỗi vi/en nhỏ riêng — cùng khuôn với `payments/quote.ts` nhân bản luật giá.
5. **Gửi nền, không chặn đặt vé.** Tiền đã trừ qua Stripe rồi; email hỏng không bao
   giờ được làm hỏng đơn. Lỗi chỉ ghi log server. Nút "Gửi lại vé" thì **đồng bộ**
   và báo đúng thành công/thất bại.
6. **Mẫu mail:** HTML mang thương hiệu Kinetic (bảng + style inline, khối gần-đen,
   mã vé đỏ khổ lớn) + **bản plain-text kèm theo** (giảm nguy cơ vào spam, đọc được
   trên mọi client). Mail client không tải được font tự host ⇒ chữ rơi về font hệ
   thống, chấp nhận.
7. **Thiếu `RESEND_API_KEY` ⇒ tính năng tắt êm**: không gửi gì, nút gửi lại biến
   mất, app chạy y như cũ. Sao chép nguyên khuôn `isStripeEnabled()`.

## Kiến trúc

### Module mới `server/src/email/`

| File | Trách nhiệm | Thuần |
|---|---|---|
| `templates.ts` | `renderTicketEmail(data, lang) → {subject, html, text}`; bảng chuỗi vi/en; escape HTML | **có** |
| `lang.ts` | `pickLang(header) → "vi" \| "en"` | **có** |
| `qr.ts` | `qrPng(value) → Buffer` PNG (dep `qrcode`) | không |
| `resend.ts` | `isEmailEnabled()` + `sendMail()` qua `fetch` | không |
| `send.ts` | `sendTicketEmail(bookingId, lang)`: tra DB → QR → template → gửi | không |
| `routes.ts` | `GET /api/emails/config`, `POST /api/emails/ticket` | không |

**`templates.ts` và `lang.ts` bắt buộc phải thuần** — không import Prisma/env/resend
— vì unit test của chúng chạy trong job CI `checks` vốn **không có database**. Đây
là luật đã ghi trong CLAUDE.md ("file server có unit test thì không được import
`env.ts`"), từng làm CI đỏ ở lát 3d.

`resend.ts` đọc `process.env` **trực tiếp** (không qua `env.ts`), y hệt
`payments/stripe.ts`.

### Gọi Resend bằng `fetch` trần

Node 22 có `fetch` toàn cục; API Resend chỉ là một POST JSON:

```
POST https://api.resend.com/emails
Authorization: Bearer <RESEND_API_KEY>
{ from, to, subject, html, text, attachments: [{ filename, content: <base64> }] }
```

⇒ **không thêm SDK `resend`**. Dependency mới duy nhất: `qrcode` + `@types/qrcode`.

### Móc vào luồng đặt vé

`repo.ts::handleRest` đổi kiểu trả về `Promise<void>` → **`Promise<unknown>`**, trả
bản ghi vừa ghi (POST/PATCH) hoặc `undefined`. 7 chỗ gọi hiện có bỏ qua giá trị nên
không phải sửa.

Trong `gateway.ts`, nhánh `bookings` + `POST`, sau khi tạo đơn thành công:

```ts
const row = await handleRest(req, res, rest);
if (stId != null) releaseHolds(stId, user.id);
void sendTicketEmail(bookingIdOf(row), pickLang(req.headers["x-lang"]));
```

- `void` + hàm không bao giờ throw ⇒ đơn đã trả về client rồi, email lỗi không thể
  ảnh hưởng.
- Nhánh **idempotent replay** (`paid.existing` — gửi lại cùng `paymentRef` sau khi
  rớt mạng) **không gửi lại email**: vé đó đã gửi ở lần đầu.

### Endpoint gửi lại

- `GET /api/emails/config` → `{ enabled: boolean }` (công khai, để client ẩn nút).
- `POST /api/emails/ticket { bookingId }` → cần đăng nhập, **chủ-hoặc-admin** (dùng
  lại `ownerOrAdmin` của `reviews-validate.ts`), rate-limit **5 lần / 15 phút / IP**
  bằng `express-rate-limit` đã có sẵn. Trả `{ sent: true }` hoặc mã lỗi + thông báo
  tiếng Việt.
- Mount **`/api/emails` trước catch-all `/api`** trong `app.ts` — thứ tự mount là
  load-bearing, đặt sau sẽ bị gateway nuốt. Thứ tự mới:
  `/auth` → `/api/occupied-seats` → `/api/holds` → `/api/payments` → `/api/emails`
  → `/api` → SPA.

### Client

- `src/services/email.ts`: `getEmailConfig()`, `resendTicketEmail(bookingId)`.
- `src/queries/email.ts`: `useEmailConfig()` (`staleTime: Infinity`, khuôn
  `usePaymentConfig`) + `useResendTicket()` mutation.
- `src/services/api.ts::createBooking`: thêm header `x-lang` lấy từ `i18n.language`.
- **Bước ④ (`TicketStep`)**: dòng "Đã gửi vé tới `{email}`" (email lấy từ
  `useAuth().user.email`) + nút **Gửi lại vé** với 3 trạng thái (đang gửi / đã gửi /
  lỗi).
- **`MyTickets`**: nút gửi lại trên mỗi vé sắp tới.
- Cả hai chỗ **chỉ render khi `config.enabled`**.
- Mọi chuỗi mới qua `t()`, thêm key vào **cả** `vi.json` và `en.json`.

### Env

| Biến | Bắt buộc | Mặc định |
|---|---|---|
| `RESEND_API_KEY` | để bật tính năng | — (thiếu ⇒ tắt êm) |
| `MAIL_FROM` | không | `Cinema <onboarding@resend.dev>` |
| `WEB_ORIGIN` | đã có sẵn | `http://localhost:3000` — dùng làm link "Xem vé" |

Vào `.env.example` dưới dạng placeholder. Key thật chỉ nằm ở `.env` (gitignored) và
Environment của Render.

## Xử lý lỗi

| Tình huống | Hành vi |
|---|---|
| Thiếu `RESEND_API_KEY` | Không gửi; `config.enabled=false`; nút gửi lại không render; `POST /api/emails/ticket` → **503** |
| Resend từ chối (email giả, quota, key sai) | Ghi log `[email]`; đặt vé **vẫn thành công**; nút gửi lại báo lỗi cho người dùng |
| Không tìm thấy booking | **404** |
| Không phải chủ đơn, không phải admin | **403** |
| Bấm gửi lại quá nhiều | **429** |
| `qrcode` sinh QR lỗi | Vẫn gửi email, không đính kèm — mã vé chữ vẫn dùng được ở quầy |

## Kiểm thử

**Unit (~12 test, Vitest, chạy được ở CI không cần DB):**
- `templates.test.ts`: mã vé/tên phim/ghế/tổng tiền VND xuất hiện trong **cả** `html`
  lẫn `text`; tiêu đề vi ≠ tiêu đề en; tên phim chứa `<script>` bị escape; vé không
  có bắp nước thì không sinh khối F&B rỗng.
- `lang.test.ts`: `"en"` → en; `"vi"`/rỗng/`undefined`/rác → vi.

**Không thêm e2e Playwright.** Playwright không đọc được hộp thư, và bấm nút gửi thật
sẽ đốt quota + gửi tới email giả. Thay vào đó `e2e/booking.spec.ts` sẵn có trở thành
phép thử hồi quy tốt: trên máy dev có key, nó đặt vé thật → email bắn nền tới
`a@cinema.vn` → Resend từ chối → nếu code sai (throw/await nhầm) thì e2e đỏ ngay;
đúng thiết kế thì vé vẫn ra bình thường.

**Verify thật (thủ công, cuối lát E5):** đăng ký tài khoản trên app bằng Gmail thật →
đặt vé → mở hộp thư → chụp màn hình email (desktop + mobile) đưa lên Artifact để
người dùng duyệt, như mọi lát trước.

## Chẻ lát

Mỗi lát = 1 commit, 7 cổng CI xanh, push thẳng `main`.

| Lát | Nội dung |
|---|---|
| **E1** | `templates.ts` + `lang.ts` thuần + unit test (TDD). Chưa ai gọi. |
| **E2** | `qr.ts` + `resend.ts` + `send.ts` + `routes.ts` + mount `/api/emails` + `.env.example`. Verify bằng curl `GET /api/emails/config`. |
| **E3** | `handleRest` trả bản ghi; móc `sendTicketEmail` vào `gateway.ts`. Verify: đặt vé thật khi **chưa** có key (không hỏng gì) và khi **có** key (log gửi). |
| **E4** | Client: services + queries + `x-lang` + UI bước ④ + MyTickets + i18n vi/en. |
| **E5** | Verify thật bằng Gmail + screenshot Artifact + cập nhật `CLAUDE.md`/`README.md`. |

## Rủi ro

- **Ràng buộc người nhận của Resend** là hạn chế lớn nhất; đã chấp nhận có ý thức,
  gỡ được bất cứ lúc nào bằng cách verify domain.
- **Windows khoá Prisma client:** phải kill :4000 trước khi `npm install qrcode`, và
  **nhớ bật lại** — quên là toàn bộ e2e đỏ hàng loạt trông như lỗi code.
- **Render**: `RESEND_API_KEY` phải thêm vào Environment thì bản live mới gửi được
  (giống hệt tình trạng Stripe hiện nay).
