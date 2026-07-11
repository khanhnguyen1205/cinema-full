# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React 18 cinema booking single-page app (student project, FER202 course) backed by a **json-server** mock REST API. There is no real backend — `db.json` is the entire "database" and json-server auto-generates CRUD endpoints from it.

## Commands

```bash
npm install                                      # install deps
npx json-server --watch db.json --port 9999      # start mock API (terminal 1)
npm start                                        # start React dev server on :3000 (terminal 2)
npm run build                                    # production build
```

There are **no tests, linter, or type checker** configured — `package.json` only defines `start` and `build`.

### Ports & running the app
json-server serves the mock API on **port 9999**; the React dev server runs on **port 3000** (CRA default) — open http://localhost:3000 to view the site. The API client (`src/Services/api.js`, `src/Services/auth.js`) hardcodes `BASE_URL = "http://localhost:9999"`; if you move json-server you must update `BASE_URL` in **both** service files. A `SessionStart` hook (`.claude/start-dev.ps1`, wired in `.claude/settings.local.json`) auto-starts both servers when a Claude Code session begins, so they are usually already running.

## Architecture

Data flows: **React pages → `src/Services/*` fetch helpers → json-server (`db.json`)**. There is no state management library and no API client abstraction beyond thin `fetch` wrappers.

- **`db.json`** — the data model: `users`, `movies`, `cities`, `cinemas` (each `cityId` → a city), `rooms` (each `cinemaId` → a cinema; has `type` 2D/3D/IMAX + seat-layout `rows`/`cols`/`vipRows`), `showtimes` (each `movieId` → a movie, `roomId` → a room; `price` = standard-seat price, `bookedSeats` = pre-sold seat numbers), `bookings`. **There is no `seats` collection** — seats are generated from the room layout and booked seats are derived (see Booking flow). Relationships are by foreign-key id and resolved client-side. json-server filtering uses query strings like `/cinemas?cityId=1`.

- **`src/lib/pricing.js`** — pure helpers: `buildSeatLayout(room)` (rows×cols → seat grid with `isVip`), `bookedSeatSet(showtime, bookings)` (union of `showtime.bookedSeats` and matching bookings' seats), `vipPrice(base)` = `round(base×1.3)` to nearest 1,000, `priceOf(seat, base)`, `ROOM_TYPE_PRICE`, `SERVICE_FEE`.

- **`src/Services/api.js`** — all movie/showtime/city/cinema/room/booking calls. `getShowtimesByCinema(cinemaId)` fetches the cinema's rooms then gathers showtimes per room. **Note:** `getAllShowtimes` fetches every showtime then filters client-side. There is **no** `getSeats`/`updateSeat` (removed with the seats table).

- **`src/Services/auth.js`** — "auth" is faked against json-server: login does `GET /users?email=…&password=…` and treats a non-empty result as success; register checks email uniqueness then POSTs. **Passwords are stored and queried in plaintext** — this is inherent to the mock-API design, not a bug to fix unless asked. User-facing error messages are in Vietnamese.

- **`src/Context/AuthContext.jsx`** — the only global state. Wraps the app in `App.jsx`, persists a password-stripped user to `localStorage` under key `cinema_user`, and exposes `useAuth()` → `{ user, login, logout }`.

- **`src/Components/PrivateRoute.jsx`** — gates routes; redirects to `/login` (preserving intended location in `state.from`) when `user` is null.

### Routing (`src/App.jsx`)
`/` Home · `/movies` Movies · `/movie/:id` MovieDetail · `/cinemas` Cinemas · `/cinema/:id` CinemaDetail · `/login` · `/register` · `/seats/:showtimeId` (protected) · `/tickets` (protected). Pages live in `src/Pages/`, each with a colocated `.css` file.

### Booking flow
Users reach a showtime two ways: from a movie (`MovieDetail`: city → cinema → date → showtime) or from a cinema (`Cinemas` → `CinemaDetail`). `SeatSelection` builds the seat grid from the room layout (`buildSeatLayout`), marks booked seats via `bookedSeatSet`, and on confirm `POST`s **one** booking (`{ cinemaId, roomId, seats, seatTypes:{standard,vip}, totalPrice, … }`) — no per-seat PATCH, so no partial-write problem. `MyTickets` reads all bookings, filters to `user.id` client-side, enriches each with movie/showtime/cinema/room, and splits into upcoming/past by showtime date.

## Conventions

- UI is a custom "cinematic dark" design system in plain CSS — no UI library. Global tokens (CSS variables like `--red`, `--text-muted`) live in `src/Styles/global.css`; fonts are Bebas Neue / Barlow / Barlow Condensed.
- User-facing copy is largely **Vietnamese**; match the surrounding language when editing a page.
- Prices are VND, formatted with `.toLocaleString("vi-VN")` and a `₫` suffix.
