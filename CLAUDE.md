# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **React 18 + TypeScript** cinema booking single-page app (student project, FER202 course), built with **Vite 6**, on a **real backend**: a modular **Express 5 + TypeScript** server (`server/src/`, port 4000) talking to **PostgreSQL via Prisma**. That one server does three jobs: **auth** (bcrypt passwords + JWT access/refresh tokens in **httpOnly cookies**), an **authorization gateway** at `/api/*` (per-collection/role rules, then Prisma queries), and — in production only — **serving the built SPA from the same origin**. There is no mock API: **json-server was removed in GĐ3c**; `db.json` survives purely as the **seed source** for `server/prisma/seed.ts`.

The codebase is **TypeScript-first**: source is `.ts`/`.tsx`. `allowJs` is on, so three files remain `.jsx` and interop untyped — `src/routes/PrivateRoute.jsx`, `src/routes/AdminRoute.jsx`, `src/components/admin/Modal.jsx` (a re-export shim). All server code is `.ts`.

## Commands

```bash
npm install            # install deps (postinstall runs `prisma generate`)
npm run dev            # start both servers at once (auth/API + web) via concurrently
# — or run them separately:
npm run auth           # Express auth + API gateway on :4000 (tsx, no watch)
npm start              # Vite dev server on :3000

npm run build          # production build: vite build (→ build/) + tsc (→ server/dist/)
npm run build:server   # server only
npm run start:prod     # node server/dist/index.js (needs NODE_ENV=production to serve the SPA)
npm run preview        # serve the Vite build on :3000

# database (Prisma → Postgres)
npm run prisma:migrate # migrate dev (creates + applies a migration)
npm run prisma:deploy  # migrate deploy (production/CI, idempotent)
npm run prisma:seed    # load db.json into the database (wipes + reinserts, keeps ids)
npm run prisma:studio  # browse the data

# quality gates (also run in CI)
npm run typecheck      # tsc --noEmit (app) && tsc -p server/tsconfig.json (server)
npm run lint           # ESLint 9 (flat config); CI requires 0 warnings
npm run lint:fix
npm run format         # Prettier write
npm run format:check   # Prettier check (CI)
npm run test           # Vitest (watch)
npm run test:run       # Vitest once (CI)
npm run e2e            # Playwright (chromium): smoke + full booking flow
```

**Six CI gates** (`.github/workflows/ci.yml`) must stay green: `typecheck` · `lint` (0 warnings) · `format:check` · `test:run` (Vitest unit) · `e2e` (Playwright) · `build`. A seventh job, **`docker`**, builds the image so the Dockerfile is exercised on every push (the dev machine has no Docker). The `e2e` job spins up a **Postgres 16 service container**, runs `prisma migrate deploy` + seed, then Playwright.

