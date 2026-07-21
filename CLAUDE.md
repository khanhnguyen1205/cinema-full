# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **React 18 + TypeScript** cinema booking single-page app (student project, FER202 course), built with **Vite 6**. App **data** is backed by a **json-server** mock REST API (`db.json` is the entire "database", CRUD auto-generated). **Auth is a real lightweight Express backend** (`server/auth-server.js`, port 4000): bcrypt-hashed passwords + JWT access/refresh tokens delivered as **httpOnly cookies** — not a mock. That same server is also an **authorization gateway** in front of json-server: the browser talks to `:4000/api/*`, which enforces per-collection/role rules and proxies to json-server. **json-server (:9999) is internal** — the client never calls it directly.

The codebase is **TypeScript-first**: source is `.ts`/`.tsx`. `allowJs` is on, so a few files remain `.jsx`/`.js` and interop untyped — currently `src/routes/PrivateRoute.jsx`, `src/routes/AdminRoute.jsx`, `src/components/admin/Modal.jsx` (a re-export shim), plus `server/*.js` (Node CommonJS).

## Commands

```bash
npm install            # install deps
npm run dev            # start all three servers at once (api + auth + web) via concurrently
# — or run them separately (start :9999 first):
npm run api            # json-server data API on :9999
npm run auth           # Express auth + gateway on :4000
npm start              # Vite dev server on :3000

npm run build          # production build (Vite → build/)
npm run preview        # serve the production build on :3000

# quality gates (also run in CI)
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint 9 (flat config); CI requires 0 warnings
npm run lint:fix
npm run format         # Prettier write
npm run format:check   # Prettier check (CI)
npm run test           # Vitest (watch)
npm run test:run       # Vitest once (CI)
npm run e2e            # Playwright smoke (chromium)

npm run hash-passwords # one-off: bcrypt-hash any plaintext passwords seeded in db.json
```

**Six CI gates** (`.github/workflows/ci.yml`) must stay green: `typecheck` · `lint` (0 warnings) · `format:check` · `test:run` (Vitest unit) · `e2e` (Playwright smoke) · `build`.

