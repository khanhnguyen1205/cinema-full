# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Trang `/admin` cho admin quản lý Phim/Phòng/Suất chiếu (CRUD) và xem Đơn đặt vé, có phân quyền role, form modal, bảng tìm kiếm/lọc.

**Architecture:** Thêm `role` vào users + `AdminRoute` chặn non-admin. Nested routes dưới `/admin` với `AdminLayout` (sidebar + Outlet). CRUD qua json-server POST/PATCH/DELETE (helpers mới trong api.js). Rạp read-only. Chặn xóa Phim/Phòng còn suất chiếu.

**Tech Stack:** React 18, React Router v6, json-server (:9999), CSS thuần. Verify bằng `CI=true npm run build` + node data-check (không có test runner).

## Global Constraints
- API base `http://localhost:9999`. Copy tiếng Việt. Giá VND `.toLocaleString("vi-VN")+₫`.
- Giá gợi ý theo loại phòng: `ROOM_TYPE_PRICE` trong `src/lib/pricing.js` (2D 75000/3D 95000/IMAX 120000).
- Không thêm dependency. Mỗi task build "Compiled successfully" trước khi commit.
- Rạp (`cinemas`) read-only — không thêm helper CRUD cho cinemas.

## File Structure
- `db.json` — users thêm `role`; thêm admin user.
- `src/Services/api.js` — thêm create/update/delete movies/rooms/showtimes.
- `src/Components/AdminRoute.jsx` (Create) — role gate.
- `src/Components/Navbar.jsx` — link "Quản trị" (admin-only) trong dropdown.
- `src/Components/admin/Modal.jsx`, `ConfirmDialog.jsx` (Create) — dùng chung.
- `src/Pages/Admin/AdminLayout.jsx` + `Admin.css` (Create) — sidebar + Outlet + styles chung.
- `src/Pages/Admin/AdminOverview.jsx`, `AdminMovies.jsx`, `AdminRooms.jsx`, `AdminShowtimes.jsx`, `AdminBookings.jsx` (Create).
- `src/App.jsx` — nested admin routes.

---

### Task 1: Role data + API CRUD helpers

**Files:** Modify `db.json`, `src/Services/api.js`.

**Interfaces (Produces):**
- users có `role`. Admin: `{ id:2, fullName:"Quản trị viên", email:"admin@cinema.vn", password:"admin123", role:"admin" }`.
- api.js: `createMovie(b)`, `updateMovie(id,p)`, `deleteMovie(id)`, `createRoom(b)`, `updateRoom(id,p)`, `deleteRoom(id)`, `createShowtime(b)`, `updateShowtime(id,p)`, `deleteShowtime(id)` — đều trả Promise; delete trả response.

- [ ] **Step 1:** Trong `db.json`, thêm `"role": "user"` cho user id 1, và thêm object admin id 2 (shape ở trên) vào mảng `users`.

