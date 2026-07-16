# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React 18 cinema booking single-page app (student project, FER202 course). App **data** is backed by a **json-server** mock REST API (`db.json` is the entire "database", CRUD auto-generated). **Auth is a real lightweight Express backend** (`server/auth-server.js`, port 4000): bcrypt-hashed passwords + JWT access/refresh tokens delivered as **httpOnly cookies** — not a mock. That same server is also an **authorization gateway** in front of json-server: the browser talks to `:4000/api/*`, which enforces per-collection/role rules and proxies to json-server. **json-server (:9999) is internal** — the client never calls it directly.

## Commands

```bash
npm install                                      # install deps
npm run dev                                      # start all three servers at once (api + auth + web)
# — or run them separately:
npm run api                                      # json-server data API on :9999
npm run auth                                     # Express auth server on :4000
npm start                                        # React dev server on :3000
npm run hash-passwords                           # one-off: bcrypt-hash any plaintext passwords in db.json
npm run build                                    # production build
```

There are **no tests, linter, or type checker** configured — `package.json` only defines `start` and `build`.

### Ports & running the app
Three servers: json-server on **:9999** (internal data store), Express **auth + gateway** on **:4000**, React dev server on **:3000** (open http://localhost:3000). Both client service files point at **:4000**: `src/services/api.js` hardcodes `BASE_URL = "http://localhost:4000/api"` (data via gateway), `src/services/auth.js` hardcodes `AUTH_URL = "http://localhost:4000"` (auth). Only the auth/gateway server talks to json-server (`DATA_URL = :9999`), so **:9999 must be up before :4000**. A `SessionStart` hook (`.claude/start-dev.ps1`, wired in `.claude/settings.local.json`) auto-starts all three when a session begins, so they are usually already running.

## Architecture

Data flows: **React pages → `src/services/*` fetch helpers → auth/gateway (:4000) → json-server (`db.json`)**. There is no state management library and no API client abstraction beyond thin `fetch` wrappers (all sent with `credentials:"include"` so the session cookie reaches the gateway).

### Project structure & imports
`src/` is organized by type with lowercase folder names: `components/` (shared UI; `components/admin/` for admin-only widgets), `routes/` (route guards `PrivateRoute`/`AdminRoute`), `context/` (`AuthContext`), `hooks/` (`usePagination`), `lib/` (pure helpers like `pricing.js`), `services/` (`api.js`/`auth.js`), `pages/` (one folder-less page + colocated `.css`; `pages/admin/` for the admin panel), and `styles/` (`global.css`). `App.jsx` and `index.jsx` stay at `src/` root (CRA entry points).

**Absolute imports** are enabled via `jsconfig.json` (`baseUrl: "src"`). Import cross-module code from the `src`-root path — `import Navbar from "components/Navbar"`, `import { useAuth } from "context/AuthContext"`, `import usePagination from "hooks/usePagination"`, `import "styles/global.css"` — **not** relative `../../`. Same-folder siblings still use relative paths (`./Modal`, a page's own `./Home.css`).

- **`db.json`** — the data model: `users`, `movies`, `cities`, `cinemas` (each `cityId` → a city), `rooms` (each `cinemaId` → a cinema; has `type` 2D/3D/IMAX + seat-layout `rows`/`cols`/`vipRows`), `showtimes` (each `movieId` → a movie, `roomId` → a room; `price` = standard-seat price, `bookedSeats` = pre-sold seat numbers), `bookings`. **There is no `seats` collection** — seats are generated from the room layout and booked seats are derived (see Booking flow). Relationships are by foreign-key id and resolved client-side. json-server filtering uses query strings like `/cinemas?cityId=1`.

- **`src/lib/pricing.js`** — pure helpers: `buildSeatLayout(room)` (rows×cols → seat grid with `isVip`), `bookedSeatSet(showtime, bookings)` (union of `showtime.bookedSeats` and matching bookings' seats), `vipPrice(base)` = `round(base×1.3)` to nearest 1,000, `priceOf(seat, base)`, `ROOM_TYPE_PRICE`, `SERVICE_FEE`.

- **`src/services/api.js`** — all movie/showtime/city/cinema/room/booking calls, now hitting the gateway (`BASE_URL = :4000/api`) with `credentials:"include"`. `getShowtimesByCinema(cinemaId)` fetches the cinema's rooms then gathers showtimes per room. `getOccupiedSeats(showtimeId)` hits the gateway's computed `/api/occupied-seats` (only seat numbers, no personal data) — the booking flow uses this instead of `getBookings()` for availability, because the gateway scopes `GET /bookings` to the caller's own bookings. **Note:** `getAllShowtimes` fetches every showtime then filters client-side. There is **no** `getSeats`/`updateSeat` (removed with the seats table).

- **`server/auth-server.js`** — Express auth backend (:4000). Endpoints: `POST /auth/register|login|logout|refresh`, `GET /auth/me`. Passwords are **bcrypt-hashed**; sessions are **JWT access (15m) + refresh (7d)** tokens stored in **httpOnly, SameSite=Lax cookies** (JS can't read them ⇒ XSS-safe). Login is rate-limited. Emails are normalized (trim+lowercase). It stores users through json-server (`fetch` to :9999). `remember` flag → refresh cookie is persistent (Max-Age 7d) vs a session cookie. Legacy plaintext seed passwords self-upgrade to bcrypt on first successful login; `server/hash-passwords.js` migrates them proactively. Dev `JWT_SECRET` is a hardcoded constant (fine for this project).

  **Gateway** (same file, `/api/*` + `/api/occupied-seats`): reads the `at` cookie to learn the caller's role, then proxies to json-server with rules — **catalog** (`movies/showtimes/cinemas/cities/rooms/concessions`) is public read, admin-only write; **`users`** is admin-only (was leaking emails + hashes); **`bookings`** GET is scoped to the caller (admin sees all), POST forces `userId` to the caller, PATCH/DELETE are admin-only. `/api/occupied-seats?showtimeId=` returns just the taken seat numbers for the seat map. Gating is enforced here, not in json-server.

- **`src/services/auth.js`** — client wrappers calling the auth server with `credentials:"include"` (cookies): `loginUser(email,password,remember)`, `registerUser(...)`, `logoutUser()`, `refreshSession()`, `fetchMe()` (retries once via `/auth/refresh` on a 401). No token is ever exposed to JS. Error messages are in Vietnamese.

- **`src/context/AuthContext.jsx`** — the only global state. Wraps the app in `App.jsx`; **no localStorage** — on mount it hydrates the user via `fetchMe()` (cookie session) behind a `loading` gate (`AppShell` in `App.jsx` shows a splash until the check resolves). Exposes `useAuth()` → `{ user, loading, login, logout }`. Premium session UX: instant **cross-tab sync** via `BroadcastChannel("cinema-auth")`, **silent refresh** every 13m, and **idle auto-logout** after 30m. When a refresh fails the user is cleared → route guards redirect to `/login`.

- **`src/routes/PrivateRoute.jsx`** — gates routes; redirects to `/login` (preserving intended location in `state.from`) when `user` is null.

- **`src/routes/AdminRoute.jsx`** — role gate for `/admin`: redirects to `/login` if logged out, to `/` if `user.role !== "admin"`. Users carry a `role` field (`"user"` | `"admin"`) in `db.json`; the seeded admin is `admin@cinema.vn` / `admin123`.

### Routing (`src/App.jsx`)
`/` Home · `/movies` Movies · `/movie/:id` MovieDetail · `/cinemas` Cinemas · `/cinema/:id` CinemaDetail · `/login` · `/register` · `/seats/:showtimeId` (protected) · `/tickets` (protected). Pages live in `src/pages/`, each with a colocated `.css` file.

Admin routes are nested under `/admin` (wrapped in `AdminRoute` → `AdminLayout` with a sidebar + `<Outlet>`): index `AdminOverview`, `movies` `AdminMovies`, `rooms` `AdminRooms`, `showtimes` `AdminShowtimes`, `bookings` `AdminBookings` — all in `src/pages/admin/` sharing `Admin.css`. CRUD goes through `create*/update*/delete*` helpers in `api.js` (movies/rooms/showtimes only — **`cinemas` are read-only**, no CRUD helpers). Shared `src/components/admin/Modal.jsx` + `ConfirmDialog.jsx` back the edit forms. Deleting a movie or room is **guarded client-side**: blocked (alert) while any showtime still references it; `AdminBookings` is read-only.

### Booking flow
Users reach a showtime two ways: from a movie (`MovieDetail`: city → cinema → date → showtime) or from a cinema (`Cinemas` → `CinemaDetail`). `SeatSelection` builds the seat grid from the room layout (`buildSeatLayout`), marks booked seats via `bookedSeatSet`, and on confirm `POST`s **one** booking (`{ cinemaId, roomId, seats, seatTypes:{standard,vip}, totalPrice, … }`) — no per-seat PATCH, so no partial-write problem. `MyTickets` reads all bookings, filters to `user.id` client-side, enriches each with movie/showtime/cinema/room, and splits into upcoming/past by showtime date.

## Conventions

- UI is a custom "cinematic dark" design system in plain CSS — no UI library. Global tokens (CSS variables like `--red`, `--text-muted`) live in `src/styles/global.css`; fonts are Bebas Neue / Barlow / Barlow Condensed.
- User-facing copy is largely **Vietnamese**; match the surrounding language when editing a page.
- Prices are VND, formatted with `.toLocaleString("vi-VN")` and a `₫` suffix.
