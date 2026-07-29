# Giám sát lỗi production — Sentry

**Ngày:** 2026-07-29
**Trạng thái:** đã duyệt (brainstorm 2026-07-29)
**Tiền đề:** lộ trình GĐ1→GĐ4 đã đóng trọn, app live tại
`https://cinema-full-a9xt.onrender.com`. Đây là hạng mục **(2)** trong danh sách
dọn nợ chất lượng sau lộ trình; hạng mục (1) — dữ liệu seed chết — đã xong ở
`62bc73e`.

## Mục tiêu

Khi bản production gãy, **ta phải biết trong vài phút**, kèm đủ ngữ cảnh để sửa:
thông điệp lỗi, stack trace đọc được, route/hành động dẫn tới lỗi, và lỗi đó đụng
bao nhiêu người.

**Lý do ưu tiên:** lỗi "màn đen splash" trên bản live sống **4 ngày** (GĐ3f →
2026-07-28) mà không ai biết, vì bản live chỉ từng được kiểm bằng `curl` vào API —
API luôn khoẻ, còn SPA thì chết trong trình duyệt. Xem `docs` của `8b12e1d`. Không
có giám sát thì kịch bản đó lặp lại là chuyện sớm muộn.

**Không làm** (đã cân nhắc và loại):

- **Tracing hiệu năng** và **Session Replay** — quota free hẹp, bundle nặng
  (replay ~70KB gzip), và replay còn kéo theo bài toán che thông tin đăng nhập /
  thẻ. Ngoài phạm vi "biết khi production gãy".
- **Uptime monitoring / cảnh báo cold-start**: Render free ngủ sau ~15', dựng dậy
  mất 30-60s — đó là hành vi bình thường của gói free, không phải lỗi.
- **Log aggregation** (gom `console.log`). Việc khác, không phục vụ mục tiêu này.

## Quyết định đã chốt

1. **Phạm vi: cả frontend lẫn backend.** Lỗi màn-đen là lỗi FE; lỗi 5xx của API
   hiện chỉ nằm trong log Render rồi trôi mất. Bỏ một trong hai là để lại đúng nửa
   lỗ hổng.
2. **Chỉ bắt lỗi** — không tracing, không replay. Free 5.000 lỗi/tháng dư dùng.
3. **Source map: sinh kèm build, để Sentry tự tải về** qua URL công khai
   (`build.sourcemap: true`). Không cần `SENTRY_AUTH_TOKEN`, không đụng CI. Mã
   nguồn "lộ" ra không mất gì — repo vốn đã public.
4. **Chỉ bật ở production; thiếu DSN thì tắt êm** — đúng khuôn `isStripeEnabled()`
   / `isEmailEnabled()` đã có. Dev, `test:run`, e2e và CI không gửi gì.
5. **Dữ liệu kèm theo: chỉ `id` + `role`.** Không email, không tên. Kèm
   `sendDefaultPii: false` (không IP, không cookie, không header) và một bước xoá
   chủ động trường mật khẩu.
6. **Endpoint ném lỗi thử là công cụ TẠM** — dùng để verify rồi gỡ, không nằm lại
   trong codebase cuối.

## Phát hiện khi khảo sát code (quyết định phần lớn thiết kế)

Cắm theo đúng tài liệu Sentry (`Sentry.setupExpressErrorHandler(app)`) thì **hầu
như không bắt được lỗi backend nào của repo này**, vì mọi lỗi đã bị `try/catch`
nuốt trước khi tới Express:

| Chỗ nuốt lỗi                   | Hành vi hiện tại                                    |
| ------------------------------ | --------------------------------------------------- |
| `server/src/api/repo.ts:146`   | `console.error` → **502**; toàn bộ CRUD đi qua đây   |
| `server/src/payments/routes.ts:62` | `console.error` → 500                           |
| `server/src/email/send.ts:76,82`   | nuốt hẳn — **cố ý** "không bao giờ throw"       |
| `server/src/email/qr.ts:9`     | nuốt hẳn                                            |

⇒ Thiết kế phải gọi `captureException` **tại chính bốn chỗ này**. Error handler
của Express chỉ là lưới an toàn cho phần còn lại (lỗi ngoài `try`, lỗi
middleware).

Ở phía client thì `ErrorBoundary.componentDidCatch` đã có sẵn dòng comment
_"nơi thật có thể gửi về dịch vụ theo dõi"_ — đúng chỗ cần nối.