- [ ] **Step 2:** Thêm vào cuối `src/Services/api.js`:
```js
// --- Admin CRUD ---
const post = (path, body) => fetch(`${BASE_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
const patch = (path, body) => fetch(`${BASE_URL}${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
const del = (path) => fetch(`${BASE_URL}${path}`, { method: "DELETE" });

export const createMovie = (b) => post("/movies", b);
export const updateMovie = (id, p) => patch(`/movies/${id}`, p);
export const deleteMovie = (id) => del(`/movies/${id}`);

export const createRoom = (b) => post("/rooms", b);
export const updateRoom = (id, p) => patch(`/rooms/${id}`, p);
export const deleteRoom = (id) => del(`/rooms/${id}`);

export const createShowtime = (b) => post("/showtimes", b);
export const updateShowtime = (id, p) => patch(`/showtimes/${id}`, p);
export const deleteShowtime = (id) => del(`/showtimes/${id}`);
```

- [ ] **Step 3: Verify** login admin trả role.
```bash
cd "D:/FPT/26SP/FER202/cinema-full"; curl -s "http://localhost:9999/users?email=admin@cinema.vn&password=admin123" --max-time 5 | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const u=JSON.parse(s)[0];console.log('admin role=',u&&u.role)})"
```
Expected: `admin role= admin`

- [ ] **Step 4: Commit**
```bash
git add db.json src/Services/api.js && git commit -m "feat(admin): user roles, seed admin, CRUD API helpers"
```

---

### Task 2: AdminRoute + AdminLayout + routes + Navbar link + Overview

**Files:** Create `AdminRoute.jsx`, `src/Pages/Admin/AdminLayout.jsx`, `Admin.css`, `AdminOverview.jsx`; Modify `Navbar.jsx`, `App.jsx`.

**Interfaces:**
- Consumes: `useAuth()` → `{ user }` (user.role).
- Produces: route tree `/admin/*`; sidebar links.

- [ ] **Step 1: `src/Components/AdminRoute.jsx`**
```jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../Context/AuthContext";

export default function AdminRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}
```

- [ ] **Step 2: `src/Pages/Admin/AdminLayout.jsx`**
```jsx
import { NavLink, Outlet } from "react-router-dom";
import Navbar from "../../Components/Navbar";
import "./Admin.css";

const LINKS = [
  { to: "/admin", end: true, label: "Tổng quan" },
  { to: "/admin/movies", label: "Phim" },
  { to: "/admin/rooms", label: "Phòng" },
  { to: "/admin/showtimes", label: "Suất chiếu" },
  { to: "/admin/bookings", label: "Đơn đặt vé" }
];

export default function AdminLayout() {
  return (
    <div className="page admin-page">
      <Navbar />
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-title">Quản trị</div>
          {LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}>{l.label}</NavLink>
          ))}
        </aside>
        <main className="admin-content"><Outlet /></main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/Pages/Admin/Admin.css`** — layout + bảng + modal + form (dùng chung). Nội dung:
```css
.admin-page { background: var(--bg); }
.admin-shell { display: flex; gap: 24px; padding: 80px 40px 60px; max-width: 1400px; margin: 0 auto; }
.admin-sidebar { width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; }
.admin-sidebar-title { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: var(--text-dim); padding: 8px 12px; }
.admin-nav-link { padding: 10px 12px; border-radius: 8px; color: var(--text-muted); font-size: 14px; transition: background .15s, color .15s; }
.admin-nav-link:hover { background: rgba(255,255,255,0.05); color: var(--text); }
.admin-nav-link.active { background: rgba(230,48,48,0.15); color: var(--red); }
.admin-content { flex: 1; min-width: 0; }
.admin-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.admin-title { font-family: 'Bebas Neue', sans-serif; font-size: 40px; letter-spacing: 1px; }
.admin-toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.admin-search { flex: 1; min-width: 200px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: var(--text); font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; }
.admin-search:focus { border-color: rgba(230,48,48,0.4); }
.admin-filter { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; color: var(--text); font-size: 13px; outline: none; cursor: pointer; }
.admin-btn { background: var(--red); color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; font-size: 13px; cursor: pointer; transition: background .2s; }
.admin-btn:hover { background: var(--red-dark); }
.admin-btn.ghost { background: rgba(255,255,255,0.08); color: var(--text); }
.admin-btn.small { padding: 6px 12px; font-size: 12px; }
.admin-btn.danger { background: transparent; color: #ff6b6b; border: 1px solid rgba(255,107,107,0.4); }
.admin-btn.danger:hover { background: rgba(230,48,48,0.12); }
.admin-table { width: 100%; border-collapse: collapse; }
.admin-table th { text-align: left; font-family: 'Barlow Condensed', sans-serif; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-dim); padding: 10px 12px; border-bottom: 1px solid var(--border); }
.admin-table td { padding: 12px; border-bottom: 1px solid var(--border); font-size: 14px; color: var(--text); }
.admin-table tr:hover td { background: rgba(255,255,255,0.02); }
.admin-row-actions { display: flex; gap: 8px; justify-content: flex-end; }
.admin-empty { padding: 40px; text-align: center; color: var(--text-muted); }
/* stat tiles */
.admin-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap: 16px; }
.admin-stat { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
.admin-stat-num { font-family: 'Bebas Neue', sans-serif; font-size: 44px; color: var(--red); line-height: 1; }
.admin-stat-label { font-size: 13px; color: var(--text-muted); margin-top: 6px; }
/* modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 20px; }
.modal-card { background: #161616; border: 1px solid var(--border); border-radius: 12px; width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,0.6); }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--border); }
.modal-title { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; }
.modal-close { background: none; border: none; color: var(--text-muted); font-size: 22px; cursor: pointer; line-height: 1; }
.modal-body { padding: 24px; display: flex; flex-direction: column; gap: 14px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
.field-row { display: flex; flex-direction: column; gap: 6px; }
.field-row label { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-dim); }
.field-row input, .field-row select, .field-row textarea { background: var(--bg-card2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; color: var(--text); font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; }
.field-row input:focus, .field-row select:focus, .field-row textarea:focus { border-color: rgba(230,48,48,0.4); }
.field-two { display: flex; gap: 12px; }
.field-two .field-row { flex: 1; }
.modal-error { color: #ff6b6b; font-size: 13px; }
@media (max-width: 800px) { .admin-shell { flex-direction: column; padding: 80px 20px 40px; } .admin-sidebar { width: 100%; flex-direction: row; flex-wrap: wrap; } }
```

- [ ] **Step 4: `src/Pages/Admin/AdminOverview.jsx`**
```jsx
import { useEffect, useState } from "react";
import { getMovies, getCinemas, getRooms, getAllShowtimes, getBookings } from "../../Services/api";

export default function AdminOverview() {
  const [s, setS] = useState({ movies: 0, cinemas: 0, rooms: 0, showtimes: 0, bookings: 0 });
  useEffect(() => {
    Promise.all([getMovies(), getCinemas(), getRooms(), getAllShowtimes(), getBookings()])
      .then(([m, c, r, st, b]) => setS({ movies: m.length, cinemas: c.length, rooms: r.length, showtimes: st.length, bookings: b.length }));
  }, []);
  const tiles = [
    { n: s.movies, l: "Phim" }, { n: s.cinemas, l: "Rạp" }, { n: s.rooms, l: "Phòng" },
    { n: s.showtimes, l: "Suất chiếu" }, { n: s.bookings, l: "Đơn đặt vé" }
  ];
  return (
    <div>
      <div className="admin-head"><h1 className="admin-title">Tổng quan</h1></div>
      <div className="admin-stats">
        {tiles.map(t => <div key={t.l} className="admin-stat"><div className="admin-stat-num">{t.n}</div><div className="admin-stat-label">{t.l}</div></div>)}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Navbar** — thêm link "Quản trị" trong dropdown (chỉ admin). Trong `.user-dropdown`, ngay trước divider cuối (trên nút Đăng xuất):
```jsx
{user.role === "admin" && (
  <Link to="/admin" className="user-dropdown-item" onClick={() => setDropOpen(false)}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>
    Quản trị
  </Link>
)}
```

- [ ] **Step 6: App.jsx** — import + nested route bọc AdminRoute.
```jsx
import AdminRoute from "./Components/AdminRoute";
import AdminLayout from "./Pages/Admin/AdminLayout";
import AdminOverview from "./Pages/Admin/AdminOverview";
import AdminMovies from "./Pages/Admin/AdminMovies";
import AdminRooms from "./Pages/Admin/AdminRooms";
import AdminShowtimes from "./Pages/Admin/AdminShowtimes";
import AdminBookings from "./Pages/Admin/AdminBookings";
// trong <Routes>:
<Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
  <Route index element={<AdminOverview />} />
  <Route path="movies" element={<AdminMovies />} />
  <Route path="rooms" element={<AdminRooms />} />
  <Route path="showtimes" element={<AdminShowtimes />} />
  <Route path="bookings" element={<AdminBookings />} />
</Route>
```
> Vì Task 2 import các trang chưa tạo (Task 4–7), tạo **file stub** tối thiểu cho `AdminMovies/Rooms/Showtimes/Bookings` (mỗi file `export default function X(){return <div className="admin-head"><h1 className="admin-title">…</h1></div>;}`) để build pass; sẽ hoàn thiện ở task sau.

- [ ] **Step 7: Build**
```bash
cd "D:/FPT/26SP/FER202/cinema-full"; CI=true npm run build 2>&1 | grep -E "Compiled|Failed|Error"
```
Expected: `Compiled successfully.`

- [ ] **Step 8: Verify quyền** — mở `http://localhost:3000/admin`: chưa login → về /login; login `a@cinema.vn` (user) → về `/`; login `admin@cinema.vn` → thấy dashboard + thẻ số liệu.

- [ ] **Step 9: Commit**
```bash
git add src/Components/AdminRoute.jsx src/Pages/Admin src/Components/Navbar.jsx src/App.jsx && git commit -m "feat(admin): route guard, layout, overview, nav link"
```

---

### Task 3: Modal + ConfirmDialog dùng chung

**Files:** Create `src/Components/admin/Modal.jsx`, `src/Components/admin/ConfirmDialog.jsx`.

**Interfaces (Produces):**
- `Modal({ title, onClose, children })` — overlay; đóng khi bấm nền/X/Esc.
- `ConfirmDialog({ message, onConfirm, onCancel })`.

- [ ] **Step 1: `Modal.jsx`**
```jsx
import { useEffect } from "react";

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ConfirmDialog.jsx`**
```jsx
import Modal from "./Modal";

export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <Modal title="Xác nhận" onClose={onCancel}>
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{message}</p>
      <div className="modal-actions">
        <button className="admin-btn ghost" onClick={onCancel}>Hủy</button>
        <button className="admin-btn danger" onClick={onConfirm}>Xóa</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Build** (chưa dùng, chỉ đảm bảo hợp lệ)
```bash
cd "D:/FPT/26SP/FER202/cinema-full"; CI=true npm run build 2>&1 | grep -E "Compiled|Failed|Error"
```
Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**
```bash
git add src/Components/admin && git commit -m "feat(admin): shared Modal and ConfirmDialog"
```

---

### Task 4: AdminMovies (CRUD + tìm kiếm + guard xóa)

**Files:** Modify `src/Pages/Admin/AdminMovies.jsx` (thay stub).

**Interfaces:** Consumes `getMovies, createMovie, updateMovie, deleteMovie, getAllShowtimes` + `Modal`, `ConfirmDialog`.

- [ ] **Step 1: Viết `AdminMovies.jsx`**
```jsx
import { useEffect, useMemo, useState } from "react";
import { getMovies, createMovie, updateMovie, deleteMovie, getAllShowtimes } from "../../Services/api";
import Modal from "../../Components/admin/Modal";
import ConfirmDialog from "../../Components/admin/ConfirmDialog";

const EMPTY = { title: "", genre: "", duration: "", description: "", poster: "" };

export default function AdminMovies() {
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null); // null | movie | "new"
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const load = () => { getMovies().then(setMovies); getAllShowtimes().then(setShowtimes); };
  useEffect(load, []);

  const visible = useMemo(
    () => movies.filter(m => m.title.toLowerCase().includes(q.trim().toLowerCase())),
    [movies, q]
  );

  const openNew = () => { setForm(EMPTY); setError(""); setEditing("new"); };
  const openEdit = (m) => { setForm({ title: m.title, genre: m.genre, duration: m.duration, description: m.description || "", poster: m.poster || "" }); setError(""); setEditing(m); };
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.title.trim() || !form.genre.trim() || !form.duration) { setError("Nhập đủ tên, thể loại, thời lượng."); return; }
    const body = { title: form.title.trim(), genre: form.genre.trim(), duration: Number(form.duration), description: form.description, poster: form.poster || "https://via.placeholder.com/200x300" };
    if (editing === "new") await createMovie(body);
    else await updateMovie(editing.id, body);
    setEditing(null); load();
  };

  const doDelete = async () => {
    const used = showtimes.filter(s => s.movieId === confirmId).length;
    if (used > 0) { alert(`Không thể xóa: còn ${used} suất chiếu liên quan.`); setConfirmId(null); return; }
    await deleteMovie(confirmId); setConfirmId(null); load();
  };

  return (
    <div>
      <div className="admin-head"><h1 className="admin-title">Phim</h1></div>
      <div className="admin-toolbar">
        <input className="admin-search" placeholder="Tìm phim theo tên..." value={q} onChange={e => setQ(e.target.value)} />
        <button className="admin-btn" onClick={openNew}>+ Thêm phim</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Tên</th><th>Thể loại</th><th>Thời lượng</th><th></th></tr></thead>
        <tbody>
          {visible.map(m => (
            <tr key={m.id}>
              <td>{m.title}</td><td>{m.genre}</td><td>{m.duration} phút</td>
              <td><div className="admin-row-actions">
                <button className="admin-btn ghost small" onClick={() => openEdit(m)}>Sửa</button>
                <button className="admin-btn danger small" onClick={() => setConfirmId(m.id)}>Xóa</button>
              </div></td>
            </tr>
          ))}
          {visible.length === 0 && <tr><td colSpan={4} className="admin-empty">Không có phim</td></tr>}
        </tbody>
      </table>

      {editing && (
        <Modal title={editing === "new" ? "Thêm phim" : "Sửa phim"} onClose={() => setEditing(null)}>
          <div className="field-row"><label>Tên phim</label><input value={form.title} onChange={set("title")} /></div>
          <div className="field-two">
            <div className="field-row"><label>Thể loại</label><input value={form.genre} onChange={set("genre")} /></div>
            <div className="field-row"><label>Thời lượng (phút)</label><input type="number" value={form.duration} onChange={set("duration")} /></div>
          </div>
          <div className="field-row"><label>Mô tả</label><textarea rows={3} value={form.description} onChange={set("description")} /></div>
          <div className="field-row"><label>Poster (URL, tùy chọn)</label><input value={form.poster} onChange={set("poster")} /></div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button className="admin-btn ghost" onClick={() => setEditing(null)}>Hủy</button>
            <button className="admin-btn" onClick={save}>Lưu</button>
          </div>
        </Modal>
      )}
      {confirmId && <ConfirmDialog message="Bạn chắc chắn muốn xóa phim này?" onConfirm={doDelete} onCancel={() => setConfirmId(null)} />}
    </div>
  );
}
```

- [ ] **Step 2: Build**
```bash
cd "D:/FPT/26SP/FER202/cinema-full"; CI=true npm run build 2>&1 | grep -E "Compiled|Failed|Error"
```
Expected: `Compiled successfully.`

- [ ] **Step 3: Verify** — /admin/movies: thêm 1 phim test → xuất hiện; sửa → cập nhật; xóa phim không có suất → mất; thử xóa phim có suất (Avengers) → báo chặn. Xóa phim test để dọn.

- [ ] **Step 4: Commit**
```bash
git add src/Pages/Admin/AdminMovies.jsx && git commit -m "feat(admin): movies CRUD with search and delete guard"
```

---

### Task 5: AdminRooms (CRUD + tìm kiếm + lọc rạp + guard xóa)

**Files:** Modify `src/Pages/Admin/AdminRooms.jsx`.

**Interfaces:** Consumes `getRooms, getCinemas, createRoom, updateRoom, deleteRoom, getAllShowtimes` + Modal/ConfirmDialog + `ROOM_TYPE_PRICE` (không cần). Loại phòng: `["2D","3D","IMAX"]`.

- [ ] **Step 1: Viết `AdminRooms.jsx`** — tương tự Movies nhưng:
  - Load thêm `getCinemas()` → `cinemas`; map `cinemaId→name`.
  - Bảng cột: Rạp (cinemaName) · Tên · Loại · Layout (`rows×cols`) · Hàng VIP (`vipRows.join(",")`).
  - Toolbar: search (tên phòng hoặc tên rạp) + `<select className="admin-filter">` lọc theo rạp ("Tất cả rạp" + từng rạp).
  - Form modal fields: `cinemaId` (select cinemas), `name` (input), `type` (select 2D/3D/IMAX), `rows` (number), `cols` (number), `vipRows` (input text "E,F").
  - save: build body `{ cinemaId:Number(form.cinemaId), name, type, rows:Number(form.rows), cols:Number(form.cols), vipRows: form.vipRows.split(",").map(s=>s.trim().toUpperCase()).filter(Boolean) }`. Validate cinemaId, name, rows>0, cols>0.
  - delete guard: chặn nếu `showtimes.some(s=>s.roomId===id)` → alert "Không thể xóa: còn N suất chiếu liên quan."
Code (đầy đủ):
```jsx
import { useEffect, useMemo, useState } from "react";
import { getRooms, getCinemas, createRoom, updateRoom, deleteRoom, getAllShowtimes } from "../../Services/api";
import Modal from "../../Components/admin/Modal";
import ConfirmDialog from "../../Components/admin/ConfirmDialog";

