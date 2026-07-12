# Admin Panel Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cancel/edit-seats to admin bookings, client-side pagination to all admin tables, and a revenue dashboard to the admin overview.

**Architecture:** Extend existing admin pages in `src/Pages/Admin/`. Reuse the seat model (`buildSeatLayout`, `bookedSeatSet`, `priceOf`, `SERVICE_FEE` from `src/lib/pricing.js`) for seat editing, the shared `Modal`/`ConfirmDialog` for dialogs, and add a reusable `usePagination` hook + `Pagination` component. Revenue charts use `recharts`.

**Tech Stack:** React 18, react-router, json-server mock API, plain CSS design system, recharts (new).

## Global Constraints

- **No test framework** in this project. Verify each task by: (a) `npm run build` compiles with no errors, and (b) manual UI check (dev servers auto-start; json-server on :9999, React on :3000). Do NOT add a test runner.
- **Copy is Vietnamese**, match surrounding admin pages.
- **Prices are VND**, formatted `value.toLocaleString("vi-VN")` + `₫` suffix.
- **IDs from json-server are numbers**; booking foreign keys (`movieId`, `showtimeId`, `cinemaId`, `roomId`) are numbers. `bookedSeatSet` matches on `b.showtimeId === showtime.id`.
- **Do NOT touch `showtime.bookedSeats`** on cancel/edit — sold seats are derived from `bookings`.
- Reuse existing CSS classes: `admin-btn` (+ `ghost`/`danger`/`small`), `admin-row-actions`, `admin-table`, `admin-toolbar`, `admin-empty`, `admin-head`, `admin-title`, `admin-stats`/`admin-stat`/`admin-stat-num`/`admin-stat-label`, `modal-actions`, `modal-error`, `field-row`.

---

### Task 1: Export booking mutation helpers

**Files:**
- Modify: `src/Services/api.js`

**Interfaces:**
- Produces: `updateBooking(id, patchBody) => Promise<booking>`, `deleteBooking(id) => Promise<Response>`

- [ ] **Step 1: Add exports**

After the existing `export const getBookings = ...` line (currently `src/Services/api.js:33`), and reusing the internal `patch`/`del` helpers defined at lines 37-38, add:

```js
export const updateBooking = (id, p) => patch(`/bookings/${id}`, p);
export const deleteBooking = (id) => del(`/bookings/${id}`);
```

Note: `patch`/`del` are declared with `const` lower in the file. Since these are module-level `const` arrow functions, place the two new exports **below** the `const del = ...` line (after line 38) to avoid temporal-dead-zone issues. Put them right after `export const deleteShowtime = ...` at the end of the file.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Compiles successfully, no "is not defined" errors.

- [ ] **Step 3: Commit**

```bash
git add src/Services/api.js
git commit -m "feat(api): export updateBooking and deleteBooking helpers"
```

---

### Task 2: Cancel booking in AdminBookings

**Files:**
- Modify: `src/Pages/Admin/AdminBookings.jsx`

**Interfaces:**
- Consumes: `deleteBooking` from Task 1.
- Produces: a `reload()`/state-update pattern that Task 3 also uses.

- [ ] **Step 1: Import deleteBooking and ConfirmDialog**

Change the import at `src/Pages/Admin/AdminBookings.jsx:2` to include `deleteBooking`, and add the ConfirmDialog import:

```js
import { getBookings, getMovies, getCinemas, getRooms, getAllShowtimes, deleteBooking } from "../../Services/api";
import ConfirmDialog from "../../Components/admin/ConfirmDialog";
```

- [ ] **Step 2: Add cancel state + handler**

Add a `cancelId` state next to the other `useState` calls:

```js
const [cancelId, setCancelId] = useState(null);
```

Add the delete handler (after the `visible` useMemo):

```js
const doCancel = async () => {
  await deleteBooking(cancelId);
  setBookings(prev => prev.filter(b => b.id !== cancelId));
  setCancelId(null);
};
```

- [ ] **Step 3: Add "Thao tác" column with Hủy button**

In the `<thead>` row, append a header cell after `<th>Suất</th>`:

