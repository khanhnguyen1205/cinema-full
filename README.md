# 🎬 Cinema App

A full-stack cinema booking app with a cinematic dark UI built with React + json-server.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Start the mock API (json-server) — terminal 1
```bash
npx json-server --watch db.json --port 9999
```

### 3. Start the React app — terminal 2
```bash
npm start
```

Open **http://localhost:3000** to view the site. The React dev server runs on **port 3000** (CRA default) and the json-server mock API runs on **port 9999**.

> **Note:** The API base URL is hardcoded as `http://localhost:9999`. If you change the json-server port, update `BASE_URL` in **both** `src/Services/api.js` and `src/Services/auth.js` (and the inline `fetch` host in `src/Pages/MyTickets.jsx`).

## Pages

| Route | Page |
|-------|------|
| `/` | Home — featured movie hero + trending grid |
| `/movies` | Movies — full catalog with search, genre filter & sort |
| `/movie/:id` | Movie Detail — pick city → cinema → date → showtime |
| `/cinemas` | Cinemas — browse cinemas by city |
| `/cinema/:id` | Cinema Detail — movies & showtimes at one cinema |
| `/login` · `/register` | Authentication |
| `/seats/:showtimeId` | Seat Selection — seat map from room layout, VIP pricing *(requires login)* |
| `/tickets` | My Tickets — booked ticket cards with cinema/room *(requires login)* |
| `/admin` | Admin Panel — manage movies, rooms & showtimes (CRUD) + view bookings *(admin-only)* |

### Admin account

The admin panel at `/admin` is gated by user `role` (see `src/Components/AdminRoute.jsx`). Sign in with the seeded admin to access it:

| Email | Password |
|-------|----------|
| `admin@cinema.vn` | `admin123` |

## Data model

`db.json` collections: `users`, `movies`, `cities`, `cinemas` (→ city), `rooms` (→ cinema; has `type` 2D/3D/IMAX, `rows`, `cols`, `vipRows`), `showtimes` (→ movie + room; `price` = standard-seat price, `bookedSeats` = pre-sold seat numbers), `bookings`. **There is no `seats` collection** — the seat map is generated from the room's `rows×cols` layout and "booked" seats are derived from `showtime.bookedSeats` ∪ matching bookings. Standard price comes from room type (2D 75k · 3D 95k · IMAX 120k); VIP = `round(price×1.3)` to the nearest 1,000. Pricing/layout helpers live in `src/lib/pricing.js`.

## Tech Stack
- React 18 + React Router v6
- json-server (mock REST API)
- CSS (no UI library — custom cinematic design system)
- Google Fonts: Bebas Neue + Barlow