## Kiến trúc

Hai adapter nhỏ, mỗi bên một file, che toàn bộ SDK khỏi phần còn lại của app.

### Client — `src/lib/sentry.ts`

```
initSentry(): void                    // gọi 1 lần, trước createRoot
captureError(e: unknown, ctx?): void  // no-op khi chưa init
setSentryUser(u: {id, role} | null)   // no-op khi chưa init
```

Bật khi `import.meta.env.PROD && VITE_SENTRY_DSN`. Không bật ⇒ ba hàm trên thành
no-op, **không import động SDK**, không tốn byte nào lúc chạy dev.

### Server — `server/src/monitoring/sentry.ts`

```
initSentry(): void
captureServerError(e: unknown, ctx?: Record<string, unknown>): void
```

Đọc `process.env` **trực tiếp** theo khuôn `payments/stripe.ts` — **không được
import `env.ts`** (luật đã ghi trong CLAUDE.md: `env.ts` throw khi thiếu
`DATABASE_URL`, mà CI job `checks` không có DB; file server có unit test mà import
`env.ts` sẽ làm đỏ `test:run`).

### Phần thuần tách riêng để test được

Hai hàm không đụng SDK, không đụng mạng, có unit test chạy trong CI:

- `isMonitoringEnabled(dsn: string | undefined, isProd: boolean): boolean`
- `scrubEvent(event)` — xoá `password`, `confirmPassword` khỏi thân request và xoá
  header `cookie` / `authorization` nếu SDK có đính kèm.

## Điểm nối (5 chỗ)

| # | File                        | Thay đổi                                                        |
| - | --------------------------- | --------------------------------------------------------------- |
| ① | `src/index.tsx`             | `initSentry()` trước `createRoot`                                |
| ② | `src/components/ErrorBoundary.tsx` | `componentDidCatch` → `captureError(error, {componentStack})` |
| ③ | `src/context/AuthContext.tsx` | `setSentryUser({id, role})` khi có user, `null` khi logout      |
| ④ | `server/src/index.ts` + `app.ts` | import module monitoring ở **dòng import đầu tiên**; `Sentry.setupExpressErrorHandler(app)` **sau** `mountStatic(app)` |
| ⑤ | 4 chỗ nuốt lỗi ở bảng trên  | thêm `captureServerError(e, {…})` cạnh `console.error` sẵn có     |

Thứ tự ở ④ quan trọng: Sentry yêu cầu error handler đứng sau mọi route; `mountStatic`
là thứ cuối cùng gắn route (chỉ ở production).

## Cấu hình & bí mật

| Biến               | Nơi dùng | Ghi chú                                              |
| ------------------ | -------- | ---------------------------------------------------- |
| `VITE_SENTRY_DSN`  | client   | nướng vào bundle **lúc build**                        |
| `SENTRY_DSN`       | server   | đọc lúc chạy                                          |

DSN là **thông tin công khai theo thiết kế của Sentry** (nó nằm sẵn trong bundle
client của mọi trang web dùng Sentry), không phải secret.

### Ràng buộc bắt buộc: sửa `Dockerfile`

`import.meta.env.*` được thay thế **lúc build**, mà Docker build **không có `.env`**
(`.dockerignore` loại nó) — đúng cái bẫy đã cắn ở `8b12e1d`. Vì vậy stage 1 của
`Dockerfile` cần:

```dockerfile
ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
```

và `render.yaml` khai báo `VITE_SENTRY_DSN` (`sync: false`). Nếu Render không tự
truyền biến môi trường vào Docker build, **phương án dự phòng** là commit DSN vào
`.env.production` (Vite tự nạp file này ở chế độ production) — chấp nhận được vì
DSN vốn công khai; sẽ chốt lúc thực thi bằng cách kiểm tra bản deploy thật.

### Phương án đã cân nhắc và LOẠI

"Server phát DSN lúc chạy qua `GET /api/monitoring/config`", giống
`/api/payments/config`. **Loại**, vì nếu bug đúng kiểu "SPA không gọi được API"
(chính là lỗi màn-đen) thì cú fetch config cũng chết theo ⇒ Sentry không bao giờ
khởi động ⇒ ta lại mù đúng vào lúc cần nhất. DSN **phải** được nướng sẵn.

