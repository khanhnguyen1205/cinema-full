# GĐ2c — Redesign Movies + MovieDetail (Kinetic + Query + TSX)

Ngày: 2026-07-19 · Giai đoạn 2 (Kinetic Cinematic Redesign), lát **2c**.
Spec GĐ2 tổng: `docs/superpowers/specs/2026-07-18-phase2-kinetic-redesign-design.md`.

## 1. Mục tiêu & phạm vi

Dựng lại hai trang **Movies** (`src/pages/Movies.jsx`) và **MovieDetail**
(`src/pages/MovieDetail.jsx`) theo ngôn ngữ **Kinetic Cinematic**, wire
**TanStack Query**, convert sang **TSX**, **tái dùng `MovieCard`** đã dựng ở 2b.

**Bất biến (không được rơi rớt):**

- Toàn bộ **logic lọc** của Movies giữ y hệt: search theo tên, chip thể loại
  (tự sinh từ dữ liệu), select thành phố + ngày (ngày phụ thuộc thành phố đang
  chọn), sắp xếp (tên A→Z/Z→A, thời lượng ↑/↓), và nhận `genre` lọc sẵn từ
  router `location.state` (Home điều hướng sang).
- Toàn bộ **phễu đặt vé** của MovieDetail giữ y hệt: chọn thành phố → rạp →
  ngày → giờ, các default khi đổi cấp trên, nút "Đặt vé" điều hướng
  `/seats/:showtimeId`.
- 6 gate CI xanh sau mỗi lát: `typecheck` · `lint` (0 warning) ·
  `format:check` · `test:run` · `e2e` · `build`.

**Ngoài phạm vi:** đổi backend/deploy (GĐ3); thêm trường dữ liệu phim mới (diễn
viên/đạo diễn) — dữ liệu phim vẫn chỉ là `title, genre, duration, rating,
description, poster`.

## 2. Hạ tầng Query (bổ sung)

`src/queries/keys.ts` — thêm key:

- `qk.rooms = ["rooms"]`
- `qk.movie(id) = ["movie", id]`
- `qk.showtimesByMovie(id) = ["showtimes", "byMovie", id]`

`src/queries/catalog.ts` — thêm hook (bọc helper `services/api`):

- `useRooms()` → `getRooms()` (Movies + Detail map room→cinema→city).
- `useMovie(id)` → `getMovie(id)`.
- `useShowtimesByMovie(id)` → `getShowtimes(id)` (suất của một phim).

Unit test (`keys.test.ts` hoặc mở rộng test hiện có) kiểm hình dạng key mới,
khớp cách 2b test `qk`.

## 3. Movies.tsx — dải điều khiển ngang (nâng cấp kinetic)

Bố cục đã chốt: **dải điều khiển ngang** (không phải sidebar rail).

- **Header biên tập**: nhãn mono `DANH MỤC PHIM`, `KineticHeading` "TẤT CẢ
  PHIM", số đếm phim (số đỏ, cập nhật theo bộ lọc).
- **Thanh điều khiển** = khối viền cứng gom: ô search có icon; hàng **chip thể
  loại vuông**, active = **đảo màu (bone)**; ba `<select>` (Tất cả thành phố /
  Tất cả ngày / Sắp xếp) kiểu mono có `aria-label`.
- **Lưới kết quả**: `<Grid min="200px">` + `MovieCard`. Trạng thái:
  - loading → lưới `Skeleton`;
  - rỗng (không khớp lọc) → khối "Không tìm thấy phim nào" + gợi ý đổi lọc;
  - lỗi tải → thông báo + nút "Thử lại" (`refetch`).
- State & memo lọc **bê nguyên** từ bản cũ (`visible`, `genres`, `cityIds`,
  `dateKeys`, `movieIdsByShowtime`, `fmtDate`), chỉ đổi nguồn dữ liệu từ
  `useState+useEffect` sang các hook Query (`useMovies`, `useAllShowtimes`,
  `useRooms`, `useCinemas`, `useCities`) và bọc `useMemo` cho mảng phái sinh để
  qua `exhaustive-deps`.
- `Movies.css` viết lại theo kinetic; **xoá các class `.movie-card*` cũ** (đã
  thay bằng `.movie-k` của `MovieCard`).

## 4. MovieDetail.tsx — hero chia đôi + panel vé dính + CHI TIẾT

Bố cục đã chốt: **hero chia đôi + panel đặt vé dính (sticky) trên desktop**,
kèm khu **CHI TIẾT** dưới hero. Mobile: mọi thứ xếp dọc, panel về luồng thường.

### 4.1 Hero chia đôi

