# 🎬 Cinema App

**▶️ Live demo: https://cinema-full-a9xt.onrender.com** — one Docker service on Render + Neon Postgres.
Demo accounts: admin `admin@cinema.vn` / `admin123` · user `a@cinema.vn` / `123456`.
_(Free tier sleeps after ~15 min idle — the first request may take 30–60 s to wake.)_

A **React 18 + TypeScript** cinema booking single-page app (FER202 student project), built with **Vite** and a custom neo-brutalist "Kinetic" dark UI, running on a **real backend**: an **Express 5 + TypeScript** server with **PostgreSQL via Prisma**, bcrypt-hashed passwords and JWT sessions in **httpOnly cookies**, plus a per-collection **authorization gateway** at `/api/*`. Server state is managed with **TanStack Query**. Ships as a **single Docker image** that serves the API and the built SPA from one origin.

## Architecture

| Piece | Dev | Production |
|-------|-----|------------|
| Express server (`server/src/`) | **:4000** — auth + `/api` gateway | one service: auth + `/api` **+ serves the SPA build** |
| Vite dev server | **:3000** — the app you open | (not used; the SPA is prebuilt into `build/`) |
| PostgreSQL | Neon `dev` branch | Neon `production` branch |

The browser only ever calls the Express server: `src/services/api.ts` → `BASE_URL = /api`, `src/services/auth.ts` → `AUTH_URL`. Every request uses `credentials:"include"` so the session cookie reaches the gateway. In production the SPA and the API share one origin, so cookies stay `SameSite=Lax` with no CORS at all.

## Setup

### 1. Install dependencies
```bash
npm install          # postinstall runs `prisma generate`
```

### 2. Point at a database
Copy `.env.example` → `.env` and fill in `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) from any Postgres — a free [Neon](https://neon.com) project works well. Then create the schema and load the sample data:
```bash
npm run prisma:migrate    # apply migrations
npm run prisma:seed       # load db.json: 40 movies · 12 cinemas · 24 rooms · 889 showtimes
                          #               30 users · 153 bookings · 215 reviews
