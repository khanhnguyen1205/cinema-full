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
json-server serves the mock API on **port 9999**; the React dev server runs on **port 3000** (CRA default) — open http://localhost:3000 to view the site. The API client (`src/Services/api.js`, `src/Services/auth.js`) hardcodes `BASE_URL = "http://localhost:9999"`; if you move json-server you must update `BASE_URL` in **both** service files **and** the inline `fetch` host in `src/Pages/MyTickets.jsx`. A `SessionStart` hook (`.claude/start-dev.ps1`, wired in `.claude/settings.local.json`) auto-starts both servers when a Claude Code session begins, so they are usually already running.

## Architecture

Data flows: **React pages → `src/Services/*` fetch helpers → json-server (`db.json`)**. There is no state management library and no API client abstraction beyond thin `fetch` wrappers.

- **`db.json`** — the data model: `users`, `movies`, `showtimes` (each `movieId` → a movie), `seats` (each `showtimeId` → a showtime, with `isBooked` flag), `bookings`. Relationships are by foreign-key id and resolved client-side (e.g. a page fetches a showtime, then fetches its `movieId`). json-server filtering uses query strings like `/seats?showtimeId=1`.

- **`src/Services/api.js`** — all movie/showtime/seat/booking calls. **Note:** `getAllShowtimes` fetches every showtime then filters client-side, and some pages bypass the helpers and `fetch` the showtimes URL inline (e.g. `MyTickets.jsx`). Prefer consolidating on the helpers when editing.

- **`src/Services/auth.js`** — "auth" is faked against json-server: login does `GET /users?email=…&password=…` and treats a non-empty result as success; register checks email uniqueness then POSTs. **Passwords are stored and queried in plaintext** — this is inherent to the mock-API design, not a bug to fix unless asked. User-facing error messages are in Vietnamese.

- **`src/Context/AuthContext.jsx`** — the only global state. Wraps the app in `App.jsx`, persists a password-stripped user to `localStorage` under key `cinema_user`, and exposes `useAuth()` → `{ user, login, logout }`.

- **`src/Components/PrivateRoute.jsx`** — gates routes; redirects to `/login` (preserving intended location in `state.from`) when `user` is null.

### Routing (`src/App.jsx`)
`/` Home · `/movie/:id` MovieDetail · `/login` · `/register` · `/seats/:showtimeId` (protected) · `/tickets` (protected). Pages live in `src/Pages/`, each with a colocated `.css` file.

### Booking flow
`SeatSelection` is the core transaction: on confirm it `POST`s a booking, then issues **one `PATCH /seats/:id` per selected seat** to mark `isBooked: true` (no transaction/rollback — if a PATCH fails midway the booking already exists). `MyTickets` reads all bookings and filters to `user.id` client-side, enriching each with its movie + showtime and splitting into upcoming/past by showtime date.

## Conventions

- UI is a custom "cinematic dark" design system in plain CSS — no UI library. Global tokens (CSS variables like `--red`, `--text-muted`) live in `src/Styles/global.css`; fonts are Bebas Neue / Barlow / Barlow Condensed.
- User-facing copy is largely **Vietnamese**; match the surrounding language when editing a page.
- Prices are VND, formatted with `.toLocaleString("vi-VN")` and a `₫` suffix.
