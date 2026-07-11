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
| `/movies` | Movies — full catalog with search & genre filter |
| `/movie/:id` | Movie Detail — showtimes panel + date/time picker |
| `/login` · `/register` | Authentication |
| `/seats/:showtimeId` | Seat Selection — interactive seat map + booking panel *(requires login)* |
| `/tickets` | My Tickets — booked ticket cards *(requires login)* |

## Tech Stack
- React 18 + React Router v6
- json-server (mock REST API)
- CSS (no UI library — custom cinematic design system)
- Google Fonts: Bebas Neue + Barlow
