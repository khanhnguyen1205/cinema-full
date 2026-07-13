# Homepage Redesign — Design

Date: 2026-07-13
Status: Approved

## Goal
Restructure the cinema homepage (`src/pages/Home.jsx` + `Home.css`) to look
professional, using real posters and curated content. Keep the existing
"cinematic dark" design system. No backend / `db.json` changes.

## Current problems
- **Trending** dumps all 16 movies in one flat grid (no curation).
- **New Releases** uses emoji 🎬 placeholders, gradient-only tiles, and reuses
  the same movies shown in Trending (redundant, unfinished look).
- No genre browsing, cinema showcase, stats, or closing CTA.

## New section layout
1. **Hero — featured carousel**
   - Auto-advances through 5 featured movies (`movies.slice(0, 5)`) every ~6s;
     manual dots + prev/next arrows. Pauses on hover.
   - Left: tag "Phim nổi bật", ⭐ rating, `genre · duration`, title, description,
     "Đặt vé" + "Chi tiết" buttons.
   - Right: the active movie's real poster as a faded backdrop (evolves the
     existing `.hero-side-image` treatment; swaps per active slide).
2. **Đang chiếu (curated)**
   - Header + "Xem tất cả →" → `/movies`.
   - Grid of 8 movies (`movies.slice(0, 8)`) reusing the existing `.movie-card`.
3. **Duyệt theo thể loại**
   - Genre tiles derived from unique `movie.genre` values, each showing the movie
     count and a brand-color accent. Click → `/movies` pre-filtered to that genre
     via router `state: { genre }`.
4. **Hệ thống rạp + thống kê + CTA**
   - Stats strip: movies / cinemas / cities / showtimes counts (from data).
   - Cinema grid: 5 cinema cards (name + city) → `/cinema/:id`.
   - Closing CTA banner → `/movies`.

## Technical notes
- Rewrite `Home.jsx` and `Home.css`; keep `.movie-card*` styles (still used).
- Home data load also fetches `getCinemas()` + `getCities()` (already in api.js).
- `Movies.jsx`: initialize the genre filter from `useLocation().state?.genre`
  so homepage genre tiles land pre-filtered.
- Carousel state via `useState` + `useEffect` interval; cleared on unmount.

## Out of scope
- No new db collections, no "coming soon" flag (data doesn't distinguish it).
- No changes to booking flow, routes, or auth.