- **Trái**: poster làm nền (gradient phủ), `KineticHeading` tiêu đề, hàng meta
  (⭐điểm · thể loại · thời lượng PHÚT), mô tả ngắn.
- **Phải**: **panel đặt vé "bone"** (khối đảo màu, mép cuống vé bằng
  `TicketEdge`): TP + rạp kiểu `Field`/select; ngày là hàng nút khối; giờ là
  lưới nút khối (hiện `type` phòng + giá); nút **ĐẶT VÉ** (disabled tới khi chọn
  giờ). Panel `position: sticky` khi cuộn trên desktop.

### 4.2 Khu CHI TIẾT (dưới hero, các `Section` đánh số)

- **N°01 — Tóm tắt + thông số**: mô tả phim (đoạn lớn) + bảng thông số:
  **ĐIỂM** (số đỏ khổng lồ), **THỂ LOẠI**, **THỜI LƯỢNG**, **ĐỊNH DẠNG** (các
  `type` phòng có suất cho phim: 2D/3D/IMAX — suy từ `useRooms` + suất). Chỉ
  dùng dữ liệu sẵn có, không bịa.
- **N°02 — Rạp đang chiếu**: các rạp có suất cho phim (suy từ suất đã enrich)
  dạng khối `N°`, bấm điều hướng `/cinema/:id`.
- **N°03 — Phim cùng thể loại**: strip `MovieCard` cùng `genre` (trừ phim hiện
  tại) từ `useMovies`; ẩn nếu không có phim liên quan.

### 4.3 Logic

Bê nguyên phễu: `enriched` (showtimes + room + cinema + cityId + dateKey),
`firstCinemaOf`/`firstDateOf`/`cinemaName`, các default khi đổi TP/rạp/ngày,
`cityIds`/`cinemaIds`/`dateKeys`/`times`. Đổi nguồn sang Query
(`useMovie(id)`, `useShowtimesByMovie(id)`, `useRooms`, `useCinemas`,
`useCities`). Loading → skeleton/spinner; lỗi → thông báo + Thử lại.
`MovieDetail.css` viết lại kinetic.

## 5. Chuyển động & a11y

- `Reveal` (IntersectionObserver) cho các Section CHI TIẾT; hover tactile cho
  card/nút; **tôn trọng `prefers-reduced-motion`**; chỉ animate
  `transform`/`opacity` để giữ 60fps.
- Chip/nút ngày/giờ là `<button>` thật; `<select>` có `aria-label`; panel dính
  không bẫy tiêu điểm bàn phím; tương phản đạt chuẩn.
- Responsive mobile-first (người dùng review qua điện thoại): thanh điều khiển
  Movies xuống hàng gọn; hero Detail và panel xếp dọc.

## 6. Kiểm thử & xác minh

- **Unit (Vitest):** key Query mới trong `keys.ts`.
- **Playwright smoke (mở rộng):** `/movies` có h1 "Tất cả phim" + ≥1 `.movie-k`,
  và bấm một chip thể loại lọc được lưới; `/movie/:id` có tiêu đề phim + panel
  đặt vé + ≥1 nút giờ chiếu.
- **Screenshot headless Chrome** desktop & mobile mỗi lát (dùng
  `--virtual-time-budget=5000` chờ AppShell qua splash `fetchMe`).

## 7. Chia lát (mỗi lát = 1 commit, push thẳng main)

1. **2c/1** — Query infra: `qk.rooms`/`qk.movie(id)`/`qk.showtimesByMovie(id)` +
   `useRooms`/`useMovie`/`useShowtimesByMovie` + unit test.
2. **2c/2** — `Movies.tsx` redesign kinetic + `Movies.css` (xoá `.movie-card`
   cũ), wire Query, giữ logic lọc.
3. **2c/3** — `MovieDetail.tsx` redesign (hero chia đôi, panel bone sticky, 3 khu
   CHI TIẾT) + `MovieDetail.css`, wire Query, giữ logic phễu.
4. **2c/4** — mở rộng Playwright smoke Movies + MovieDetail, verify screenshot,
   push.

## 8. Rủi ro / lưu ý

- Đổi `vite.config.mjs`/alias hay cài dep mới cần **restart web server** (có khi
  `rm -rf node_modules/.vite`). Lát 2c không thêm dep nên rủi ro thấp.
- Script screenshot `.mjs` phải **xoá trước `format:check`** (prettier quét cả
  file gốc), hoặc để trong đường bị `.prettierignore` bỏ qua.
- Giữ **0 warning** ESLint (lint chỉ exit≠0 khi có ERROR) — luôn đọc output.
- `CLAUDE.md` + `README.md` đang có sửa tài liệu chưa commit (người dùng bảo
  không cần commit) — không vô tình commit kèm.