```

`db.json` is committed, so a fresh clone gets the full catalogue from that one command — you never need the `seed:*` scripts, which only exist to *regenerate* the fixture. The fixture's dates are fixed in the file but **shifted at seed time** so the 7-day showtime window always lands around today: clone this in six months, seed, and there are still bookable screenings. Log in as `admin@cinema.vn` / `admin123`, or as any seeded customer (e.g. `mai.tran@cinema.vn`) with `123456`. Stripe and Resend keys are optional — without them the card payment method and the "resend ticket" button simply don't render.

### 3. Start
```bash
npm run dev        # auth/API (:4000) + Vite (:3000) via concurrently
```
Or separately: `npm run auth` and `npm start`. Open **http://localhost:3000**.

> The server runs under `tsx` **without watch** — after editing `server/**`, restart `npm run auth` (in-memory seat holds reset with it). `src/` hot-reloads via Vite HMR. On Windows, kill the server before `npm install`: a running process locks the generated Prisma client.

### Other scripts
```bash
npm run build            # vite build (→ build/) + tsc (→ server/dist/)
npm run start:prod       # node server/dist/index.js  (NODE_ENV=production also serves build/)
npm run typecheck        # app + server
npm run lint             # ESLint 9 (flat config)
npm run format           # Prettier write   ·   npm run format:check
npm run test             # Vitest (watch)   ·   npm run test:run (once)
npm run test:cov         # Vitest + coverage (this is the CI gate)
npm run e2e              # Playwright (chromium): smoke + full booking flow
npm run prisma:studio    # browse the database
```

**CI** (GitHub Actions) runs six gates on every push — `typecheck` · `lint` (0 warnings) · `format:check` · `test:cov` (unit tests **+ coverage thresholds**) · `e2e` · `build` — plus a **Docker image build**. The e2e job spins up a throwaway Postgres 16 container, migrates and seeds it, then runs Playwright.

## Deployment

The `Dockerfile` is multi-stage: build (`npm ci` → `npm run build`) then a slim runtime carrying `build/` + `server/dist/` + prod dependencies. It starts with `prisma migrate deploy && node server/dist/index.js`, so schema changes apply on boot.

Required environment variables on the host: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (a long random string — the server **refuses to start** in production with the dev default), `NODE_ENV=production`. `PORT` is supplied by the platform. Seat holds live in process memory, so run **one instance**.

Optional: `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` enable card payments (see below). Leave them unset and the card method simply doesn't appear — nothing else changes. Likewise `RESEND_API_KEY` (+ optional `MAIL_FROM`) enables the ticket email; without it no mail is sent and the resend button is hidden.

## Thanh toán sandbox (Stripe test-mode)

Bước ③ của luồng đặt vé có hai phương thức: **Thanh toán tại quầy** (giữ chỗ, trả tiền mặt ở rạp) và **Thẻ quốc tế (Stripe)**. Thẻ chạy hoàn toàn trên **Stripe test-mode — không có tiền thật nào bị trừ**; dùng thẻ thử `4242 4242 4242 4242`, ngày hết hạn bất kỳ trong tương lai, CVC bất kỳ.

Điểm đáng chú ý về bảo mật: **server tự tính lại số tiền từ dữ liệu trong database** (giá suất chiếu, hàng ghế VIP/đôi, giá bắp nước) chứ không tin con số client gửi lên; và trước khi ghi vé, server hỏi lại Stripe xem giao dịch đó đã `succeeded` với đúng số tiền và đúng người mua chưa. Mã giao dịch được lưu ở `Booking.paymentRef` với ràng buộc `@unique`, nên gửi lại cùng một lần thanh toán sẽ nhận lại đúng vé cũ thay vì tạo vé trùng.

Để bật ở máy dev: lấy hai key test tại `dashboard.stripe.com` (Developers → API keys) rồi thêm vào `.env`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Publishable key được phục vụ qua `GET /api/payments/config` chứ không nhúng vào bundle, nên đổi key trên môi trường production **không cần build lại**.

## Email vé (Resend)

Đặt vé xong, hệ thống **gửi vé qua email**: mã vé, phim, rạp/phòng, ngày giờ, ghế, bắp nước, tổng tiền, kèm **mã QR đính kèm dạng PNG** (Gmail chặn ảnh nhúng base64 nên đính kèm là cách duy nhất chạy được ở mọi phần mềm mail). Email theo đúng ngôn ngữ đang chọn trên web (vi/en). Bước ④ và mỗi vé ở trang "Vé của tôi" đều có nút **Gửi lại vé qua email**.

Email được gửi **ở nền, sau khi đơn đã trả về** — Resend hỏng thì vé vẫn ra bình thường, lỗi chỉ nằm trong log server. Riêng nút gửi lại thì chờ kết quả thật và báo lỗi cụ thể; endpoint đó yêu cầu đăng nhập, chỉ **chủ vé hoặc admin** gọi được, và giới hạn 5 lần/15 phút.

Để bật ở máy dev: tạo API key tại `resend.com` (API Keys → Create API Key) rồi thêm vào `.env`:

```
RESEND_API_KEY=re_...
MAIL_FROM=Cinema <onboarding@resend.dev>
```

Lưu ý: khi **chưa verify domain riêng**, Resend chỉ cho gửi tới đúng địa chỉ email của chủ tài khoản Resend — gửi tới user seed (`a@cinema.vn`) sẽ bị từ chối, và đó là hành vi đúng như thiết kế (đơn vẫn thành công). Verify domain là gỡ được hạn chế này mà không phải sửa dòng code nào.

## Pages

| Route | Page |
|-------|------|
| `/` | Home — featured-movie hero carousel + trending grid + genre/cinema browse (star ratings from data) |
| `/movies` | Movies — full catalog with search, genre chips, **city + date filters**, and sort |
| `/movie/:id` | Movie Detail — pick city → cinema → date → showtime |
| `/cinemas` | Cinemas — browse cinemas by city |
| `/cinema/:id` | Cinema Detail — movies & showtimes at one cinema |
| `/login` · `/register` | Authentication |
| `/seats/:showtimeId` | **Booking Wizard** — seats → concessions (F&B) → payment → e-ticket (QR) *(requires login)* |
| `/tickets` | My Tickets — upcoming/past ticket cards *(requires login)* |
| `/admin` | Admin Panel — dashboard (revenue charts) + manage movies, rooms & showtimes (CRUD) + bookings (edit seats / cancel) *(admin-only)* |

### Seeded accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@cinema.vn` | `admin123` | admin (can reach `/admin`) |
| `a@cinema.vn` | `123456` | user |

Passwords are stored bcrypt-hashed in the database; the admin gate lives in `src/routes/AdminRoute.jsx` (role-based).

## Booking flow & seat holds

The booking wizard drives a **real server-side seat hold** so two people can't book the same seat: selecting seats calls the server's in-memory hold (8-minute TTL, matching the on-screen timer), the seat map polls every ~10s to reflect seats others are holding, a conflict returns HTTP 409, and holds are released on booking / leaving the page / expiry. Holds live in process memory only (reset on restart) and never hit the database — which is why production runs a **single instance**.

## Data model

Prisma models (`server/prisma/schema.prisma`): `User`, `Movie` (with `rating`), `City`, `Cinema` (→ city), `Room` (→ cinema; `type` 2D/3D/IMAX, `rows`, `cols`, `vipRows`, `coupleRows`, `aisleAfterCols`), `Showtime` (→ movie + room; `price` = standard-seat price, `bookedSeats` = pre-sold seat numbers), `Booking`, `Concession` (F&B catalog). `db.json` is the **seed fixture** for these tables, nothing more. **There is no `seats` table** — the seat map is generated from the room's `rows×cols` layout and "booked" seats are derived from `showtime.bookedSeats` ∪ matching bookings ∪ active holds. `Booking` deliberately carries **no foreign keys** (a ticket is a snapshot, so removing a movie can never corrupt it). Standard price comes from room type (2D 75k · 3D 95k · IMAX 120k); VIP = `round(price×1.3)`, couple = `round(price×1.6)`, to the nearest 1,000. Pricing/layout helpers live in `src/lib/pricing.ts`.

## Project structure

`src/` is organized by type (lowercase folders): `components/` (+ `components/ui/` design-system primitives, `components/admin/`), `routes/` (`PrivateRoute`/`AdminRoute`), `context/` (`AuthContext`), `hooks/`, `lib/` (`pricing.ts`, `seatNav.ts`), `queries/` (TanStack Query hooks + key registry), `services/` (`api.ts`/`auth.ts`), `types/` (domain models), `pages/` (+ `pages/booking/` wizard, `pages/admin/` panel, `pages/dev/` DEV-only), `styles/` (`tokens.css`/`utilities.css`/`global.css`). Absolute imports are enabled via `tsconfig.json` paths (`baseUrl: "src"`) + a matching Vite alias, e.g. `import Navbar from "components/Navbar"`.

## Design system — "Kinetic"
A custom neo-brutalist CSS design system (no UI library). Tokens (colors, type scale, spacing, borders, motion) live in `src/styles/tokens.css`; the look is near-black + huge **Bebas Neue** display type, **Space Mono** labels, hard borders, a decisive **red** accent, and inverted **"bone"** blocks for emphasis (`N°` numbering, ticket edges, marquees; `prefers-reduced-motion` respected). Reusable primitives are in `src/components/ui/`; a DEV-only `/kitchen-sink` route previews them. Fonts are self-hosted via `@fontsource` (Bebas Neue / Barlow / Barlow Condensed / Space Mono).

## Testing
- **525 Vitest tests** in two projects — `client` (happy-dom + Testing Library) and `server` (supertest against the real Express app with a mocked Prisma, so it runs without a database). Coverage: **91.4% statements**, enforced in CI by thresholds in `vite.config.mjs` (`npm run test:cov`).
- **No module-level mocking on the client**: tests exercise the real `services/*` and `queries/*`, answered by **MSW** at the HTTP layer with writable fixture tables — so "save the form" is asserted all the way down to the list refreshing.
- **Playwright** in `e2e/` — `smoke.spec.ts` is read-only; `booking.spec.ts` books a ticket for real and `reviews.spec.ts` posts a review, each deleting its own data afterwards; `payment.spec.ts` drives a real Stripe test-mode card payment and self-skips when no keys are present.
- **Accessibility is a gate**: `a11y.spec.ts` runs **axe-core over 18 states** (public pages, the booking wizard's three steps, admin, and an open dialog) in a real browser, and fails the build on any critical or serious violation. Lighthouse scores **100/100 accessibility** on every public page — see `docs/superpowers/plans/2026-08-01-lighthouse-baseline.md` for the full before/after.

## Tech stack
- React 18 + **TypeScript 5** + React Router v6, built with **Vite 6**
- **TanStack Query v5** (server state) · **Express 5 + TypeScript** (auth · API gateway · SPA host) · **Prisma 6 + PostgreSQL** · **Docker** (multi-stage)
- bcryptjs + jsonwebtoken (bcrypt hashes + JWT httpOnly cookies)
- `qrcode.react` (e-tickets) · `recharts` (admin charts)
- **Vitest** + Testing Library + **MSW** (unit, coverage-gated) · **supertest** (server) · **Playwright** (e2e) · ESLint 9 + Prettier · GitHub Actions CI
- Custom "Kinetic" CSS design system (no UI library) — fonts: Bebas Neue / Barlow / Barlow Condensed / Space Mono
- **Bilingual (Vietnamese default + English)** via react-i18next (prices always VND; dates locale-aware)
- **PWA** — installable, offline app-shell + cached public catalog, install button + update toast (`vite-plugin-pwa` / Workbox)
- **Email vé** qua Resend (HTTP API, không SDK) — gửi nền sau khi đặt + nút gửi lại; thiếu key thì tự tắt
