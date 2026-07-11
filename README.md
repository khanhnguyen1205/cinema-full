# 🎬 Cinema App

A full-stack cinema booking app with a cinematic dark UI built with React + json-server.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Start the mock API (json-server)
```bash
npx json-server --watch db.json --port 3000
```

### 3. Start the React app (in a new terminal)
```bash
npm start
```

App runs at **http://localhost:3000** (React) and API at **http://localhost:3000** (json-server).

> **Note:** Both use port 3000 by default. To avoid conflicts, run React on a different port:
> ```bash
> PORT=3001 npm start
> ```
> Then update `BASE_URL` in `src/Services/api.js` to `http://localhost:3000`.

## Pages

| Route | Page |
|-------|------|
| `/` | Home — featured movie hero + trending grid |
| `/movie/:id` | Movie Detail — showtimes panel + date/time picker |
| `/seats/:showtimeId` | Seat Selection — interactive seat map + booking panel |
| `/tickets` | My Tickets — booked ticket cards + QR codes |

## Tech Stack
- React 18 + React Router v6
- json-server (mock REST API)
- CSS (no UI library — custom cinematic design system)
- Google Fonts: Bebas Neue + Barlow
