# GĐ2g — Admin Kinetic Operator-Console — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Redesign toàn bộ `/admin` sang Kinetic "operator console", chuyển data layer sang TanStack Query (hooks + mutations), convert `.jsx`→`.tsx`.

**Architecture:** Vẫn `AdminLayout` (Navbar + sidebar + `<Outlet>`); mỗi trang admin gọi hook Query từ `queries/catalog.ts` + `queries/admin.ts` (mới) thay `useState/useEffect`; mutation `invalidateQueries` thay `load()`. CSS viết lại theo lớp `.adm-k`. Modal dùng `ui/Modal` sẵn có.

**Tech Stack:** React 18 + TS 5.7, TanStack Query v5, recharts (giữ), Vite 6, Playwright, Vitest.

Spec: `docs/superpowers/specs/2026-07-21-phase2g-admin-design.md`.

## Global Constraints

- Commit **thẳng `main`**, mỗi lát 1+ commit; cuối lát push. Message tiếng Việt không dấu + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **KHÔNG commit** `CLAUDE.md` / `README.md` (tài liệu chỉnh tay, để nguyên).
- Giữ **6 gate xanh mỗi lát**: `npx tsc --noEmit` · `npm run lint` (0 warning) · `npm run format:check` · `npx vitest run` · `npx playwright test` · `npm run build`.
- Absolute imports (`baseUrl: src`): `queries/…`, `services/…`, `components/…`, `lib/…`. Same-folder = relative.
- Kinetic tokens ở `src/styles/tokens.css`: `--surface-invert` (bone) `#ece7dd` / `--text-invert` `#0a0a0a`; `--font-mono` Space Mono; `--font-display` Bebas Neue; `--red` `#e63030`; `--border`/`--border-strong`; radius `--r-sm` 2px; `--bw-1`/`--bw-2`.
- Copy tiếng Việt; VND `.toLocaleString("vi-VN")` + `₫`.
- **Gotcha bắt buộc:** đổi đuôi `.jsx`→`.tsx` làm HMR Vite trắng trang → sau mỗi lát có đổi đuôi phải: kill listener :3000, `rm -rf node_modules/.vite`, `npm start`, chờ `curl :3000` = 200, rồi mới screenshot. Script screenshot `.mjs` để ở gốc project (resolve node_modules), import `chromium` từ `@playwright/test`, **xoá trước `format:check`**.
- Guard client giữ nguyên: chặn xoá movie/room khi còn suất chiếu (alert); mọi validate form giữ.

---

## Task 1 — Query infra: `src/queries/admin.ts` + key `allBookings`

**Files:**
- Modify: `src/queries/keys.ts` (thêm `allBookings`)
- Create: `src/queries/admin.ts`

**Interfaces — Produces:**
- `useAllBookings(): UseQueryResult<Booking[]>` (key `qk.allBookings`)
- `useCreateMovie/useUpdateMovie/useDeleteMovie`
- `useCreateRoom/useUpdateRoom/useDeleteRoom`
- `useCreateShowtime/useUpdateShowtime/useDeleteShowtime`
- `useUpdateBooking/useDeleteBooking`
- Mỗi mutation trả `UseMutationResult`; page gọi `.mutateAsync(...)`.

- [ ] **Step 1: Thêm key `allBookings`** vào `src/queries/keys.ts` trong object `qk`, ngay sau `myBookings`:

```ts
  myBookings: ["bookings", "mine"] as const,
  allBookings: ["bookings", "all"] as const,
```

- [ ] **Step 2: Tạo `src/queries/admin.ts`** với nội dung đầy đủ:

```ts
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getBookings,
  createMovie,
  updateMovie,
  deleteMovie,
  createRoom,
  updateRoom,
  deleteRoom,
  createShowtime,
  updateShowtime,
  deleteShowtime,
  updateBooking,
  deleteBooking,
} from "services/api";
import type { Booking, Movie, Room, Showtime } from "types";
import { qk } from "./keys";

// Admin: gateway trả TẤT CẢ bookings cho role admin (khác qk.myBookings).
export const useAllBookings = (): UseQueryResult<Booking[]> =>
  useQuery({ queryKey: qk.allBookings, queryFn: getBookings });

// ---- Movies ----
export const useCreateMovie = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Movie>) => createMovie(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.movies }),
  });
};
export const useUpdateMovie = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: number | string; body: Partial<Movie> }) =>
      updateMovie(v.id, v.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.movies }),
  });
};
export const useDeleteMovie = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteMovie(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.movies }),
  });
};

// ---- Rooms ----
export const useCreateRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Room>) => createRoom(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms }),
  });
};
export const useUpdateRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: number | string; body: Partial<Room> }) =>
      updateRoom(v.id, v.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms }),
  });
};
export const useDeleteRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteRoom(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms }),
  });
};

// ---- Showtimes (useAllShowtimes dùng key qk.showtimes) ----
export const useCreateShowtime = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Showtime>) => createShowtime(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.showtimes }),
  });
};
export const useUpdateShowtime = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: number | string; body: Partial<Showtime> }) =>
      updateShowtime(v.id, v.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.showtimes }),
  });
};
export const useDeleteShowtime = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteShowtime(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.showtimes }),
  });
};

// ---- Bookings ----
export const useUpdateBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      id: number | string;
      body: Partial<Booking>;
      showtimeId?: number | string;
    }) => updateBooking(v.id, v.body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.allBookings });
      if (v.showtimeId != null)
        qc.invalidateQueries({ queryKey: qk.occupiedSeats(v.showtimeId) });
    },
  });
};
export const useDeleteBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: number | string; showtimeId?: number | string }) =>
      deleteBooking(v.id),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.allBookings });
      if (v.showtimeId != null)
        qc.invalidateQueries({ queryKey: qk.occupiedSeats(v.showtimeId) });
    },
  });
};
```

- [ ] **Step 3: Kiểm chữ ký service** — mở `src/services/api.ts`, xác nhận tồn tại & kiểu tham số: `createMovie(body)`, `updateMovie(id, body)`, `deleteMovie(id)`, tương tự Room/Showtime, `updateBooking(id, body)`, `deleteBooking(id)`, `getBookings()`. Nếu tên/tham số lệch → chỉnh import/khối gọi cho khớp (KHÔNG sửa api.ts).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/queries/admin.ts src/queries/keys.ts --max-warnings=0`
Expected: không lỗi, không warning.

- [ ] **Step 5: Commit** (gộp với Task 2 nếu muốn 1 commit cho lát; hoặc commit riêng)

```bash
git add src/queries/admin.ts src/queries/keys.ts
git commit -m "feat(GD2g/1): queries/admin.ts hooks + mutations"
```

---

## Task 2 — Shell kinetic: `AdminLayout.tsx` + `Pagination.tsx` + `ConfirmDialog.tsx` + `Admin.css` nền

**Files:**
- Rename+rewrite: `src/pages/admin/AdminLayout.jsx` → `.tsx`
- Rename+rewrite: `src/components/admin/Pagination.jsx` → `.tsx`
- Rename+rewrite: `src/components/admin/ConfirmDialog.jsx` → `.tsx`
- Rewrite: `src/pages/admin/Admin.css` (toàn bộ theo `.adm-k`)

**Interfaces:**
- `Pagination` props: `{ page:number; totalPages:number; onPage:(p:number)=>void; from:number; to:number; total:number }`
- `ConfirmDialog` props: `{ message:string; onConfirm:()=>void; onCancel:()=>void }`

- [ ] **Step 1: `AdminLayout.tsx`** — giữ `LINKS`, đổi class sang `.adm-k`:

```tsx
import { NavLink, Outlet } from "react-router-dom";
import Navbar from "components/Navbar";
import "./Admin.css";

const LINKS = [
  { to: "/admin", end: true, label: "Tổng quan" },
  { to: "/admin/movies", label: "Phim" },
  { to: "/admin/rooms", label: "Phòng" },
  { to: "/admin/showtimes", label: "Suất chiếu" },
  { to: "/admin/bookings", label: "Đơn đặt vé" },
];