### Ports & running the app
Two servers in dev: Express **auth + API** on **:4000**, Vite dev server on **:3000** (open http://localhost:3000). Client service files point at **:4000**: `src/services/api.ts` uses `BASE_URL = :4000/api`, `src/services/auth.ts` uses `AUTH_URL = :4000`. URLs come from `.env` (`VITE_API_URL`, `VITE_AUTH_URL`) with fallbacks; copy `.env.example` → `.env`. The server needs **`DATABASE_URL`** (+ `DIRECT_URL` for migrations) or it refuses to start. A `SessionStart` hook (`.claude/start-dev.ps1`) auto-starts both when a session begins.

In **production** there is only **one** service on one port: the same Express app serves `/api` + `/auth` **and** the SPA build (`server/src/static.ts`), so cookies stay same-origin and CORS is switched off.

**Gotchas:**
- The server runs under `tsx` with **no watch**, so **edits to `server/**` need a manual restart** (kill the listener on :4000, `npm run auth`) — in-memory seat holds reset with it. Vite HMR (src/) hot-reloads on its own.
- **Renaming a file's extension** (`.jsx`→`.tsx`) can white-screen Vite HMR. Fix: kill :3000, `rm -rf node_modules/.vite`, `npm start`.
- On Windows a running server **locks the generated Prisma client**, so `npm install` / `prisma generate` fail with EPERM. Kill :4000 first.
- Don't import `server/src/env.ts` from anything with a unit test: it **throws when `DATABASE_URL` is missing**, and the CI `checks` job has no database (that is why `static.ts` reads `process.env.NODE_ENV` directly).

## Architecture

Data flows: **React pages → TanStack Query hooks (`src/queries/*`) → `src/services/*` fetch helpers → Express gateway (:4000) → Prisma → Postgres**. Server state lives in **TanStack Query** (v5); the only global client state is `AuthContext`. `fetch` wrappers are thin and all sent with `credentials:"include"` so the session cookie reaches the gateway.

### Project structure & imports
`src/` is organized by type with lowercase folder names: `components/` (shared UI; `components/ui/` = the design-system primitives, `components/admin/` = admin-only widgets), `routes/` (route guards `PrivateRoute`/`AdminRoute`), `context/` (`AuthContext`), `hooks/` (`usePagination`), `lib/` (pure helpers — `pricing.ts`, `seatNav.ts`, `cx.ts`, `reviewStats.ts`), `queries/` (TanStack Query hooks + key registry), `services/` (`api.ts`/`auth.ts`), `types/` (`index.ts` domain models), `pages/` (one page + colocated `.css`; `pages/booking/` = the wizard, `pages/admin/` = the admin panel, `pages/dev/` = DEV-only), and `styles/` (`tokens.css` / `utilities.css` / `global.css`). `App.tsx` and `index.tsx` stay at `src/` root (Vite entry points).

**Absolute imports** are enabled via `tsconfig.json` paths (`baseUrl: "src"`) + a matching alias in `vite.config.mjs`. Import cross-module code from the `src`-root path — `import Navbar from "components/Navbar"`, `import { useAuth } from "context/AuthContext"`, `import { useMovies } from "queries/catalog"`, `import "styles/global.css"` — **not** relative `../../`. Same-folder siblings still use relative paths (`./Modal`, a page's own `./Home.css`). **When adding a new top-level `src/` folder, register it in BOTH `tsconfig.json` paths and `vite.config.mjs` resolve.alias.**

- **`server/prisma/schema.prisma`** — the data model, 9 models: `User`, `Movie` (has `rating`, a number ~6.8–9.0 shown as the star score everywhere — this is a **critic-style score**, kept separate from audience reviews), `City`, `Cinema` (→ `City`), `Room` (→ `Cinema`; `type` 2D/3D/IMAX + seat-layout `rows`/`cols`/`vipRows`, plus `coupleRows` and `aisleAfterCols`), `Showtime` (→ `Movie`, → `Room`; `price` = standard-seat price, `bookedSeats` = pre-sold seat numbers), `Booking`, `Concession` (F&B catalog), `Review` (audience rating). **There is no `seats` table** — seats are generated from the room layout and booked seats are derived (see Booking flow). Two deliberate fidelity decisions from the json-server era: `time`/`createdAt` are **`String`** (not `DateTime`) so serialization matches what the client always saw, and **`Booking` has no foreign keys** — it is a snapshot, so deleting a movie/room never cascades into someone's ticket. FK integrity exists only along the catalog chain City→Cinema→Room→Showtime→Movie. **`Review` is the exception that DOES take an FK** (→ `Movie`, `onDelete: Cascade`) — a review only means something while its movie exists — plus `@@unique([movieId, userId])` (one review per user per movie, `P2002`→409) and a `verified` flag stamped once at create-time (true if the caller has a booking for that movie → the "Đã xem" badge). `src/types/index.ts` mirrors all of these client-side.

- **`db.json`** — **no longer a database**, only the seed fixture read by `server/prisma/seed.ts` (wipes each table, reinserts **keeping ids**, then resets the Postgres sequences and asserts row counts match). Passwords in it are already bcrypt hashes.

- **`src/lib/pricing.ts`** — pure helpers: `buildSeatLayout(room)` (rows×cols → seat grid with `isVip`/`isCouple`; couple rows hold half the units + aisle handling), `bookedSeatSet(showtime, bookings)` (union of `showtime.bookedSeats` and matching bookings' seats), `vipPrice(base)` = `round(base×1.3)` and `couplePrice(base)` = `round(base×1.6)` to nearest 1,000, `priceOf(seat, base)`, `seatType(seat)`, F&B helpers `fnbLines`/`fnbTotal`, and constants `ROOM_TYPE_PRICE`, `SERVICE_FEE`, `MAX_SEATS` (8), `MAX_ITEM_QTY` (10). `src/lib/seatNav.ts` — `nextSeat(layout, current, dir)` powers the seat map's keyboard roving-tabindex. Both have colocated `*.test.ts`.

- **`src/services/api.ts`** — all movie/showtime/city/cinema/room/booking calls, hitting the gateway (`BASE_URL = :4000/api`) with `credentials:"include"`. `getShowtimesByCinema(cinemaId)` fetches the cinema's rooms then gathers showtimes per room. `getOccupiedSeats(showtimeId)` hits the gateway's computed `/api/occupied-seats` (only seat numbers, no personal data — merges booked seats **and** seats other users are actively holding) — the booking flow uses this instead of `getBookings()` for availability, because the gateway scopes `GET /bookings` to the caller. `holdSeats(showtimeId, seats)` / `releaseSeats(showtimeId)` drive the server-side seat hold. `create*/update*/delete*` helpers back admin CRUD (movies/rooms/showtimes + booking update/delete — **`cinemas` are read-only**). **Note:** `getAllShowtimes` fetches every showtime then filters client-side. There is **no** `getSeats`/`updateSeat`.

- **`src/queries/`** — the **TanStack Query** layer (v5). `keys.ts` is the single source of truth for cache keys (the `qk` registry). `catalog.ts` = read hooks (`useMovies`/`useCinemas`/`useCities`/`useAllShowtimes`/`useRooms`/`useMovie`/`useCinema`/`useShowtimesByMovie`/`useShowtimesByCinema`). `booking.ts` = `useOccupiedSeats(id,{poll})` (poll → `refetchInterval:10s`), `useConcessions`, `useMyBookings`, `useCreateBooking`. `reviews.ts` = `useMovieReviews(movieId)` + `useCreateReview`/`useUpdateReview`/`useDeleteReview` (each `invalidateQueries` the movie's reviews + `allReviews`). `admin.ts` = `useAllBookings` + `useAllReviews` + create/update/delete mutations for movie/room/showtime/booking, each `invalidateQueries` on success (so there is **no manual refetch**). The `QueryClientProvider` (staleTime 60s, retry 1, no refetch-on-focus) wraps the app inside `ErrorBoundary`, outside `AuthProvider`; `ReactQueryDevtools` mount in DEV only. Imperative seat hold/release stay as plain calls (side effects tied to selection + cleanup), not mutations.

- **`server/src/`** — the backend, one module per job. `index.ts` (listen) → `app.ts` (middleware + mount order) → `auth/*` · `api/*` · `db/prisma.ts` · `static.ts` · `env.ts`.
  - **`auth/routes.ts`** — `POST /auth/register|login|logout|refresh`, `GET /auth/me`. Passwords are **bcrypt-hashed**; sessions are **JWT access (15m) + refresh (7d)** in **httpOnly, SameSite=Lax cookies** (JS can't read them ⇒ XSS-safe), `secure` only in production. Login is rate-limited (`skipSuccessfulRequests` → only failed attempts count, 10/IP/15m). Emails are normalized (trim+lowercase). `remember` → persistent refresh cookie (Max-Age 7d) vs a session cookie. Legacy plaintext passwords self-upgrade to bcrypt on first successful login. `JWT_SECRET` has a dev fallback that **throws** under `NODE_ENV=production`. Supporting files: `tokens.ts` (sign/verify), `cookies.ts`, `middleware.ts` (`getUserFromReq`), `helpers.ts` (+ tests), `users.ts` (the only place that touches the `User` table).
  - **`api/gateway.ts`** — the catch-all `/api/*` authorization layer: **catalog** (`movies/showtimes/cinemas/cities/rooms/concessions`) is public read, admin-only write; **`users`** is admin-only; **`bookings`** GET is scoped to the caller (admin sees all), POST forces `userId` to the caller, PATCH/DELETE are admin-only; **`reviews`** GET is public (filter by `?movieId=`), POST needs login and stamps `userId`/`userName`/`verified`/`createdAt` server-side (validating rating 1–5 + comment ≤500 via `reviews-validate.ts`), PATCH/DELETE are **owner-or-admin** (`ownerOrAdmin`). It holds **no data logic** — every allowed request is handed to `handleRest`. Unlike the other branches, the reviews branch **imports the prisma singleton** (to compute `verified`, look up `fullName`, and check ownership) — that is fine because `gateway.ts` has no unit test.
  - **`api/repo.ts`** — `handleRest(req, res, rest, extraFilters?)` translates REST to Prisma while preserving the **exact HTTP contract the client was written against**: POST → **201**, DELETE → **`{}` + 200**, unknown id → **404**, lists ordered **`{ id: "asc" }`** (drop this and the movie order on Home scrambles), Prisma `P2025` → 404, `P2003`/`P2002` → 409. Bodies are filtered through a per-collection whitelist so `id` and stray fields can't be written.
  - **`api/collections.ts`** — pure metadata backing `repo.ts` (which fields are filterable and their type, which are writable, which are Json) plus `parseFilters`/`pickWritable`. **Imports nothing from Prisma on purpose** so its unit tests run in CI without a database.
  - **`api/occupied.ts`** — `GET /api/occupied-seats?showtimeId=` returns only seat numbers (no personal data): `showtime.bookedSeats` ∪ seats from that showtime's bookings ∪ seats **other** users are holding.
  - **`api/holds.ts`** — **the one piece of server state**: an in-memory `Map<showtimeId, Map<seat, {userId, expiresAt}>>`, 8-minute TTL (matches the client `SeatHoldTimer`), never persisted. `POST /api/holds {showtimeId, seats}` replaces + renews the caller's holds (also the heartbeat; **409** with `conflicts` if someone else holds a seat), `DELETE /api/holds?showtimeId=` releases, and a successful `POST /bookings` clears them. This is why the deployment must stay **single-instance**.
  - **`static.ts`** — production only: `express.static("build")` + an SPA fallback for every path that isn't `/api` or `/auth`. **Mounted last** in `app.ts`; mounting it earlier would make API calls silently return `index.html`.
  - **Mount order in `app.ts` is load-bearing**: `/auth` → `/api/occupied-seats` → `/api/holds` → `/api` (catch-all) → SPA. Express matches in order, and Express 5 rejects `app.all("/api/*")` (use `app.use`).

- **`src/services/auth.ts`** — client wrappers calling the auth server with `credentials:"include"` (cookies): `loginUser(email,password,remember)`, `registerUser(...)`, `logoutUser()`, `refreshSession()`, `fetchMe()` (retries once via `/auth/refresh` on a 401). No token is ever exposed to JS. Error messages are in Vietnamese.

- **`src/context/AuthContext.tsx`** — the only global client state. Wraps the app in `App.tsx`; **no localStorage** — on mount it hydrates the user via `fetchMe()` (cookie session) behind a `loading` gate (`AppShell` in `App.tsx` shows a splash until the check resolves). Exposes `useAuth()` → `{ user, loading, login, logout }`. Premium session UX: instant **cross-tab sync** via `BroadcastChannel("cinema-auth")`, **silent refresh** every 13m, and **idle auto-logout** after 30m. When a refresh fails the user is cleared → route guards redirect to `/login`.

- **`src/routes/PrivateRoute.jsx`** — gates routes; redirects to `/login` (preserving intended location in `state.from`) when `user` is null.

- **`src/routes/AdminRoute.jsx`** — role gate for `/admin`: redirects to `/login` if logged out, to `/` if `user.role !== "admin"`. Users carry a `role` field (`"user"` | `"admin"`); the seeded admin is `admin@cinema.vn` / `admin123`, a normal user is `a@cinema.vn` / `123456`.

### Deployment (Docker, single service)
`Dockerfile` is multi-stage: stage 1 (`node:22`) runs `npm ci` (whose `postinstall` does `prisma generate` — no database needed) then `npm run build`, producing `build/` + `server/dist/`; stage 2 (`node:22-slim`, `openssl` + `ca-certificates` for the Prisma engine and TLS to Postgres) installs prod deps only and copies the two build outputs. Start command: `prisma migrate deploy && node server/dist/index.js` — idempotent, so restarts are safe. `PORT` comes from the platform; `app.set("trust proxy", 1)` in production so the rate limiter sees real client IPs behind the proxy. `.env` is excluded via `.dockerignore` — secrets come from the platform's env vars (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NODE_ENV=production`).

The dev machine has no Docker, so the image is only ever built by **CI** (`docker` job) and the host. What *is* verifiable locally is prod-mode without Docker: `npm run build`, then `NODE_ENV=production PORT=4100 JWT_SECRET=… npm run start:prod` — one port serves both the SPA and `/api`.

### Design system — "Kinetic" (neo-brutalist cinematic)
The UI is a **custom design system in plain CSS — no UI library**. Design tokens (CSS variables: colors, type scale, spacing, radius/border, motion) live in **`src/styles/tokens.css`**; `utilities.css` holds a couple of helpers; `global.css` is the reset + `@import`s of the two. The look is **neo-brutalist "Kinetic"**: near-black ground, huge **Bebas Neue** display type, **Space Mono** labels, hard 1–2px borders (`--r-sm`/`--bw-*`), a decisive **red** accent (`--red`), and inverted **"bone" blocks** (`--surface-invert` cream + `--text-invert` black) for emphasis; motifs include `N°` numbering, perforated ticket edges, and marquees, all respecting `prefers-reduced-motion`. Fonts are self-hosted via `@fontsource` (Bebas Neue / Barlow / Barlow Condensed / Space Mono) — no CDN.

Reusable primitives live in **`src/components/ui/`** (barrel `index.ts`): `Button`, `Tag`, `Badge`, `Card`, `Rule`, `Field`, `Skeleton`, `Spinner`, `IconButton`, `Numbered`, `KineticHeading`, `Marquee`, `Reveal`, `TicketEdge`, `Modal`, `Container`, `Section`, `Grid`, `StarRating` (keyboard-navigable input + readonly display, red-accent stars) — shared styles in `ui.css`. Page-level kinetic classes are suffixed `-k` (e.g. `nav-k`, `hero-k`, `movie-k`, `adm-k__table`). A DEV-only route **`/kitchen-sink`** (`pages/dev/`, mounts only when `import.meta.env.DEV`) previews every primitive.

### Routing (`src/App.tsx`)
`/` Home · `/movies` Movies · `/movie/:id` MovieDetail · `/cinemas` Cinemas · `/cinema/:id` CinemaDetail · `/login` · `/register` · `/seats/:showtimeId` (protected) · `/tickets` (protected). Pages live in `src/pages/`, each with a colocated `.css` file. `BrowserRouter` opts into the React Router v7 future flags.

Admin routes are nested under `/admin` (wrapped in `AdminRoute` → `AdminLayout` with a sidebar + `<Outlet>`): index `AdminOverview` (stats + recharts revenue charts), `movies` `AdminMovies`, `rooms` `AdminRooms`, `showtimes` `AdminShowtimes`, `bookings` `AdminBookings`, `reviews` `AdminReviews` (moderation: list every review, search + star-filter, delete) — all in `src/pages/admin/` sharing `Admin.css`. Data + CRUD go through the `queries/admin.ts` mutation hooks (movies/rooms/showtimes + booking edit/cancel + review delete — **`cinemas` are read-only**). Shared `src/components/admin/Modal.jsx` (re-exports `ui/Modal`) + `ConfirmDialog.tsx` + `Pagination.tsx` back the tables/forms. Deleting a movie or room is **guarded client-side**: blocked (alert) while any showtime still references it. `AdminBookings` can **edit a booking's seats** (mini seat map) and **cancel** a booking (both admin-only via the gateway).

### Booking flow
Users reach a showtime two ways: from a movie (`MovieDetail`: city → cinema → date → showtime) or from a cinema (`Cinemas` → `CinemaDetail`). The `/seats/:showtimeId` route renders **`BookingWizard`** (in `src/pages/booking/`), a 4-step flow: ① seats → ② concessions (F&B) → ③ payment (demo methods) → ④ e-ticket (real QR, the reusable `components/ETicket`). It builds the seat grid from the room layout (`buildSeatLayout`), marks taken seats from `useOccupiedSeats`, and drives the **server-side seat hold**: it calls `holdSeats` whenever the selection changes (also a heartbeat across steps), **polls `getOccupiedSeats` every 10s** (via `refetchInterval`) in the seat step to reflect others' holds, handles the **409** conflict by dropping the clashing seats, and `releaseSeats` on leaving the page / hold expiry. The seat map is keyboard-navigable (roving tabindex, `lib/seatNav.ts`). A shared `SeatHoldTimer` (8 min) mirrors the server TTL. On confirm it re-checks availability then `POST`s **one** booking (`{ cinemaId, roomId, seats, seatTypes:{standard,vip,couple}, concessions, totalPrice, … }`) via `useCreateBooking` — no per-seat PATCH, so no partial-write problem. `MyTickets` reads the caller's bookings (`useMyBookings`, gateway-scoped), enriches each with movie/showtime/cinema/room, reuses `ETicket`, and splits into upcoming/past by showtime date.

## Testing

- **Vitest** unit tests colocated as `src/**/*.test.ts(x)` (pure helpers like `pricing`/`seatNav`, and UI primitives via Testing Library + happy-dom). Setup in `src/test/setup.ts`.
- **Playwright** in `e2e/` — three files with different rules. `smoke.spec.ts` (12 tests) is **read-only**: it logs in as the seeded admin and asserts core flows render (including the MovieDetail reviews section), and must never create data. `booking.spec.ts` (1 test) is the **full booking flow that really writes**: normal user → seat → F&B → payment → e-ticket → "Vé của tôi", then **deletes its own booking via the admin API in a `finally`**. `reviews.spec.ts` (1 test) **writes too**: normal user posts a review on a movie they haven't reviewed in the seed (movie 7, to avoid the `@@unique` 409), asserts it appears, deletes it via the UI, and a `finally` sweeps any leftover test review via the admin API — so both the CI database and the local Neon dev branch stay clean. The write tests pick the **last** cinema/showtime/seat (or a not-yet-reviewed movie) so they can't collide with the smoke test while Playwright runs them in parallel. The login placeholders `your@email.com` / `••••••••` and the button text **"Đăng nhập"** are load-bearing for all three — don't change them.

## Conventions

- User-facing copy is largely **Vietnamese**; match the surrounding language when editing a page.
- Prices are VND, formatted with `.toLocaleString("vi-VN")` and a `₫` suffix.
- Keep the six CI gates green; lint must have **0 warnings** (a warning fails CI). Handle a legitimate `react-hooks/exhaustive-deps` or `react-refresh` case with an annotated `// eslint-disable-next-line`, not by loosening rules.
- Query lists used inside a downstream `useMemo` should be stabilized: `const xQ = useHook(); const x = useMemo(() => xQ.data ?? [], [xQ.data])` (a bare `?? []` creates a new array each render and trips exhaustive-deps).