```jsx
<th>Thao tác</th>
```

In the `<tbody>` map, append a cell after the `<td>{fmt(...)}</td>` suất cell:

```jsx
<td><div className="admin-row-actions">
  <button className="admin-btn danger small" onClick={() => setCancelId(b.id)}>Hủy</button>
</div></td>
```

Update the empty-row `colSpan` from `7` to `8`.

- [ ] **Step 4: Render the ConfirmDialog**

Before the closing `</div>` of the component's return, add:

```jsx
{cancelId && <ConfirmDialog message="Bạn chắc chắn muốn hủy đơn đặt vé này? Ghế sẽ được mở lại." onConfirm={doCancel} onCancel={() => setCancelId(null)} />}
```

- [ ] **Step 5: Verify**

Run: `npm run build` → compiles.
Manual: open `/admin/bookings`, click **Hủy** on a row → confirm dialog → confirm → row disappears; reopen the booking's showtime seat map → the freed seats are selectable again.

- [ ] **Step 6: Commit**

```bash
git add src/Pages/Admin/AdminBookings.jsx
git commit -m "feat(admin): cancel booking with confirm dialog"
```

---

### Task 3: Edit seats in AdminBookings

**Files:**
- Modify: `src/Pages/Admin/AdminBookings.jsx`
- Modify: `src/Pages/Admin/Admin.css`

**Interfaces:**
- Consumes: `updateBooking` (Task 1), `buildSeatLayout`, `bookedSeatSet`, `priceOf`, `SERVICE_FEE` from `src/lib/pricing.js`, `Modal`.

- [ ] **Step 1: Add imports**

Extend the api import to include `updateBooking`, and add the pricing + Modal imports:

```js
import { getBookings, getMovies, getCinemas, getRooms, getAllShowtimes, deleteBooking, updateBooking } from "../../Services/api";
import { buildSeatLayout, bookedSeatSet, priceOf, SERVICE_FEE } from "../../lib/pricing";
import Modal from "../../Components/admin/Modal";
```

- [ ] **Step 2: Add edit state**

Add near other state:

```js
const [editing, setEditing] = useState(null); // null | booking being edited
const [sel, setSel] = useState([]);           // array of seat objects {seatNumber,row,col,isVip}
```

- [ ] **Step 3: Add derived values + open/toggle/save handlers**

Add after `doCancel`:

```js
const editRoom = editing ? roomMap[editing.roomId] : null;
const editShowtime = editing ? showtimeMap[editing.showtimeId] : null;
const editLayout = buildSeatLayout(editRoom);
const editBase = editShowtime?.price || 0;

// Seats sold to OTHER bookings for this showtime (exclude the booking being edited)
const otherBooked = useMemo(() => {
  if (!editing || !editShowtime) return new Set();
  const others = bookings.filter(b => b.id !== editing.id);
  return bookedSeatSet({ ...editShowtime, id: editShowtime.id }, others);
}, [editing, editShowtime, bookings]);

const openEdit = (b) => {
  const room = roomMap[b.roomId];
  const layout = buildSeatLayout(room);
  const all = layout.flatMap(r => r.seats);
  const seatObjs = (b.seats || []).map(sn => all.find(s => s.seatNumber === sn)).filter(Boolean);
  setSel(seatObjs);
  setEditing(b);
};

const toggleSeat = (seat) => {
  if (otherBooked.has(seat.seatNumber)) return;
  setSel(prev => prev.find(s => s.seatNumber === seat.seatNumber)
    ? prev.filter(s => s.seatNumber !== seat.seatNumber)
    : [...prev, seat]);
};

const editStd = sel.filter(s => !s.isVip).length;
const editVip = sel.filter(s => s.isVip).length;
const editTotal = sel.reduce((sum, s) => sum + priceOf(s, editBase), 0) + (sel.length ? SERVICE_FEE : 0);

const saveSeats = async () => {
  const seats = sel.map(s => s.seatNumber);
  const patchBody = { seats, seatTypes: { standard: editStd, vip: editVip }, totalPrice: editTotal };
  const updated = await updateBooking(editing.id, patchBody);
  setBookings(prev => prev.map(b => b.id === editing.id ? { ...b, ...patchBody } : b));
  setEditing(null); setSel([]);
};
```