## Chống rò rỉ dữ liệu

- `sendDefaultPii: false` — không gửi IP, cookie, header. (Lưu ý: tuỳ phiên bản
  SDK, tuỳ chọn này có thể đã đổi tên sang nhóm `dataCollection`; chốt theo phiên
  bản thực cài lúc thực thi.)
- `beforeSend` chạy `scrubEvent` để xoá `password` / `confirmPassword` và header
  `cookie` / `authorization`.
- Chỉ `setUser({ id, role })`.
- Không bật replay/tracing ⇒ không thu nội dung form, không đụng dữ liệu thẻ của
  Stripe (vốn nằm trong iframe của Stripe, ngoài tầm với của app).

## Chống nhiễu (giữ trong hạn 5.000 lỗi/tháng)

- Chỉ capture **exception thật**. Không capture 401/403/404/409 nghiệp vụ — chúng
  là câu trả lời hợp lệ, không phải lỗi. Riêng nhánh 502/500 thì capture.
- `ignoreErrors` chỉ chặn vài chuỗi rác quen thuộc của extension trình duyệt
  (`ResizeObserver loop limit exceeded`, lỗi từ `chrome-extension://`).
- **Cố ý KHÔNG ignore `Failed to fetch`** — đó chính là triệu chứng của lỗi màn-đen
  cần bắt.
- 401 của `/auth/me` lúc chưa đăng nhập không phải exception nên vốn đã không lên.

## Kiểm thử

- 2 file test thuần mới: `isMonitoringEnabled` (bật/tắt theo dsn × isProd) và
  `scrubEvent` (xoá đúng trường, giữ nguyên phần còn lại, chịu được event thiếu
  field).
- CI không có DSN ⇒ SDK không init ⇒ `test:run` và `e2e` không phát sinh request
  mạng nào, không chậm đi.
- **7 cổng CI phải xanh** mỗi lát: typecheck · lint (0 warning) · format:check ·
  test:run · e2e · build · docker.
- Bundle client tăng ~30KB gzip — chấp nhận, đổi lấy khả năng thấy lỗi production.

## Verify (bằng chứng thật)

1. **Local prod-mode** (`npm run build` → `NODE_ENV=production PORT=4100 … npm run
   start:prod`) với DSN thật trong `.env`:
   - ném một lỗi render ở client → issue xuất hiện trên project web, **stack trace
     hiện tên file + số dòng thật** (chứng minh source map ăn);
   - ném một lỗi ở server → issue xuất hiện trên project api.
2. Mở event trên Sentry, xác nhận **không có** cookie, không có mật khẩu, `user`
   chỉ có `id` + `role`.
3. Xác nhận chạy `npm run dev` (không production) **không** sinh event nào.
4. **Trên live sau khi deploy:** dùng endpoint ném lỗi thử **tạm thời** (chỉ admin
   gọi được) để chứng minh cả hai đường ống sống trên Render, rồi **gỡ endpoint và
   deploy lại**. Việc gỡ nằm trong phạm vi công việc, không để lại.

## Cần người dùng chuẩn bị

1. Tạo tài khoản **Sentry free** (sentry.io).
2. Tạo **2 project**: `cinema-full-web` (platform React) và `cinema-full-api`
   (platform Node/Express) → lấy 2 DSN. Hai project tách nhau để lỗi FE/BE không
   trộn vào một dòng thời gian; quota gộp chung nên không tốn thêm.
3. Cắm DSN vào `.env` máy dev (để verify bước 1) và vào Environment của Render
   (`VITE_SENTRY_DSN`, `SENTRY_DSN`).

## Chẻ lát (chi tiết ở plan)

| Lát | Nội dung                                                                    |
| --- | --------------------------------------------------------------------------- |
| M1  | adapter client + 2 test thuần + 3 điểm nối FE (index/ErrorBoundary/AuthContext) |
| M2  | adapter server + `setupExpressErrorHandler` + 4 chỗ nuốt lỗi                 |
| M3  | `build.sourcemap` + `Dockerfile` ARG + `render.yaml` + `.env.example` + docs env |
| M4  | verify thật (local prod-mode → deploy → live → gỡ endpoint thử) + cập nhật CLAUDE.md/README |

Mỗi lát = 1 commit, 7 cổng xanh, push thẳng `main` (xem nếp làm việc của repo).