const TYPES = ["2D", "3D", "IMAX"];
const EMPTY = { cinemaId: "", name: "", type: "2D", rows: 8, cols: 12, vipRows: "E,F" };

export default function AdminRooms() {
  const [rooms, setRooms] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [q, setQ] = useState("");
  const [cinemaFilter, setCinemaFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const load = () => { getRooms().then(setRooms); getCinemas().then(setCinemas); getAllShowtimes().then(setShowtimes); };
  useEffect(load, []);
  const cinemaName = (id) => cinemas.find(c => c.id === id)?.name || "—";

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rooms.filter(r => {
      const okCinema = cinemaFilter === "all" || r.cinemaId === Number(cinemaFilter);
      const okTerm = !term || r.name.toLowerCase().includes(term) || cinemaName(r.cinemaId).toLowerCase().includes(term);
      return okCinema && okTerm;
    });
  }, [rooms, q, cinemaFilter, cinemas]);

  const openNew = () => { setForm(EMPTY); setError(""); setEditing("new"); };
  const openEdit = (r) => { setForm({ cinemaId: r.cinemaId, name: r.name, type: r.type, rows: r.rows, cols: r.cols, vipRows: (r.vipRows || []).join(",") }); setError(""); setEditing(r); };
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.cinemaId || !form.name.trim() || !form.rows || !form.cols) { setError("Nhập đủ rạp, tên, số hàng, số cột."); return; }
    const body = { cinemaId: Number(form.cinemaId), name: form.name.trim(), type: form.type, rows: Number(form.rows), cols: Number(form.cols), vipRows: form.vipRows.split(",").map(s => s.trim().toUpperCase()).filter(Boolean) };
    if (editing === "new") await createRoom(body); else await updateRoom(editing.id, body);
    setEditing(null); load();
  };
  const doDelete = async () => {
    const used = showtimes.filter(s => s.roomId === confirmId).length;
    if (used > 0) { alert(`Không thể xóa: còn ${used} suất chiếu liên quan.`); setConfirmId(null); return; }
    await deleteRoom(confirmId); setConfirmId(null); load();
  };

  return (
    <div>
      <div className="admin-head"><h1 className="admin-title">Phòng</h1></div>
      <div className="admin-toolbar">
        <input className="admin-search" placeholder="Tìm phòng hoặc rạp..." value={q} onChange={e => setQ(e.target.value)} />
        <select className="admin-filter" value={cinemaFilter} onChange={e => setCinemaFilter(e.target.value)}>
          <option value="all">Tất cả rạp</option>
          {cinemas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="admin-btn" onClick={openNew}>+ Thêm phòng</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Rạp</th><th>Phòng</th><th>Loại</th><th>Layout</th><th>Hàng VIP</th><th></th></tr></thead>
        <tbody>
          {visible.map(r => (
            <tr key={r.id}>
              <td>{cinemaName(r.cinemaId)}</td><td>{r.name}</td><td>{r.type}</td>
              <td>{r.rows}×{r.cols}</td><td>{(r.vipRows || []).join(", ") || "—"}</td>
              <td><div className="admin-row-actions">
                <button className="admin-btn ghost small" onClick={() => openEdit(r)}>Sửa</button>
                <button className="admin-btn danger small" onClick={() => setConfirmId(r.id)}>Xóa</button>
              </div></td>
            </tr>
          ))}
          {visible.length === 0 && <tr><td colSpan={6} className="admin-empty">Không có phòng</td></tr>}
        </tbody>
      </table>

      {editing && (
        <Modal title={editing === "new" ? "Thêm phòng" : "Sửa phòng"} onClose={() => setEditing(null)}>
          <div className="field-row"><label>Rạp</label>
            <select value={form.cinemaId} onChange={set("cinemaId")}>
              <option value="">— Chọn rạp —</option>
              {cinemas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field-two">
            <div className="field-row"><label>Tên phòng</label><input value={form.name} onChange={set("name")} /></div>
            <div className="field-row"><label>Loại</label><select value={form.type} onChange={set("type")}>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          </div>
          <div className="field-two">
            <div className="field-row"><label>Số hàng</label><input type="number" value={form.rows} onChange={set("rows")} /></div>
            <div className="field-row"><label>Số cột</label><input type="number" value={form.cols} onChange={set("cols")} /></div>
          </div>
          <div className="field-row"><label>Hàng VIP (vd: E,F)</label><input value={form.vipRows} onChange={set("vipRows")} /></div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button className="admin-btn ghost" onClick={() => setEditing(null)}>Hủy</button>
            <button className="admin-btn" onClick={save}>Lưu</button>
          </div>
        </Modal>
      )}
      {confirmId && <ConfirmDialog message="Bạn chắc chắn muốn xóa phòng này?" onConfirm={doDelete} onCancel={() => setConfirmId(null)} />}
    </div>
  );
}
```

- [ ] **Step 2: Build** → `Compiled successfully.`
- [ ] **Step 3: Verify** /admin/rooms: thêm/sửa/xóa; lọc theo rạp; thử xóa phòng có suất → chặn.
- [ ] **Step 4: Commit**
```bash
git add src/Pages/Admin/AdminRooms.jsx && git commit -m "feat(admin): rooms CRUD with cinema filter and delete guard"
```

---

### Task 6: AdminShowtimes (CRUD + tìm kiếm + lọc rạp)

**Files:** Modify `src/Pages/Admin/AdminShowtimes.jsx`.

**Interfaces:** Consumes `getAllShowtimes, getMovies, getRooms, getCinemas, createShowtime, updateShowtime, deleteShowtime` + Modal/ConfirmDialog + `ROOM_TYPE_PRICE` từ `../../lib/pricing`.

- [ ] **Step 1: Viết `AdminShowtimes.jsx`**
```jsx
import { useEffect, useMemo, useState } from "react";
import { getAllShowtimes, getMovies, getRooms, getCinemas, createShowtime, updateShowtime, deleteShowtime } from "../../Services/api";
import { ROOM_TYPE_PRICE } from "../../lib/pricing";
import Modal from "../../Components/admin/Modal";
import ConfirmDialog from "../../Components/admin/ConfirmDialog";

const EMPTY = { movieId: "", roomId: "", date: "", time: "", price: "" };

export default function AdminShowtimes() {
  const [showtimes, setShowtimes] = useState([]);
  const [movies, setMovies] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [q, setQ] = useState("");
  const [cinemaFilter, setCinemaFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const load = () => { getAllShowtimes().then(setShowtimes); getMovies().then(setMovies); getRooms().then(setRooms); getCinemas().then(setCinemas); };
  useEffect(load, []);

  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));
  const cinemaMap = Object.fromEntries(cinemas.map(c => [c.id, c]));
  const movieMap = Object.fromEntries(movies.map(m => [m.id, m]));
  const roomLabel = (rid) => { const r = roomMap[rid]; return r ? `${cinemaMap[r.cinemaId]?.name} · ${r.name} · ${r.type}` : "—"; };

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return showtimes.filter(s => {
      const r = roomMap[s.roomId];
      const okCinema = cinemaFilter === "all" || (r && r.cinemaId === Number(cinemaFilter));
      const okTerm = !term || (movieMap[s.movieId]?.title || "").toLowerCase().includes(term);
      return okCinema && okTerm;
    }).sort((a, b) => a.time.localeCompare(b.time));
  }, [showtimes, q, cinemaFilter, rooms, cinemas, movies]);

  const openNew = () => { setForm(EMPTY); setError(""); setEditing("new"); };
  const openEdit = (s) => { setForm({ movieId: s.movieId, roomId: s.roomId, date: s.time.slice(0, 10), time: s.time.slice(11, 16), price: s.price }); setError(""); setEditing(s); };
  const set = (k) => (e) => {
    const v = e.target.value;
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === "roomId") { const r = roomMap[Number(v)]; if (r && !next.price) next.price = ROOM_TYPE_PRICE[r.type]; }
      return next;
    });
  };

  const save = async () => {
    if (!form.movieId || !form.roomId || !form.date || !form.time || !form.price) { setError("Nhập đủ phim, phòng, ngày, giờ, giá."); return; }
    const body = { movieId: Number(form.movieId), roomId: Number(form.roomId), time: `${form.date}T${form.time}:00`, price: Number(form.price), bookedSeats: editing === "new" ? [] : (editing.bookedSeats || []) };
    if (editing === "new") await createShowtime(body); else await updateShowtime(editing.id, body);
    setEditing(null); load();
  };
  const doDelete = async () => { await deleteShowtime(confirmId); setConfirmId(null); load(); };

  const fmt = (iso) => new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="admin-head"><h1 className="admin-title">Suất chiếu</h1></div>
      <div className="admin-toolbar">
        <input className="admin-search" placeholder="Tìm theo tên phim..." value={q} onChange={e => setQ(e.target.value)} />
        <select className="admin-filter" value={cinemaFilter} onChange={e => setCinemaFilter(e.target.value)}>
          <option value="all">Tất cả rạp</option>
          {cinemas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="admin-btn" onClick={openNew}>+ Thêm suất</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Phim</th><th>Rạp · Phòng</th><th>Thời gian</th><th>Giá</th><th></th></tr></thead>
        <tbody>
          {visible.map(s => (
            <tr key={s.id}>
              <td>{movieMap[s.movieId]?.title || "—"}</td>
              <td>{roomLabel(s.roomId)}</td>
              <td>{fmt(s.time)}</td>
              <td>{s.price.toLocaleString("vi-VN")}₫</td>
              <td><div className="admin-row-actions">
                <button className="admin-btn ghost small" onClick={() => openEdit(s)}>Sửa</button>
                <button className="admin-btn danger small" onClick={() => setConfirmId(s.id)}>Xóa</button>
              </div></td>
            </tr>
          ))}
          {visible.length === 0 && <tr><td colSpan={5} className="admin-empty">Không có suất chiếu</td></tr>}
        </tbody>
      </table>

      {editing && (
        <Modal title={editing === "new" ? "Thêm suất chiếu" : "Sửa suất chiếu"} onClose={() => setEditing(null)}>
          <div className="field-row"><label>Phim</label>
            <select value={form.movieId} onChange={set("movieId")}><option value="">— Chọn phim —</option>{movies.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select>
          </div>
          <div className="field-row"><label>Phòng (Rạp · Phòng · Loại)</label>
            <select value={form.roomId} onChange={set("roomId")}><option value="">— Chọn phòng —</option>{rooms.map(r => <option key={r.id} value={r.id}>{roomLabel(r.id)}</option>)}</select>
          </div>
          <div className="field-two">
            <div className="field-row"><label>Ngày</label><input type="date" value={form.date} onChange={set("date")} /></div>
            <div className="field-row"><label>Giờ</label><input type="time" value={form.time} onChange={set("time")} /></div>
          </div>
          <div className="field-row"><label>Giá (₫)</label><input type="number" value={form.price} onChange={set("price")} /></div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button className="admin-btn ghost" onClick={() => setEditing(null)}>Hủy</button>
            <button className="admin-btn" onClick={save}>Lưu</button>
          </div>
        </Modal>
      )}
      {confirmId && <ConfirmDialog message="Bạn chắc chắn muốn xóa suất chiếu này?" onConfirm={doDelete} onCancel={() => setConfirmId(null)} />}
    </div>
  );
}
```

- [ ] **Step 2: Build** → `Compiled successfully.`
- [ ] **Step 3: Verify** /admin/showtimes: thêm suất (chọn phòng → giá tự điền), sửa, xóa; lọc theo rạp; tìm theo phim.
- [ ] **Step 4: Commit**
```bash
git add src/Pages/Admin/AdminShowtimes.jsx && git commit -m "feat(admin): showtimes CRUD with cinema filter and price suggest"
```

---

### Task 7: AdminBookings (chỉ đọc + tìm kiếm)

**Files:** Modify `src/Pages/Admin/AdminBookings.jsx`.

**Interfaces:** Consumes `getBookings, getMovies, getCinemas, getRooms, getAllShowtimes`.

- [ ] **Step 1: Viết `AdminBookings.jsx`** — nạp maps 1 lần, bảng chỉ đọc, tìm theo khách/phim.
```jsx
import { useEffect, useMemo, useState } from "react";
import { getBookings, getMovies, getCinemas, getRooms, getAllShowtimes } from "../../Services/api";

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [movies, setMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    getBookings().then(setBookings); getMovies().then(setMovies);
    getCinemas().then(setCinemas); getRooms().then(setRooms); getAllShowtimes().then(setShowtimes);
  }, []);

  const movieMap = Object.fromEntries(movies.map(m => [m.id, m]));
  const cinemaMap = Object.fromEntries(cinemas.map(c => [c.id, c]));
  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));
  const showtimeMap = Object.fromEntries(showtimes.map(s => [s.id, s]));
  const fmt = (iso) => iso ? new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return bookings.filter(b => !term || (b.userName || "").toLowerCase().includes(term) || (movieMap[b.movieId]?.title || "").toLowerCase().includes(term));
  }, [bookings, q, movies]);

  return (
    <div>
      <div className="admin-head"><h1 className="admin-title">Đơn đặt vé</h1></div>
      <div className="admin-toolbar">
        <input className="admin-search" placeholder="Tìm theo khách hoặc phim..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <table className="admin-table">
        <thead><tr><th>Mã</th><th>Khách</th><th>Phim</th><th>Rạp · Phòng</th><th>Ghế</th><th>Tổng</th><th>Suất</th></tr></thead>
        <tbody>
          {visible.map(b => (
            <tr key={b.id}>
              <td>#TK-{String(b.id).padStart(5, "0")}</td>
              <td>{b.userName}</td>
              <td>{movieMap[b.movieId]?.title || "—"}</td>
              <td>{cinemaMap[b.cinemaId]?.name || "—"}{roomMap[b.roomId] ? ` · ${roomMap[b.roomId].name}` : ""}</td>
              <td>{(b.seats || []).join(", ")}</td>
              <td>{(b.totalPrice || 0).toLocaleString("vi-VN")}₫</td>
              <td>{fmt(showtimeMap[b.showtimeId]?.time)}</td>
            </tr>
          ))}
          {visible.length === 0 && <tr><td colSpan={7} className="admin-empty">Không có đơn đặt vé</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Build** → `Compiled successfully.`
- [ ] **Step 3: Verify** /admin/bookings: thấy 3 đơn với tên phim/rạp/phòng; tìm kiếm lọc đúng.
- [ ] **Step 4: Commit**
```bash
git add src/Pages/Admin/AdminBookings.jsx && git commit -m "feat(admin): read-only bookings table with search"
```

---

### Task 8: E2E + docs + push

**Files:** Modify `README.md`, `CLAUDE.md`.

- [ ] **Step 1: E2E** — login admin: thêm 1 phim → thêm 1 phòng → thêm 1 suất cho phim đó → mở `/movie/:id` phía khách thấy suất mới → xóa suất, phòng, phim test (theo thứ tự để không vướng guard) → dữ liệu về sạch. Thử xóa phim/phòng đang có suất để xác nhận guard chặn.
- [ ] **Step 2: README** — thêm route `/admin` (admin-only) vào bảng; ghi tài khoản admin mẫu.
- [ ] **Step 3: CLAUDE.md** — Architecture: `role` trên users, `AdminRoute`, `src/Pages/Admin/*`, CRUD helpers; ghi rạp read-only + guard xóa.
- [ ] **Step 4: Commit + push**
```bash
git add README.md CLAUDE.md && git commit -m "docs: document admin panel" && git push origin main
```

## Self-Review
- **Spec coverage:** role + admin seed (T1); AdminRoute + layout + overview + nav link (T2); Modal/ConfirmDialog (T3); Phim CRUD+search+guard (T4); Phòng CRUD+filter+guard (T5); Suất CRUD+filter+price-suggest (T6); Bookings read-only+search (T7); rạp read-only (không có helper CRUD cinemas — T1); docs (T8). Đủ.
- **Placeholder scan:** mọi step có code/lệnh cụ thể; stub pages ở T2 được thay đầy đủ ở T4–T7.
- **Type consistency:** helpers `createMovie/updateMovie/deleteMovie`, `...Room`, `...Showtime` khai báo T1, dùng đúng tên ở T4–T6. `ROOM_TYPE_PRICE` import từ `../../lib/pricing` (đã tồn tại). Booking fields (`cinemaId,roomId,seats,totalPrice,userName,showtimeId`) đọc ở T7 khớp shape tạo tại SeatSelection.