### Ports & running the app
Three servers: json-server on **:9999** (internal data store), Express **auth + gateway** on **:4000**, Vite dev server on **:3000** (open http://localhost:3000). Both client service files point at **:4000**: `src/services/api.ts` uses `BASE_URL = :4000/api` (data via gateway), `src/services/auth.ts` uses `AUTH_URL = :4000` (auth). URLs come from `.env` (`VITE_API_URL`, `VITE_AUTH_URL`) with sensible fallbacks; copy `.env.example` → `.env` to override. Only the auth/gateway server talks to json-server (`DATA_URL = :9999`), so **:9999 must be up before :4000**. A `SessionStart` hook (`.claude/start-dev.ps1`, wired in `.claude/settings.local.json`) auto-starts all three when a session begins, so they are usually already running.

**Gotchas:**
- The auth/gateway server runs under plain `node` (no nodemon), so **edits to `server/*.js` need a manual restart** (kill the listener on :4000, `npm run auth`) — its in-memory seat holds also reset. json-server `--watch` (db.json) and Vite HMR (src/) hot-reload on their own.
- **Renaming a file's extension** (`.jsx`→`.tsx`) can white-screen Vite HMR. Fix: kill :3000, `rm -rf node_modules/.vite`, `npm start`.

## Architecture

Data flows: **React pages → TanStack Query hooks (`src/queries/*`) → `src/services/*` fetch helpers → auth/gateway (:4000) → json-server (`db.json`)**. Server state lives in **TanStack Query** (v5); the only global client state is `AuthContext`. `fetch` wrappers are thin and all sent with `credentials:"include"` so the session cookie reaches the gateway.

### Project structure & imports
`src/` is organized by type with lowercase folder names: `components/` (shared UI; `components/ui/` = the design-system primitives, `components/admin/` = admin-only widgets), `routes/` (route guards `PrivateRoute`/`AdminRoute`), `context/` (`AuthContext`), `hooks/` (`usePagination`), `lib/` (pure helpers — `pricing.ts`, `seatNav.ts`, `cx.ts`), `queries/` (TanStack Query hooks + key registry), `services/` (`api.ts`/`auth.ts`), `types/` (`index.ts` domain models), `pages/` (one page + colocated `.css`; `pages/booking/` = the wizard, `pages/admin/` = the admin panel, `pages/dev/` = DEV-only), and `styles/` (`tokens.css` / `utilities.css` / `global.css`). `App.tsx` and `index.tsx` stay at `src/` root (Vite entry points).

**Absolute imports** are enabled via `tsconfig.json` paths (`baseUrl: "src"`) + a matching alias in `vite.config.mjs`. Import cross-module code from the `src`-root path — `import Navbar from "components/Navbar"`, `import { useAuth } from "context/AuthContext"`, `import { useMovies } from "queries/catalog"`, `import "styles/global.css"` — **not** relative `../../`. Same-folder siblings still use relative paths (`./Modal`, a page's own `./Home.css`). **When adding a new top-level `src/` folder, register it in BOTH `tsconfig.json` paths and `vite.config.mjs` resolve.alias.**

- **`db.json`** — the data model: `users`, `movies` (has `rating`, a number ~6.8–9.0 shown as the star score everywhere), `cities`, `cinemas` (each `cityId` → a city), `rooms` (each `cinemaId` → a cinema; has `type` 2D/3D/IMAX + seat-layout `rows`/`cols`/`vipRows`, plus optional `coupleRows` and `aisleAfterCols`), `showtimes` (each `movieId` → a movie, `roomId` → a room; `price` = standard-seat price, `bookedSeats` = pre-sold seat numbers), `bookings`, `concessions` (F&B catalog for the booking wizard). **There is no `seats` collection** — seats are generated from the room layout and booked seats are derived (see Booking flow). Relationships are by foreign-key id and resolved client-side. `src/types/index.ts` types all of these. json-server filtering uses query strings like `/cinemas?cityId=1`.

- **`src/lib/pricing.ts`** — pure helpers: `buildSeatLayout(room)` (rows×cols → seat grid with `isVip`/`isCouple`; couple rows hold half the units + aisle handling), `bookedSeatSet(showtime, bookings)` (union of `showtime.bookedSeats` and matching bookings' seats), `vipPrice(base)` = `round(base×1.3)` and `couplePrice(base)` = `round(base×1.6)` to nearest 1,000, `priceOf(seat, base)`, `seatType(seat)`, F&B helpers `fnbLines`/`fnbTotal`, and constants `ROOM_TYPE_PRICE`, `SERVICE_FEE`, `MAX_SEATS` (8), `MAX_ITEM_QTY` (10). `src/lib/seatNav.ts` — `nextSeat(layout, current, dir)` powers the seat map's keyboard roving-tabindex. Both have colocated `*.test.ts`.

- **`src/services/api.ts`** — all movie/showtime/city/cinema/room/booking calls, hitting the gateway (`BASE_URL = :4000/api`) with `credentials:"include"`. `getShowtimesByCinema(cinemaId)` fetches the cinema's rooms then gathers showtimes per room. `getOccupiedSeats(showtimeId)` hits the gateway's computed `/api/occupied-seats` (only seat numbers, no personal data — merges booked seats **and** seats other users are actively holding) — the booking flow uses this instead of `getBookings()` for availability, because the gateway scopes `GET /bookings` to the caller. `holdSeats(showtimeId, seats)` / `releaseSeats(showtimeId)` drive the server-side seat hold. `create*/update*/delete*` helpers back admin CRUD (movies/rooms/showtimes + booking update/delete — **`cinemas` are read-only**). **Note:** `getAllShowtimes` fetches every showtime then filters client-side. There is **no** `getSeats`/`updateSeat`.

- **`src/queries/`** — the **TanStack Query** layer (v5). `keys.ts` is the single source of truth for cache keys (the `qk` registry). `catalog.ts` = read hooks (`useMovies`/`useCinemas`/`useCities`/`useAllShowtimes`/`useRooms`/`useMovie`/`useCinema`/`useShowtimesByMovie`/`useShowtimesByCinema`). `booking.ts` = `useOccupiedSeats(id,{poll})` (poll → `refetchInterval:10s`), `useConcessions`, `useMyBookings`, `useCreateBooking`. `admin.ts` = `useAllBookings` + create/update/delete mutations for movie/room/showtime/booking, each `invalidateQueries` on success (so there is **no manual refetch**). The `QueryClientProvider` (staleTime 60s, retry 1, no refetch-on-focus) wraps the app inside `ErrorBoundary`, outside `AuthProvider`; `ReactQueryDevtools` mount in DEV only. Imperative seat hold/release stay as plain calls (side effects tied to selection + cleanup), not mutations.

- **`server/auth-server.js`** — Express auth backend (:4000). Endpoints: `POST /auth/register|login|logout|refresh`, `GET /auth/me`. Passwords are **bcrypt-hashed**; sessions are **JWT access (15m) + refresh (7d)** tokens stored in **httpOnly, SameSite=Lax cookies** (JS can't read them ⇒ XSS-safe). Login is rate-limited (`skipSuccessfulRequests` → only failed attempts count, 10/IP/15m). Emails are normalized (trim+lowercase). It stores users through json-server (`fetch` to :9999). `remember` flag → refresh cookie is persistent (Max-Age 7d) vs a session cookie. Legacy plaintext seed passwords self-upgrade to bcrypt on first successful login; `server/hash-passwords.js` migrates them proactively. Dev `JWT_SECRET` is a hardcoded fallback (throws in `NODE_ENV=production`).

  **Gateway** (same file, `/api/*` + `/api/occupied-seats` + `/api/holds`): reads the `at` cookie to learn the caller's role, then proxies to json-server with rules — **catalog** (`movies/showtimes/cinemas/cities/rooms/concessions`) is public read, admin-only write; **`users`** is admin-only (was leaking emails + hashes); **`bookings`** GET is scoped to the caller (admin sees all), POST forces `userId` to the caller, PATCH/DELETE are admin-only. `/api/occupied-seats?showtimeId=` returns just the taken seat numbers for the seat map. Gating is enforced here, not in json-server. **Routes for `/api/occupied-seats` and `/api/holds` must be declared before the catch-all `app.use("/api", …)`** (Express matches in order).

  **Seat holds — the gateway is stateful** (in-memory, lost on restart, never touches `db.json`): a `Map<showtimeId, Map<seat, {userId, expiresAt}>>` with an 8-minute TTL (matches the client `SeatHoldTimer`). `POST /api/holds {showtimeId, seats}` replaces + renews the caller's holds (also a heartbeat; returns **409** with `conflicts` if a seat is held by someone else), `DELETE /api/holds?showtimeId=` releases them, and a successful `POST /bookings` clears the caller's holds. `occupied-seats` folds in seats held by **other** users (excludes the caller's own), so a second person can't grab a seat you're mid-booking.

- **`src/services/auth.ts`** — client wrappers calling the auth server with `credentials:"include"` (cookies): `loginUser(email,password,remember)`, `registerUser(...)`, `logoutUser()`, `refreshSession()`, `fetchMe()` (retries once via `/auth/refresh` on a 401). No token is ever exposed to JS. Error messages are in Vietnamese.

- **`src/context/AuthContext.tsx`** — the only global client state. Wraps the app in `App.tsx`; **no localStorage** — on mount it hydrates the user via `fetchMe()` (cookie session) behind a `loading` gate (`AppShell` in `App.tsx` shows a splash until the check resolves). Exposes `useAuth()` → `{ user, loading, login, logout }`. Premium session UX: instant **cross-tab sync** via `BroadcastChannel("cinema-auth")`, **silent refresh** every 13m, and **idle auto-logout** after 30m. When a refresh fails the user is cleared → route guards redirect to `/login`.

- **`src/routes/PrivateRoute.jsx`** — gates routes; redirects to `/login` (preserving intended location in `state.from`) when `user` is null.

- **`src/routes/AdminRoute.jsx`** — role gate for `/admin`: redirects to `/login` if logged out, to `/` if `user.role !== "admin"`. Users carry a `role` field (`"user"` | `"admin"`) in `db.json`; the seeded admin is `admin@cinema.vn` / `admin123`.

### Design system — "Kinetic" (neo-brutalist cinematic)
The UI is a **custom design system in plain CSS — no UI library**. Design tokens (CSS variables: colors, type scale, spacing, radius/border, motion) live in **`src/styles/tokens.css`**; `utilities.css` holds a couple of helpers; `global.css` is the reset + `@import`s of the two. The look is **neo-brutalist "Kinetic"**: near-black ground, huge **Bebas Neue** display type, **Space Mono** labels, hard 1–2px borders (`--r-sm`/`--bw-*`), a decisive **red** accent (`--red`), and inverted **"bone" blocks** (`--surface-invert` cream + `--text-invert` black) for emphasis; motifs include `N°` numbering, perforated ticket edges, and marquees, all respecting `prefers-reduced-motion`. Fonts are self-hosted via `@fontsource` (Bebas Neue / Barlow / Barlow Condensed / Space Mono) — no CDN.

Reusable primitives live in **`src/components/ui/`** (barrel `index.ts`): `Button`, `Tag`, `Badge`, `Card`, `Rule`, `Field`, `Skeleton`, `Spinner`, `IconButton`, `Numbered`, `KineticHeading`, `Marquee`, `Reveal`, `TicketEdge`, `Modal`, `Container`, `Section`, `Grid` — shared styles in `ui.css`. Page-level kinetic classes are suffixed `-k` (e.g. `nav-k`, `hero-k`, `movie-k`, `adm-k__table`). A DEV-only route **`/kitchen-sink`** (`pages/dev/`, mounts only when `import.meta.env.DEV`) previews every primitive.

### Routing (`src/App.tsx`)
`/` Home · `/movies` Movies · `/movie/:id` MovieDetail · `/cinemas` Cinemas · `/cinema/:id` CinemaDetail · `/login` · `/register` · `/seats/:showtimeId` (protected) · `/tickets` (protected). Pages live in `src/pages/`, each with a colocated `.css` file. `BrowserRouter` opts into the React Router v7 future flags.

Admin routes are nested under `/admin` (wrapped in `AdminRoute` → `AdminLayout` with a sidebar + `<Outlet>`): index `AdminOverview` (stats + recharts revenue charts), `movies` `AdminMovies`, `rooms` `AdminRooms`, `showtimes` `AdminShowtimes`, `bookings` `AdminBookings` — all in `src/pages/admin/` sharing `Admin.css`. Data + CRUD go through the `queries/admin.ts` mutation hooks (movies/rooms/showtimes + booking edit/cancel — **`cinemas` are read-only**). Shared `src/components/admin/Modal.jsx` (re-exports `ui/Modal`) + `ConfirmDialog.tsx` + `Pagination.tsx` back the tables/forms. Deleting a movie or room is **guarded client-side**: blocked (alert) while any showtime still references it. `AdminBookings` can **edit a booking's seats** (mini seat map) and **cancel** a booking (both admin-only via the gateway).

### Booking flow
Users reach a showtime two ways: from a movie (`MovieDetail`: city → cinema → date → showtime) or from a cinema (`Cinemas` → `CinemaDetail`). The `/seats/:showtimeId` route renders **`BookingWizard`** (in `src/pages/booking/`), a 4-step flow: ① seats → ② concessions (F&B) → ③ payment (demo methods) → ④ e-ticket (real QR, the reusable `components/ETicket`). It builds the seat grid from the room layout (`buildSeatLayout`), marks taken seats from `useOccupiedSeats`, and drives the **server-side seat hold**: it calls `holdSeats` whenever the selection changes (also a heartbeat across steps), **polls `getOccupiedSeats` every 10s** (via `refetchInterval`) in the seat step to reflect others' holds, handles the **409** conflict by dropping the clashing seats, and `releaseSeats` on leaving the page / hold expiry. The seat map is keyboard-navigable (roving tabindex, `lib/seatNav.ts`). A shared `SeatHoldTimer` (8 min) mirrors the server TTL. On confirm it re-checks availability then `POST`s **one** booking (`{ cinemaId, roomId, seats, seatTypes:{standard,vip,couple}, concessions, totalPrice, … }`) via `useCreateBooking` — no per-seat PATCH, so no partial-write problem. `MyTickets` reads the caller's bookings (`useMyBookings`, gateway-scoped), enriches each with movie/showtime/cinema/room, reuses `ETicket`, and splits into upcoming/past by showtime date.

## Testing

- **Vitest** unit tests colocated as `src/**/*.test.ts(x)` (pure helpers like `pricing`/`seatNav`, and UI primitives via Testing Library + happy-dom). Setup in `src/test/setup.ts`.
- **Playwright** smoke tests in `e2e/*.spec.ts` — **read-only, must NOT write to `db.json`** (no test users/bookings created). They log in as the seeded admin and assert core flows render. The login placeholders `your@email.com` / `••••••••` and the button text **"Đăng nhập"** are load-bearing for these tests — don't change them.

## Conventions

- User-facing copy is largely **Vietnamese**; match the surrounding language when editing a page.
- Prices are VND, formatted with `.toLocaleString("vi-VN")` and a `₫` suffix.
- Keep the six CI gates green; lint must have **0 warnings** (a warning fails CI). Handle a legitimate `react-hooks/exhaustive-deps` or `react-refresh` case with an annotated `// eslint-disable-next-line`, not by loosening rules.
- Query lists used inside a downstream `useMemo` should be stabilized: `const xQ = useHook(); const x = useMemo(() => xQ.data ?? [], [xQ.data])` (a bare `?? []` creates a new array each render and trips exhaustive-deps).