export default function AdminLayout() {
  return (
    <div className="page adm-k">
      <Navbar />
      <div className="adm-k__shell">
        <aside className="adm-k__side">
          <div className="adm-k__side-title">Quản trị</div>
          <nav className="adm-k__nav">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `adm-k__navlink${isActive ? " is-active" : ""}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="adm-k__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```
Rồi `rm src/pages/admin/AdminLayout.jsx`.

- [ ] **Step 2: `Pagination.tsx`**:

```tsx
export default function Pagination({
  page,
  totalPages,
  onPage,
  from,
  to,
  total,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  from: number;
  to: number;
  total: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="adm-k__pag">
      <span className="adm-k__pag-info">
        {from}–{to} / {total}
      </span>
      <div className="adm-k__pag-ctrl">
        <button
          className="adm-k__btn ghost sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Trang trước"
        >
          ‹
        </button>
        <span className="adm-k__pag-page">
          Trang {page}/{totalPages}
        </span>
        <button
          className="adm-k__btn ghost sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Trang sau"
        >
          ›
        </button>
      </div>
    </div>
  );
}
```
Rồi `rm src/components/admin/Pagination.jsx`.

- [ ] **Step 3: `ConfirmDialog.tsx`**:

```tsx
import Modal from "./Modal";

export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="Xác nhận" onClose={onCancel}>
      <p className="adm-k__confirm-msg">{message}</p>
      <div className="adm-k__modalact">
        <button className="adm-k__btn ghost" onClick={onCancel}>
          Hủy
        </button>
        <button className="adm-k__btn danger" onClick={onConfirm}>
          Xóa
        </button>
      </div>
    </Modal>
  );
}
```
Rồi `rm src/components/admin/ConfirmDialog.jsx`.

- [ ] **Step 4: Viết lại `Admin.css`** — bỏ toàn bộ class cũ (`.admin-*`, `.field-row`, `.sgm-*`, `.modal-*`), thêm lớp `.adm-k` operator-console. Bắt buộc có các khối (bám tokens): shell/sidebar/nav (active đảo bone, mobile `<900px` sidebar → thanh tab `overflow-x:auto` ngang trên content), `.adm-k__head`(eyebrow mono + title Bebas cỡ vừa `--fs-lg`~`--fs-xl` thấp + count), `.adm-k__toolbar`(search/filter/nút bone), `.adm-k__tablewrap{overflow-x:auto}` + `.adm-k__table`(viền cứng, thead mono uppercase, hàng hairline, hover, `tabular-nums`), `.adm-k__btn`(+`.ghost`/`.danger`/`.sm`; mặc định = khối bone), `.adm-k__rowact`, `.adm-k__empty`, `.adm-k__pag*`, `.adm-k__stat*`, `.adm-k__rev*`, `.adm-k__chartbox`, `.adm-k__field`/`.adm-k__field-two`/`.adm-k__formerr`/`.adm-k__modalact`, `.adm-k__confirm-msg`, seat-grid `.sgm-k*`. Responsive + `prefers-reduced-motion`. (Bám mẫu `-k` ở `Auth.css`/`Booking.css` cho input/nút/bone.)

- [ ] **Step 5: Gate + restart Vite** (đổi đuôi jsx→tsx):

```bash
npx tsc --noEmit
npx eslint src/pages/admin/AdminLayout.tsx src/components/admin/Pagination.tsx src/components/admin/ConfirmDialog.tsx --max-warnings=0
npx prettier --write src/pages/admin/AdminLayout.tsx src/components/admin/Pagination.tsx src/components/admin/ConfirmDialog.tsx src/pages/admin/Admin.css
# restart vite
# (kill :3000, rm -rf node_modules/.vite, npm start, chờ curl :3000 = 200)
```
Expected: tsc/lint sạch. Trang `/admin/*` cũ (Overview vẫn .jsx) vẫn render (dùng class cũ tạm — sẽ đổi ở lát sau). **Lưu ý:** các trang Overview/Movies/... còn `.jsx` vẫn tham chiếu class `.admin-*` cũ vừa bị xoá → **tạm thời xấu**, chấp nhận trong lát này; sẽ khớp lại khi từng trang được viết lại ở 2g/2–2g/4. Để tránh vỡ hoàn toàn giữa lát, GIỮ song song class cũ trong Admin.css cho tới hết 2g/4 rồi mới dọn — xem Task 4/Step cuối & Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/AdminLayout.tsx src/components/admin/Pagination.tsx src/components/admin/ConfirmDialog.tsx src/pages/admin/Admin.css
git rm src/pages/admin/AdminLayout.jsx src/components/admin/Pagination.jsx src/components/admin/ConfirmDialog.jsx
git commit -m "feat(GD2g/1): shell+sidebar+pagination+confirm kinetic; Admin.css .adm-k"
```

> **Quyết định giữ class cũ tạm:** để mỗi lát app không vỡ, `Admin.css` trong 2g/1 **giữ cả** khối `.admin-*` cũ **và** `.adm-k` mới; các trang chưa viết lại vẫn đẹp. Dọn `.admin-*` ở Task 8 (2g/4) sau khi mọi trang đã sang `.adm-k`.

---

## Task 3 — `AdminOverview.tsx` (2g/2): Query + stats/revenue/charts kinetic

**Files:**
- Rename+rewrite: `src/pages/admin/AdminOverview.jsx` → `.tsx`

**Interfaces — Consumes:** `useMovies/useCinemas/useRooms/useAllShowtimes` (catalog), `useAllBookings` (admin).

- [ ] **Step 1: Viết `AdminOverview.tsx`** — thay 5 `useState/useEffect+Promise.all` bằng hook Query; giữ nguyên toàn bộ tính toán `useMemo` (movieMap/cinemaMap/seatRev/totalRevenue/fnbRevenue/totalTickets/revenueByMovie/revenueByCinema) nhưng nguồn là `…Q.data ?? []`. Markup đổi class `.adm-k__*`. Giữ recharts, đổi `Bar radius` → `[0,0,0,0]`, axis tick `fill:"#9a978f"` fontFamily mono, tooltip `contentStyle` nền `#141416` viền `#2a2a2e` radius 0. `RED = "#e63030"` giữ. Khung ví dụ:

```tsx
import { useMemo } from "react";
import {
  useMovies,
  useCinemas,
  useRooms,
  useAllShowtimes,
} from "queries/catalog";
import { useAllBookings } from "queries/admin";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { Booking } from "types";

const RED = "#e63030";
const fmtVnd = (n?: number) => `${(n || 0).toLocaleString("vi-VN")}₫`;

export default function AdminOverview() {
  const movies = useMovies().data ?? [];
  const cinemas = useCinemas().data ?? [];
  const rooms = useRooms().data ?? [];
  const showtimes = useAllShowtimes().data ?? [];
  const bookings = useAllBookings().data ?? [];
  // ... giữ nguyên các useMemo cũ (seatRev, revenueByMovie, revenueByCinema, tiles) ...
  // markup: .adm-k__head / .adm-k__stats>.adm-k__stat / .adm-k__rev>.adm-k__rev-card / .adm-k__charts>.adm-k__chartbox
}
```
Giữ `seatRev`, `tiles`, 2 chart y nguyên logic; chỉ đổi class + style trục/cột. Rồi `rm AdminOverview.jsx`.

- [ ] **Step 2: Gate + restart Vite** (đổi đuôi): tsc + lint (0 warning) + prettier --write. Restart vite (kill/clear/npm start/curl 200).

- [ ] **Step 3: Screenshot verify** — script `.mjs` ở gốc: đăng nhập admin (`admin@cinema.vn`/`admin123`) → `/admin`, chụp desktop 1280 + mobile 390. Kiểm: stat tiles viền cứng số đỏ, 2 chart cột đỏ radius 0 trong hộp viền cứng, sidebar active bone. Xoá script trước format:check.

- [ ] **Step 4: Full gate + commit + push**

```bash
npx tsc --noEmit && npm run lint && npm run format:check && npx vitest run && npx playwright test && npm run build
git add src/pages/admin/AdminOverview.tsx
git rm src/pages/admin/AdminOverview.jsx
git commit -m "feat(GD2g/2): AdminOverview kinetic + TanStack Query"
git push origin main
```

---

## Task 4 — `AdminMovies.tsx` (2g/3a): bảng CRUD + modal wire mutations

**Files:**
- Rename+rewrite: `src/pages/admin/AdminMovies.jsx` → `.tsx`

**Interfaces — Consumes:** `useMovies`, `useAllShowtimes` (catalog); `useCreateMovie/useUpdateMovie/useDeleteMovie` (admin).

- [ ] **Step 1: Viết `AdminMovies.tsx`** — thay `getMovies/getAllShowtimes` + `load()` bằng `useMovies()`/`useAllShowtimes()`; `createMovie/updateMovie/deleteMovie` → `useCreateMovie().mutateAsync(body)` / `useUpdateMovie().mutateAsync({id, body})` / `useDeleteMovie().mutateAsync(id)` (bỏ `load()`; invalidate tự refetch). Giữ nguyên: `EMPTY`, `q` search, `usePagination`, `openNew/openEdit/set/save/doDelete` (guard "còn suất chiếu" giữ). Markup class `.adm-k__*`; form field `.adm-k__field`/`.adm-k__field-two`, error `.adm-k__formerr`, actions `.adm-k__modalact`. Kiểu state: `editing: Movie | "new" | null`, `form` theo `EMPTY`. Rồi `rm AdminMovies.jsx`.

- [ ] **Step 2: tsc + lint (0 warning) + prettier --write.** (Không đổi đuôi thêm ngoài file này — vẫn nên restart nếu HMR trắng.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AdminMovies.tsx
git rm src/pages/admin/AdminMovies.jsx
git commit -m "feat(GD2g/3): AdminMovies kinetic + mutations"
```

---

## Task 5 — `AdminRooms.tsx` (2g/3b)

**Files:** Rename+rewrite `AdminRooms.jsx` → `.tsx`.
**Consumes:** `useRooms`, `useCinemas`, `useAllShowtimes`; `useCreateRoom/useUpdateRoom/useDeleteRoom`.

- [ ] **Step 1: Viết `AdminRooms.tsx`** — pattern y hệt Task 4: hook thay fetch/`load()`; `useCreateRoom().mutateAsync(body)` / `useUpdateRoom().mutateAsync({id,body})` / `useDeleteRoom().mutateAsync(id)`. Giữ `TYPES`, `EMPTY`, `cinemaFilter`, `cinemaName` (useCallback), guard "còn suất chiếu". Markup `.adm-k__*`, toolbar có `.adm-k__filter` select. `rm AdminRooms.jsx`.

- [ ] **Step 2: tsc + lint + prettier --write.**

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AdminRooms.tsx && git rm src/pages/admin/AdminRooms.jsx
git commit -m "feat(GD2g/3): AdminRooms kinetic + mutations"
```

---

## Task 6 — `AdminShowtimes.tsx` (2g/3c)

**Files:** Rename+rewrite `AdminShowtimes.jsx` → `.tsx`.
**Consumes:** `useAllShowtimes`, `useMovies`, `useRooms`, `useCinemas`; `useCreateShowtime/useUpdateShowtime/useDeleteShowtime`; `ROOM_TYPE_PRICE` (lib/pricing).

- [ ] **Step 1: Viết `AdminShowtimes.tsx`** — hook thay fetch/`load()`; mutation `.mutateAsync`. Giữ `EMPTY`, roomMap/cinemaMap/movieMap, `roomLabel`, `set` (auto giá theo `ROOM_TYPE_PRICE[r.type]`), `save` (body có `bookedSeats` giữ), sort theo `time`. Markup `.adm-k__*`. `rm AdminShowtimes.jsx`.

- [ ] **Step 2: tsc + lint + prettier --write.**

- [ ] **Step 3: Screenshot verify** (một bảng CRUD + mở modal thêm) desktop+mobile; xoá script.

- [ ] **Step 4: Full gate + commit + push**

```bash
npx tsc --noEmit && npm run lint && npm run format:check && npx vitest run && npx playwright test && npm run build
git add src/pages/admin/AdminShowtimes.tsx && git rm src/pages/admin/AdminShowtimes.jsx
git commit -m "feat(GD2g/3): AdminShowtimes kinetic + mutations"
git push origin main
```

---

## Task 7 — `AdminBookings.tsx` (2g/4a): bảng + sửa ghế/hủy + seat-grid kinetic

**Files:** Rename+rewrite `AdminBookings.jsx` → `.tsx`.
**Consumes:** `useAllBookings`, `useMovies`, `useCinemas`, `useRooms`, `useAllShowtimes`; `useUpdateBooking`, `useDeleteBooking`; `buildSeatLayout/bookedSeatSet/priceOf/SERVICE_FEE` (lib/pricing).

- [ ] **Step 1: Viết `AdminBookings.tsx`** — hook thay 5 fetch; `deleteBooking` → `useDeleteBooking().mutateAsync({id, showtimeId})`; `updateBooking` → `useUpdateBooking().mutateAsync({id, body, showtimeId})`. Giữ nguyên logic sửa ghế: `sel`, `otherBooked` (useMemo, nguồn `bookings`), `openEdit/toggleSeat/editStd/editVip/editCpl/editSeatTotal/editTotal/saveSeats`. Sau `mutateAsync` **bỏ** cập nhật `setBookings` thủ công (invalidate lo refetch) — đóng modal `setEditing(null); setSel([])`. Markup bảng `.adm-k__*`; seat-grid `.sgm-k` (ô vuông, `.vip`/`.couple`/`.booked`/`.selected`), legend `.sgm-k__legend`, summary `.sgm-k__summary`. Kiểu `sel: Seat[]` (từ `types`), `editing: Booking | null`. `rm AdminBookings.jsx`.

- [ ] **Step 2: tsc + lint + prettier --write.**

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AdminBookings.tsx && git rm src/pages/admin/AdminBookings.jsx
git commit -m "feat(GD2g/4): AdminBookings kinetic + mutations + seat-grid"
```

---

## Task 8 — Dọn CSS cũ + smoke + review (2g/4b)

**Files:**
- Modify: `src/pages/admin/Admin.css` (xoá khối `.admin-*`/`.field-*`/`.sgm-*` cũ)
- Modify: `e2e/smoke.spec.ts` (thêm 1 test admin)

- [ ] **Step 1: Xoá class cũ** trong `Admin.css` — grep xác nhận không tsx nào còn dùng `.admin-`/`.field-row`/`.field-two`/`.modal-actions`/`.modal-error`/`.seat-grid-mini`/`.sgm-`(bản cũ). Chỉ giữ `.adm-k*` + `.sgm-k*`.

Run: `rg -n "admin-btn|admin-table|admin-stat|field-row|seat-grid-mini|modal-actions" src --glob '!*.css'`
Expected: 0 kết quả (không tsx nào dùng class cũ) → an toàn xoá.

- [ ] **Step 2: Thêm smoke admin** vào `e2e/smoke.spec.ts` (dùng `loginAdmin` đã có):

```ts
test("admin: vào bảng quản trị phim", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin");
  await expect(page.locator(".adm-k__side, .adm-k__nav").first()).toBeVisible();
  await page.getByRole("link", { name: "Phim" }).click();
  await expect(page).toHaveURL(/\/admin\/movies/);
  await expect(page.locator(".adm-k__table")).toBeVisible();
});
```
(Chỉ đọc — không thêm/sửa/xoá → không ghi db.json.)

- [ ] **Step 3: Full gate** (đủ 6, e2e giờ 11 test):

Run: `npx tsc --noEmit && npm run lint && npm run format:check && npx vitest run && npx playwright test && npm run build`
Expected: tất cả xanh; e2e 11 passed.

- [ ] **Step 4: Screenshot review** — chụp desktop+mobile: Overview, Movies (bảng + modal thêm), Bookings (modal sửa ghế). Gom Artifact `review-2g`. Xoá script trước commit.

- [ ] **Step 5: Commit + push**

```bash
git add src/pages/admin/Admin.css e2e/smoke.spec.ts
git commit -m "chore(GD2g/4): don CSS admin cu + smoke admin"
git push origin main
```

- [ ] **Step 6: Verify CI** qua API `https://api.github.com/repos/khanhnguyen1205/cinema-full/actions/runs?per_page=1` → conclusion `success`.

- [ ] **Step 7: Cập nhật memory** `professionalization-roadmap.md`: 2g xong, còn 2h polish+CLAUDE/README. Cập nhật dòng index `MEMORY.md`.

---

## Self-Review (đã chạy)

- **Spec coverage:** §A→Task1-8; §B→Task1; §C→Task2; §D→Task4-7; §E→Task3; §F→Task2+Task7; §H smoke→Task8; §I lát→khớp (2g/1=Task1-2, 2g/2=Task3, 2g/3=Task4-6, 2g/4=Task7-8). ✓
- **Placeholder:** không có "TBD"; các trang CRUD mô tả biến-đổi cụ thể (hook thay fetch, mutateAsync thay create/load) + class contract; code mới đầy đủ ở `admin.ts` (nơi interface quan trọng). ✓
- **Type consistency:** mutation nhận `{id, body}` / `{id, showtimeId}` / `id` — trùng khớp giữa admin.ts (Produces) và các page (Consumes). `useUpdateBooking`/`useDeleteBooking` nhận `showtimeId` optional để invalidate occupiedSeats. ✓
- **Rủi ro đã xử lý:** giữ song song `.admin-*` cũ trong Admin.css tới hết 2g/4 để app không vỡ giữa chừng (dọn ở Task 8).
