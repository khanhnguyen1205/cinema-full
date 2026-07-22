# GĐ3 — Kiến trúc thật + deploy (Express + Prisma + Postgres, Docker, Render)

**Ngày:** 2026-07-22
**Trạng thái:** Đã duyệt thiết kế (chờ duyệt spec)
**Bối cảnh:** GĐ1 (nền móng kỹ thuật) + GĐ2 (Kinetic redesign + TanStack Query + TSX) đã hoàn tất. GĐ3 thay lõi dữ liệu giả (`json-server` + `db.json`) bằng kiến trúc thật, rồi deploy công khai.

## 1. Mục tiêu & north star

Nâng backend từ **mock** (json-server đọc/ghi `db.json` qua HTTP) lên **kiến trúc thật**: một **Express server TypeScript** duy nhất chạy trên **Postgres qua Prisma**, đóng gói **Docker**, **deploy public free tier**. Mục tiêu cá nhân: chuẩn "top 0.1%", đáng để khoe.

**Ràng buộc vàng — Hợp đồng HTTP giữ nguyên:** mọi endpoint `/api/*` và `/auth/*` phải giữ **đúng đường dẫn, đúng query params, đúng shape response** (kể cả `id` kiểu số) mà client hiện tại (`src/services/api.ts`, `src/services/auth.ts`) đang phụ thuộc. **Frontend không sửa (hoặc gần như không sửa).** Đây là bất biến kiểm thử của cả giai đoạn.

## 2. Quyết định đã chốt (qua brainstorm)

| Quyết định | Chốt | Lý do |
|---|---|---|
| Mức triển khai | Deploy public đầy đủ (free tier) | Mục tiêu khoe được, chạy công khai |
| Hosting | **1 service Express** serve **cả SPA build lẫn API**, cùng origin | Né cookie cross-site (`SameSite=Lax` giữ nguyên), không CORS cross-site, gọn |
| Nền tảng | **Render** (web service, deploy từ Dockerfile) + **Neon Postgres** (serverless, free tier rộng) | Free bền, Neon có branching dev/prod |
| Ngôn ngữ backend | **TypeScript, tách module** (routes/services/middleware) | Đồng bộ frontend TS-first, tận dụng type Prisma |
| Seat holds | **In-memory** (giữ nguyên logic hiện tại) | Deploy 1 instance → Map in-memory đúng & nhanh; tránh đấm DB mỗi heartbeat (Neon free giới hạn compute) |
| DB dev local | **Neon nhánh `dev`** (máy không có Docker) | Không cài gì trên Windows; `npm run dev` chỉ cần `DATABASE_URL` |
| DB CI | **Postgres service container** (GitHub Actions) | DB sạch mỗi lần chạy; e2e đặt vé ghi thoải mái |
| DB prod | **Neon nhánh `main`** | Tách hẳn dữ liệu thật khỏi dev |

## 3. Kiến trúc đích

### 3.1 Topology

- **Dev:** Vite `:3000` (web) + Express API `:4000` (auth + api), CORS credentials như hiện tại. **Bỏ hẳn json-server `:9999`.** Server nối Neon nhánh dev.
- **Prod:** một tiến trình Express, `NODE_ENV=production`, lắng nghe `process.env.PORT` (Render cấp). Phục vụ:
  - `/api/*`, `/auth/*` → xử lý bởi router
  - Mọi path khác → static từ `build/` với **SPA fallback** (`index.html`) cho client-side routing. Route API/auth được khai báo **trước** static fallback (Express match theo thứ tự).

### 3.2 Mô hình dữ liệu (Prisma schema)

Ánh xạ 1-1 các collection trong `db.json`. Id `Int @id @default(autoincrement())` (khớp id số client dùng). Chi tiết trường sẽ suy từ `db.json` hiện tại khi viết schema.