- [ ] **Step 4: Add "Sửa ghế" button**

In the actions `<td>` from Task 2, add before the Hủy button:

```jsx
<button className="admin-btn ghost small" onClick={() => openEdit(b)}>Sửa ghế</button>
```

- [ ] **Step 5: Render the edit modal**

Add near the ConfirmDialog render:

```jsx
{editing && (
  <Modal title={`Sửa ghế · #TK-${String(editing.id).padStart(5, "0")}`} onClose={() => { setEditing(null); setSel([]); }}>
    <div className="seat-grid-mini">
      {editLayout.map(({ row, seats }) => (
        <div key={row} className="sgm-row">
          <span className="sgm-label">{row}</span>
          {seats.map(seat => {
            const isBooked = otherBooked.has(seat.seatNumber);
            const isSel = sel.find(s => s.seatNumber === seat.seatNumber);
            return (
              <button key={seat.seatNumber}
                className={`sgm-seat${seat.isVip ? " vip" : ""}${isBooked ? " booked" : ""}${isSel ? " selected" : ""}`}
                disabled={isBooked} title={`${seat.seatNumber}${seat.isVip ? " · VIP" : ""}`}
                onClick={() => toggleSeat(seat)} />
            );
          })}
        </div>
      ))}
    </div>
    <div className="sgm-legend">
      <span><i className="sgm-dot available" />Trống</span>
      <span><i className="sgm-dot vip" />VIP</span>
      <span><i className="sgm-dot selected" />Đang chọn</span>
      <span><i className="sgm-dot booked" />Đã đặt</span>
    </div>
    <div className="sgm-summary">
      <span>Ghế: {sel.length ? sel.map(s => s.seatNumber).join(", ") : "Chưa chọn"}</span>
      <span>Thường ×{editStd} · VIP ×{editVip}</span>
      <strong>{editTotal.toLocaleString("vi-VN")}₫</strong>
    </div>
    <div className="modal-actions">
      <button className="admin-btn ghost" onClick={() => { setEditing(null); setSel([]); }}>Hủy</button>
      <button className="admin-btn" disabled={sel.length === 0} onClick={saveSeats}>Lưu</button>
    </div>
  </Modal>
)}
```

- [ ] **Step 6: Add mini seat-grid styles**

Append to `src/Pages/Admin/Admin.css`:

```css
/* --- Mini seat grid (edit booking) --- */
.seat-grid-mini { display: flex; flex-direction: column; gap: 6px; align-items: center; padding: 8px 0; overflow-x: auto; }
.sgm-row { display: flex; align-items: center; gap: 6px; }
.sgm-label { width: 16px; font-size: 11px; color: var(--text-muted); text-align: center; }
.sgm-seat { width: 22px; height: 22px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.06); cursor: pointer; padding: 0; }
.sgm-seat.vip { border-color: rgba(240,180,60,0.55); background: rgba(240,180,60,0.14); }
.sgm-seat.selected { background: var(--red); border-color: var(--red); }
.sgm-seat.booked { background: rgba(255,255,255,0.03); border-style: dashed; cursor: not-allowed; opacity: 0.5; }
.sgm-legend { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin: 10px 0; font-size: 12px; color: var(--text-muted); }
.sgm-legend span { display: inline-flex; align-items: center; gap: 6px; }
.sgm-dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.sgm-dot.available { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); }
.sgm-dot.vip { background: rgba(240,180,60,0.3); }
.sgm-dot.selected { background: var(--red); }
.sgm-dot.booked { background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.3); }
.sgm-summary { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-muted); padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.08); }
.sgm-summary strong { color: var(--text); font-size: 16px; }
```

- [ ] **Step 7: Verify**

Run: `npm run build` → compiles.
Manual: `/admin/bookings` → **Sửa ghế** on a row → the booking's current seats show as "Đang chọn"; seats booked by other orders are dashed/disabled; toggle seats → summary + total recompute (VIP rows priced higher, +15.000₫ service fee); **Lưu** → row's Ghế/Tổng update.

- [ ] **Step 8: Commit**

```bash
git add src/Pages/Admin/AdminBookings.jsx src/Pages/Admin/Admin.css
git commit -m "feat(admin): edit booking seats with mini seat grid"
```

---

### Task 4: Reusable pagination hook + component

**Files:**
- Create: `src/Components/admin/usePagination.js`
- Create: `src/Components/admin/Pagination.jsx`
- Modify: `src/Pages/Admin/Admin.css`

**Interfaces:**
- Produces:
  - `usePagination(items, pageSize=10) => { pageItems, page, totalPages, setPage, from, to, total }`
  - `<Pagination page totalPages onPage from to total />` (renders nothing when `totalPages <= 1`).

- [ ] **Step 1: Create the hook**

Create `src/Components/admin/usePagination.js`:

```js
import { useEffect, useMemo, useState } from "react";

