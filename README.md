# 🎬 Cinema App

A **React 18 + TypeScript** cinema booking single-page app (FER202 student project), built with **Vite** and a custom neo-brutalist "Kinetic" dark UI. Movie/showtime **data** is served by a **json-server** mock REST API, but **auth is a real lightweight Express backend** (bcrypt-hashed passwords + JWT in httpOnly cookies) that also acts as an **authorization gateway** in front of json-server. Server state is managed with **TanStack Query**.

## Architecture — three servers

| Server | Port | Role |
|--------|------|------|
| json-server | **9999** | Mock data store (`db.json`) — **internal**, only the gateway talks to it |
| Express auth + gateway | **4000** | Real auth (bcrypt + JWT httpOnly cookies) **and** the authorization gateway (`/api/*`) in front of json-server |
| React dev server (Vite) | **3000** | The web app you open in the browser |

The browser only ever calls **:4000** — `src/services/api.ts` uses `BASE_URL = http://localhost:4000/api` (data via gateway) and `src/services/auth.ts` uses `AUTH_URL = http://localhost:4000` (auth). Every request is sent with `credentials:"include"` so the session cookie reaches the gateway. Because the gateway reads/writes `users` through json-server, **:9999 must be up before :4000**.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Start everything — one command
```bash
npm run dev        # starts json-server (:9999) + auth (:4000) + React (:3000) via concurrently
```

Or run them in separate terminals:
```bash
npm run api        # json-server data API on :9999   (start this first)
npm run auth       # Express auth + gateway on :4000
npm start          # Vite dev server on :3000
```

Open **http://localhost:3000**. `npm run build` outputs to `build/`; `npm run preview` serves that build on :3000.

> The auth/gateway server runs under plain `node` (no auto-reload). After editing `server/*.js`, restart `npm run auth`. `db.json` (json-server `--watch`) and `src/` (Vite HMR) hot-reload automatically. Client URLs come from `.env` (`VITE_API_URL`, `VITE_AUTH_URL`) — copy `.env.example` to `.env` to override.

### Other scripts
```bash
npm run build            # production build (→ build/)
npm run preview          # serve the production build on :3000
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint 9 (flat config)
npm run format           # Prettier write   ·   npm run format:check
npm run test             # Vitest (watch)   ·   npm run test:run (once)
npm run e2e              # Playwright smoke tests (chromium)
npm run hash-passwords   # one-off: bcrypt-hash any plaintext passwords seeded in db.json
```

**CI** (GitHub Actions) runs six gates on every push: `typecheck` · `lint` (0 warnings) · `format:check` · `test:run` · `e2e` · `build`.

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

Passwords are stored bcrypt-hashed in `db.json`; the admin gate lives in `src/routes/AdminRoute.jsx` (role-based).

## Booking flow & seat holds

The booking wizard drives a **real server-side seat hold** so two people can't book the same seat: selecting seats calls the gateway's in-memory hold (8-minute TTL, matching the on-screen timer), the seat map polls every ~10s to reflect seats others are holding, a conflict returns HTTP 409, and holds are released on booking / leaving the page / expiry. Holds live in the gateway's memory only (reset on restart) and never touch `db.json`.

## Data model

`db.json` collections: `users`, `movies` (with `rating`), `cities`, `cinemas` (→ city), `rooms` (→ cinema; `type` 2D/3D/IMAX, `rows`, `cols`, `vipRows`, optional `coupleRows`/`aisleAfterCols`), `showtimes` (→ movie + room; `price` = standard-seat price, `bookedSeats` = pre-sold seat numbers), `bookings`, `concessions` (F&B catalog). **There is no `seats` collection** — the seat map is generated from the room's `rows×cols` layout and "booked" seats are derived from `showtime.bookedSeats` ∪ matching bookings ∪ active holds. Standard price comes from room type (2D 75k · 3D 95k · IMAX 120k); VIP = `round(price×1.3)`, couple = `round(price×1.6)`, to the nearest 1,000. Pricing/layout helpers live in `src/lib/pricing.ts`.

## Project structure

`src/` is organized by type (lowercase folders): `components/` (+ `components/ui/` design-system primitives, `components/admin/`), `routes/` (`PrivateRoute`/`AdminRoute`), `context/` (`AuthContext`), `hooks/`, `lib/` (`pricing.ts`, `seatNav.ts`), `queries/` (TanStack Query hooks + key registry), `services/` (`api.ts`/`auth.ts`), `types/` (domain models), `pages/` (+ `pages/booking/` wizard, `pages/admin/` panel, `pages/dev/` DEV-only), `styles/` (`tokens.css`/`utilities.css`/`global.css`). Absolute imports are enabled via `tsconfig.json` paths (`baseUrl: "src"`) + a matching Vite alias, e.g. `import Navbar from "components/Navbar"`.

## Design system — "Kinetic"
A custom neo-brutalist CSS design system (no UI library). Tokens (colors, type scale, spacing, borders, motion) live in `src/styles/tokens.css`; the look is near-black + huge **Bebas Neue** display type, **Space Mono** labels, hard borders, a decisive **red** accent, and inverted **"bone"** blocks for emphasis (`N°` numbering, ticket edges, marquees; `prefers-reduced-motion` respected). Reusable primitives are in `src/components/ui/`; a DEV-only `/kitchen-sink` route previews them. Fonts are self-hosted via `@fontsource` (Bebas Neue / Barlow / Barlow Condensed / Space Mono).

## Testing
- **Vitest** unit tests colocated as `src/**/*.test.ts(x)` (pure helpers + UI primitives via Testing Library + happy-dom).
- **Playwright** smoke tests in `e2e/` — **read-only** (they never write to `db.json`); they log in as the seeded admin and assert core flows render.

## Tech stack
- React 18 + **TypeScript 5** + React Router v6, built with **Vite 6**
- **TanStack Query v5** (server state) · Express 5 (auth + gateway) · json-server (mock data API)
- bcryptjs + jsonwebtoken (bcrypt hashes + JWT httpOnly cookies)
- `qrcode.react` (e-tickets) · `recharts` (admin charts)
- **Vitest** + Testing Library (unit) · **Playwright** (e2e) · ESLint 9 + Prettier · GitHub Actions CI
- Custom "Kinetic" CSS design system (no UI library) — fonts: Bebas Neue / Barlow / Barlow Condensed / Space Mono
- User-facing copy is largely **Vietnamese**