- **User** — `id, fullName, email @unique, password (bcrypt hash), role ("user"|"admin")`
- **City** — `id, name` (+ các trường hiện có)
- **Cinema** — `id, name, address, cityId → City`
- **Room** — `id, name, cinemaId → Cinema, type ("2D"|"3D"|"IMAX"), rows Int, cols Int, vipRows Int[], coupleRows Int[]?, aisleAfterCols Int[]?`
- **Movie** — `id, title, rating Float, genre, ...` (poster, mô tả, thời lượng… theo db.json)
- **Showtime** — `id, movieId → Movie, roomId → Room, price Int, bookedSeats String[]` (+ date/time theo db.json)
- **Booking** — `id, userId → User, showtimeId Int, cinemaId Int, roomId Int, seats String[], seatTypes Json, concessions Json, totalPrice Int, createdAt` (+ các trường vé hiện có)
- **Concession** — `id, name, price Int, ...`

**Kiểu:** mảng ghế/booked → `String[]`; cấu trúc phức (`seatTypes`, `concessions`) → `Json`; `vipRows/coupleRows/aisleAfterCols` → `Int[]`.

**Quan hệ:** FK theo id như hiện tại. Client resolve quan hệ ở phía client (giữ nguyên), nên API vẫn trả các collection phẳng — **không** cần Prisma `include` mặc định trừ khi endpoint hiện tại đã trả nested (không có).

### 3.3 Seed

`prisma/seed.ts` đọc chính `db.json` làm dữ liệu mẫu (db.json giữ lại **chỉ như seed**, hết vai trò DB sống), insert theo thứ tự FK: `cities → cinemas → rooms → movies → showtimes → users → concessions → bookings`. Mật khẩu trong db.json đã bcrypt (logic self-upgrade cũ vẫn còn cho seed cũ nếu có). Seed idempotent-ish: chạy trên DB rỗng (sau `migrate reset`/DB mới).

### 3.4 Cấu trúc backend (TS, tách module)

```
server/
  tsconfig.json              # Node/CommonJS, outDir dist, types node
  prisma/
    schema.prisma
    seed.ts
    migrations/              # do prisma tạo
  src/
    index.ts                 # entrypoint: app.listen(PORT)
    app.ts                   # ráp express app + middleware (json, cookie, cors, routes, static)
    env.ts                   # đọc + validate env (guard JWT_SECRET prod, DATABASE_URL bắt buộc)
    prisma.ts                # PrismaClient singleton
    auth/
      routes.ts              # POST register|login|logout|refresh, GET me
      service.ts             # bcrypt compare/hash, jwt sign/verify, tìm user qua prisma
      cookies.ts             # setAuthCookies / clearAuthCookies
      middleware.ts          # getUserFromReq, requireAuth, requireAdmin
    api/
      catalog.routes.ts      # movies/showtimes/cinemas/cities/rooms/concessions (public read, admin write)
      bookings.routes.ts     # GET scoped theo caller, POST ép userId, PATCH/DELETE admin
      users.routes.ts        # admin-only
      occupied.routes.ts     # GET /api/occupied-seats
      holds.ts               # store in-memory + POST/DELETE /api/holds
    static.ts                # serve build/ + SPA fallback (chỉ khi NODE_ENV=production)
```

**Chạy:** dev bằng `tsx` (watch); prod build `tsc → server/dist`, chạy `node server/dist/index.js`.

**Quy tắc phân quyền (giữ nguyên hành vi hiện có, chỉ đổi nguồn dữ liệu sang Prisma):**
- **catalog** (`movies/showtimes/cinemas/cities/rooms/concessions`): GET public; POST/PATCH/DELETE **admin-only**. `cinemas` read-only (không có route write) — giữ như hiện tại.
- **users**: mọi method **admin-only**.
- **bookings**: GET scoped — user thường chỉ thấy booking của mình (lọc theo `userId` caller), admin thấy tất cả; chặn GET booking lẻ của người khác. POST **ép `userId` = caller**, xong thì **nhả hold** của caller. PATCH/DELETE **admin-only**.
- **occupied-seats**: cần đăng nhập; trả **chỉ số ghế** đã đặt (booking + `showtime.bookedSeats`) hợp với ghế **người khác** đang giữ.
- **holds**: in-memory Map `<showtimeId, Map<seat,{userId,expiresAt}>>`, TTL 8'. POST thay+gia hạn (heartbeat), trả **409 + conflicts** nếu ghế người khác giữ; DELETE nhả; POST /bookings thành công nhả hold. **Giữ y nguyên** cấu trúc & TTL hiện tại.