export default function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Reset to a valid page when the list shrinks/grows (after search/delete)
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return { pageItems, page, totalPages, setPage, from, to, total };
}
```

- [ ] **Step 2: Create the component**

Create `src/Components/admin/Pagination.jsx`:

```jsx
export default function Pagination({ page, totalPages, onPage, from, to, total }) {
  if (totalPages <= 1) return null;
  return (
    <div className="admin-pagination">
      <span className="admin-pag-info">{from}–{to} / {total}</span>
      <div className="admin-pag-controls">
        <button className="admin-btn ghost small" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
        <span className="admin-pag-page">Trang {page}/{totalPages}</span>
        <button className="admin-btn ghost small" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>›</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add pagination styles**

Append to `src/Pages/Admin/Admin.css`:

```css
/* --- Pagination --- */
.admin-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
.admin-pag-info { font-size: 13px; color: var(--text-muted); }
.admin-pag-controls { display: flex; align-items: center; gap: 10px; }
.admin-pag-page { font-size: 13px; color: var(--text-muted); }
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Compiles (files exist, no unused-import errors — they're imported next task, so a standalone build here just confirms syntax; unused files don't break CRA build).

- [ ] **Step 5: Commit**

```bash
git add src/Components/admin/usePagination.js src/Components/admin/Pagination.jsx src/Pages/Admin/Admin.css
git commit -m "feat(admin): reusable usePagination hook and Pagination component"
```

---

### Task 5: Apply pagination to all admin tables

**Files:**
- Modify: `src/Pages/Admin/AdminMovies.jsx`
- Modify: `src/Pages/Admin/AdminRooms.jsx`
- Modify: `src/Pages/Admin/AdminShowtimes.jsx`
- Modify: `src/Pages/Admin/AdminBookings.jsx`

**Interfaces:**
- Consumes: `usePagination`, `Pagination` from Task 4. Each page already computes a filtered `visible` array.

- [ ] **Step 1: AdminMovies**

Add imports:

```js
import usePagination from "../../Components/admin/usePagination";
import Pagination from "../../Components/admin/Pagination";
```

After the `visible` useMemo, add:

```js
const { pageItems, page, totalPages, setPage, from, to, total } = usePagination(visible);
```

Change the table body map from `visible.map(m => ...)` to `pageItems.map(m => ...)`. Keep the empty-row check on `visible.length === 0`. Immediately after the `</table>`, add:

```jsx
<Pagination page={page} totalPages={totalPages} onPage={setPage} from={from} to={to} total={total} />
```

- [ ] **Step 2: AdminRooms**

Same as Step 1 for `src/Pages/Admin/AdminRooms.jsx`: add the two imports, add the `usePagination(visible)` line after that page's `visible` memo, render the page's rows from `pageItems` instead of `visible`, and add the `<Pagination .../>` after `</table>`. (AdminRooms uses the same `visible`/`admin-table` pattern.)

- [ ] **Step 3: AdminShowtimes**

Same for `src/Pages/Admin/AdminShowtimes.jsx`: two imports, `const { pageItems, page, totalPages, setPage, from, to, total } = usePagination(visible);` after the `visible` memo (line ~37), change `visible.map(s => ...)` to `pageItems.map(s => ...)`, add `<Pagination .../>` after `</table>`.

- [ ] **Step 4: AdminBookings**

Same for `src/Pages/Admin/AdminBookings.jsx`: two imports, `const { pageItems, page, totalPages, setPage, from, to, total } = usePagination(visible);` after the `visible` memo, change `visible.map(b => ...)` to `pageItems.map(b => ...)`, keep the `visible.length === 0` empty check, add `<Pagination .../>` after `</table>`.

- [ ] **Step 5: Verify**

Run: `npm run build` → compiles.
Manual: on each admin table, if there are >10 rows the pager shows "1–10 / N" and Trang 1/…; ‹ › navigate; typing in search resets to a valid page and the count updates. With ≤10 rows no pager renders.

- [ ] **Step 6: Commit**

```bash
git add src/Pages/Admin/AdminMovies.jsx src/Pages/Admin/AdminRooms.jsx src/Pages/Admin/AdminShowtimes.jsx src/Pages/Admin/AdminBookings.jsx
git commit -m "feat(admin): paginate movies, rooms, showtimes, bookings tables"
```

---

### Task 6: Install recharts

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run: `npm install recharts`
Expected: `recharts` appears in `package.json` dependencies; lockfile updated.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Compiles (recharts installed, no import yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts for admin revenue charts"
```

---

### Task 7: Revenue dashboard in AdminOverview

**Files:**
- Modify: `src/Pages/Admin/AdminOverview.jsx`
- Modify: `src/Pages/Admin/Admin.css`

**Interfaces:**
- Consumes: `recharts` (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `Cell`), existing `getMovies/getCinemas/getBookings` etc.

- [ ] **Step 1: Rewrite AdminOverview with revenue calc + charts**

Replace the contents of `src/Pages/Admin/AdminOverview.jsx` with:

```jsx
import { useEffect, useMemo, useState } from "react";
import { getMovies, getCinemas, getRooms, getAllShowtimes, getBookings } from "../../Services/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const RED = "#e63030"; // matches --red in src/Styles/global.css (SVG fills can't use CSS vars reliably)
const fmtVnd = (n) => `${(n || 0).toLocaleString("vi-VN")}₫`;

export default function AdminOverview() {
  const [movies, setMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    Promise.all([getMovies(), getCinemas(), getRooms(), getAllShowtimes(), getBookings()])
      .then(([m, c, r, st, b]) => { setMovies(m); setCinemas(c); setRooms(r); setShowtimes(st); setBookings(b); });
  }, []);

  const movieMap = useMemo(() => Object.fromEntries(movies.map(m => [m.id, m])), [movies]);
  const cinemaMap = useMemo(() => Object.fromEntries(cinemas.map(c => [c.id, c])), [cinemas]);

  const totalRevenue = useMemo(() => bookings.reduce((s, b) => s + (b.totalPrice || 0), 0), [bookings]);
  const totalTickets = useMemo(() => bookings.reduce((s, b) => s + (b.seats?.length || 0), 0), [bookings]);

  const revenueByMovie = useMemo(() => {
    const acc = {};
    bookings.forEach(b => { acc[b.movieId] = (acc[b.movieId] || 0) + (b.totalPrice || 0); });
    return Object.entries(acc)
      .map(([id, revenue]) => ({ name: movieMap[id]?.title || `#${id}`, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [bookings, movieMap]);

  const revenueByCinema = useMemo(() => {
    const acc = {};
    bookings.forEach(b => { acc[b.cinemaId] = (acc[b.cinemaId] || 0) + (b.totalPrice || 0); });
    return Object.entries(acc)
      .map(([id, revenue]) => ({ name: cinemaMap[id]?.name || `#${id}`, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [bookings, cinemaMap]);

  const tiles = [
    { n: movies.length, l: "Phim" }, { n: cinemas.length, l: "Rạp" }, { n: rooms.length, l: "Phòng" },
    { n: showtimes.length, l: "Suất chiếu" }, { n: bookings.length, l: "Đơn đặt vé" }
  ];

  return (
    <div>
      <div className="admin-head"><h1 className="admin-title">Tổng quan</h1></div>

      <div className="admin-stats">
        {tiles.map(t => <div key={t.l} className="admin-stat"><div className="admin-stat-num">{t.n}</div><div className="admin-stat-label">{t.l}</div></div>)}
      </div>

      <div className="admin-revenue-cards">
        <div className="admin-revenue-card">
          <div className="admin-revenue-label">Tổng doanh thu</div>
          <div className="admin-revenue-num">{fmtVnd(totalRevenue)}</div>
        </div>
        <div className="admin-revenue-card">
          <div className="admin-revenue-label">Tổng vé bán</div>
          <div className="admin-revenue-num">{totalTickets}</div>
        </div>
      </div>

      <div className="admin-charts">
        <div className="admin-chart-box">
          <h2 className="admin-chart-title">Doanh thu theo phim (Top 6)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueByMovie} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <XAxis dataKey="name" tick={{ fill: "#9aa0a6", fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "#9aa0a6", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toLocaleString("vi-VN")}k`} width={48} />
              <Tooltip formatter={(v) => fmtVnd(v)} cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} labelStyle={{ color: "#fff" }} />
              <Bar dataKey="revenue" fill={RED} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="admin-chart-box">
          <h2 className="admin-chart-title">Doanh thu theo rạp</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueByCinema} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <XAxis type="number" tick={{ fill: "#9aa0a6", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toLocaleString("vi-VN")}k`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#9aa0a6", fontSize: 11 }} width={110} />
              <Tooltip formatter={(v) => fmtVnd(v)} cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} labelStyle={{ color: "#fff" }} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {revenueByCinema.map((_, i) => <Cell key={i} fill={RED} fillOpacity={1 - i * 0.12} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add dashboard styles**

Append to `src/Pages/Admin/Admin.css`:

```css
/* --- Revenue dashboard --- */
.admin-revenue-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 20px; }
.admin-revenue-card { background: linear-gradient(135deg, rgba(225,29,42,0.12), rgba(225,29,42,0.03)); border: 1px solid rgba(225,29,42,0.25); border-radius: 12px; padding: 20px; }
.admin-revenue-label { font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
.admin-revenue-num { font-family: 'Bebas Neue', sans-serif; font-size: 34px; color: var(--text); margin-top: 6px; letter-spacing: 1px; }
.admin-charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px; margin-top: 24px; }
.admin-chart-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; }
.admin-chart-title { font-size: 15px; color: var(--text); margin-bottom: 12px; }
```

- [ ] **Step 3: Verify**

Run: `npm run build` → compiles.
Manual: open `/admin` → Tổng doanh thu = Σ totalPrice of all bookings, Tổng vé bán = Σ seats; two bar charts render with Vietnamese labels; hovering a bar shows a VND-formatted tooltip.

- [ ] **Step 4: Commit**

```bash
git add src/Pages/Admin/AdminOverview.jsx src/Pages/Admin/Admin.css
git commit -m "feat(admin): revenue dashboard with recharts bar charts"
```

---

## Self-Review Notes

- **Spec coverage:** Part 1 → Tasks 1-3; Part 2 → Tasks 4-5; Part 3 → Tasks 6-7. All spec sections covered.
- **Type consistency:** `usePagination` returns `{ pageItems, page, totalPages, setPage, from, to, total }` — used verbatim in Task 5 and `Pagination` props. `updateBooking(id, patch)` / `deleteBooking(id)` signatures from Task 1 match calls in Tasks 2-3. Seat objects `{ seatNumber, row, col, isVip }` from `buildSeatLayout` match `priceOf`/`bookedSeatSet` usage.
- **No placeholders:** every code step has complete code.
- **RED color:** recharts renders SVG where CSS `var(--red)` may not resolve reliably in `fill`, so a literal `#e63030` constant is used for chart fills — verified to match `--red` in `src/Styles/global.css:8`.