**Query filters phải replicate đúng** (client đang gửi): ví dụ `/api/cinemas?cityId=`, `/api/showtimes?movieId=&roomId=`, `/api/rooms?cinemaId=`, `/api/users?email=`. Danh sách chính xác sẽ rà từ `src/services/*.ts` khi lập plan; mỗi filter map sang Prisma `where`.

### 3.5 Serve SPA (prod)

`static.ts`: `express.static("build")` + `app.get(/^\/(?!api|auth).*/, sendFile build/index.html)` để mọi route SPA (`/movies`, `/seats/:id`…) trả `index.html`. Chỉ bật khi `NODE_ENV=production` (dev vẫn để Vite lo). Route `/api` + `/auth` khai báo **trước**.

## 4. Docker + deploy

### 4.1 Dockerfile (multi-stage)

- **Stage build:** `node:22`, `npm ci`, `prisma generate`, `vite build` (→ `build/`), `tsc -p server` (→ `server/dist`).
- **Stage runtime:** `node:22-slim`, copy `build/`, `server/dist`, `server/prisma`, `node_modules` (prod). Lệnh khởi động: `prisma migrate deploy && node server/dist/index.js`. Expose `PORT`.
- `.dockerignore` loại `node_modules`, `.git`, `test-results`, v.v.

### 4.2 Render

- Web service **Docker** (build từ Dockerfile).
- Env: `DATABASE_URL` (Neon main, pooled connection string), `JWT_SECRET` (giá trị mạnh), `NODE_ENV=production`. Không cần `WEB_ORIGIN`/CORS cross-site vì cùng origin.
- `prisma migrate deploy` chạy khi khởi động (an toàn, idempotent).
- **Lưu ý free tier:** service ngủ sau ~15' không truy cập (cold start ~vài chục giây) — chấp nhận cho demo. Neon autosuspend tương tự.

### 4.3 Máy không có Docker

Dockerfile viết cẩn thận, **Render/CI build thật** (local không chạy được `docker build`). Phần verify được ở local mà không cần Docker: chạy server ở `NODE_ENV=production` sau khi `vite build` + `tsc`, xác nhận nó serve `build/` + `/api` cùng origin trên một port.

## 5. Dev / CI / env

### 5.1 Scripts & hook

- `npm run dev`: bỏ script `api` (json-server) → còn **auth (tsx) + web (vite)**. `npm run auth` chạy `tsx server/src/index.ts`.
- Thêm scripts Prisma: `prisma:generate`, `prisma:migrate` (dev), `prisma:deploy`, `prisma:seed`, `prisma:studio`.
- Server build/typecheck: `build:server` (`tsc -p server`), typecheck server đưa vào cổng.
- Cập nhật **SessionStart hook** `.claude/start-dev.ps1`: không khởi động `:9999`; khởi động auth (tsx) + web.
- Gỡ dependency `json-server`; gỡ `DATA_URL` khỏi env/code.

### 5.2 Env

- `.env` / `.env.example`: thêm `DATABASE_URL` (Neon). Bỏ `DATA_URL`. Giữ `JWT_SECRET`, `AUTH_PORT`, `WEB_ORIGIN` (dev CORS), `NODE_ENV`.
- Prisma đọc `DATABASE_URL`. Neon cần `?sslmode=require` (+ pooled URL cho prod).

### 5.3 CI (giữ 6 cổng, mở rộng phạm vi)

- **typecheck**: phủ cả `server/**/*.ts` (root tsconfig cho FE + server tsconfig cho BE; typecheck chạy cả hai).
- **lint**: block ESLint cho `server/**/*.ts` (thay block `server/*.js` cũ).
- **format:check**: phủ file mới.
- **test:run**: Vitest unit (không cần DB).
- **e2e**: thêm **Postgres service container**; bước setup `prisma migrate deploy` + `prisma:seed`; khởi động server + web; chạy Playwright (smoke cũ **+ luồng đặt vé đầy đủ**).
- **build**: `vite build` + `tsc -p server` (+ `prisma generate`).

### 5.4 e2e đặt vé đầy đủ

Spec Playwright mới (chạy trên Postgres CI dùng-xong-vứt, **được phép ghi**): đăng nhập **user thường** → vào 1 suất → chọn ghế → F&B → thanh toán (demo) → xác nhận → thấy **e-ticket** → kiểm tra vé xuất hiện ở **MyTickets**. Không cần dọn dữ liệu (DB ephemeral). Smoke read-only cũ giữ nguyên.

## 6. Cách chẻ lát (mỗi lát = 1 commit, 6 cổng xanh, push thẳng main)

| Lát | Nội dung | Verify |
|---|---|---|
| **3a** | Prisma + `schema.prisma` (mọi model) + `seed.ts` + nối Neon dev + scripts Prisma. Additive — runtime **chưa đổi** (json-server vẫn chạy). | `prisma validate`, `prisma migrate dev`, seed chạy trên Neon dev, typecheck/lint phủ TS mới |
| **3b** | Server → **TS + tách module** (auth/api/middleware/env/app), **vẫn** nền json-server (tầng data-access gọi fetch json-server). Hành vi **y hệt**. | App chạy như cũ; smoke xanh; cô lập "TS-hoá" khỏi "đổi DB" |
| **3c** | **Swap data layer** json-server → **Prisma** trong các service (auth + catalog + bookings + holds/occupied). Gỡ json-server, sửa `dev` script + hook + `.env`. | App chạy đầy đủ trên Neon dev; smoke xanh; 0 tham chiếu json-server |
| **3d** | **Dockerfile** multi-stage + `static.ts` serve SPA cùng origin (prod). `.dockerignore`. | Local `NODE_ENV=production` serve build/ + /api một port OK; Dockerfile review kỹ |
| **3e** | **CI**: Postgres service container + migrate/seed; server vào typecheck/lint/build; **e2e đặt vé đầy đủ**. | CI xanh trên GitHub (fresh DB); e2e booking pass |
| **3f** | **Deploy Render** (Neon main, env, migrate deploy) + viết lại CLAUDE.md/README. | Site public chạy được (login, đặt vé); docs khớp |

**Phương án thay thế (không chọn):** gộp 3b+3c đi thẳng TS+Prisma — ít bước bắc cầu hơn nhưng commit to, khó verify tách bạch "đổi TS" vs "đổi DB". **Chọn tách** để mỗi commit dễ review & truy vết lỗi.

## 7. Rủi ro & lưu ý

- **Fidelity hợp đồng API:** rủi ro lớn nhất là lệch shape/param khiến frontend vỡ âm thầm. Giảm thiểu: rà `src/services/*.ts` liệt kê **mọi** endpoint + query + shape kỳ vọng trước khi viết route; smoke + e2e bắt regression.
- **Kiểu `id`:** json-server trả `id` number; Prisma autoincrement Int — khớp. Nếu db.json có id không liên tục, seed phải giữ nguyên id (insert kèm id, rồi reset sequence Postgres) để FK + link client không lệch.
- **Mảng/Json trong Postgres:** `String[]`/`Json` map đúng; kiểm seed round-trip (đọc lại bằng API thấy đúng `seats`/`seatTypes`/`concessions`).
- **Neon free tier:** cold start + giới hạn compute; holds in-memory tránh ghi liên tục. Dùng **pooled** connection cho prod (nhiều request), direct cho migrate.
- **Không có Docker local:** không `docker build` được ở máy; dựa vào Render/CI. Bù bằng verify server prod-mode không-Docker.
- **HMR jsx→tsx & restart:** kinh nghiệm GĐ2 — đổi cấu trúc file/dep cần restart web (`rm -rf node_modules/.vite`), kill listener port. Server TS đổi cần restart tay (tsx watch giúp phần này).
- **Bí mật:** `DATABASE_URL` + `JWT_SECRET` chỉ trong `.env` (gitignored) và env Render — **không commit**. `.env.example` chỉ có placeholder.
- **Review qua điện thoại:** verify UI bằng screenshot headless (user review từ điện thoại) — như các GĐ trước.

## 8. Ngoài phạm vi (để GĐ4)

Search nâng cao, review phim, thanh toán sandbox thật, email vé, i18n, PWA. GĐ3 **chỉ** đổi kiến trúc + deploy, **không** thêm tính năng người dùng mới.
