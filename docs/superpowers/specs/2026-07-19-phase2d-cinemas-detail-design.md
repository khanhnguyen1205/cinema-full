# GĐ2d — Redesign Cinemas + CinemaDetail (Kinetic + Query + TSX)

Ngày: 2026-07-19 · Giai đoạn 2 (Kinetic Cinematic Redesign), lát **2d**.
Spec GĐ2 tổng: `docs/superpowers/specs/2026-07-18-phase2-kinetic-redesign-design.md`.

## 1. Mục tiêu & phạm vi

Dựng lại hai trang **Cinemas** (`src/pages/Cinemas.jsx`) và **CinemaDetail**
(`src/pages/CinemaDetail.jsx`) theo ngôn ngữ **Kinetic Cinematic**, wire
**TanStack Query**, convert sang **TSX**.

**Bất biến (không rơi rớt):**

- Cinemas: lọc theo thành phố (chip "Tất cả" + từng TP), điều hướng thẻ →
  `/cinema/:id`.
- CinemaDetail: gom suất theo phim (`byMovie`), mỗi phim nhóm theo ngày, nút giờ
  → `/seats/:showtimeId`, tên phim → `/movie/:id`.
- 6 gate CI xanh mỗi lát: `typecheck` · `lint` (0 warning) · `format:check` ·
  `test:run` · `e2e` · `build`.

**Ngoài phạm vi:** đổi backend/deploy (GĐ3); thêm trường dữ liệu mới.

## 2. Hạ tầng Query (bổ sung)

`src/queries/keys.ts`:

- `qk.cinema(id) = ["cinema", id]`
- `qk.showtimesByCinema(id) = ["showtimes", "byCinema", id]`

`src/queries/catalog.ts`:

- `useCinema(id)` → `getCinema(id)`.
- `useShowtimesByCinema(id)` → `getShowtimesByCinema(id)`.

Cinemas dùng `useCities` + `useCinemas` + `useRooms` (đã có; `useRooms` để đếm số
phòng mỗi rạp). CinemaDetail thêm `useMovies` + `useRooms` (đã có). Unit test cho
key mới.

## 3. Cinemas.tsx — lưới thẻ số lớn

Bố cục đã chốt: **lưới thẻ số lớn** (không phải danh sách hàng N°).

- **Header**: nhãn mono "Hệ thống rạp" + `KineticHeading "Rạp chiếu phim"` + đếm
  rạp (số đỏ, theo bộ lọc).
- **Chip lọc thành phố** vuông (giống `genre-k-chip`): "Tất cả" + từng TP; active
  = **đảo màu bone**. Danh sách TP từ `useCities`.
- **Lưới thẻ `.venue-k`** (`<Grid>` hoặc grid riêng): mỗi thẻ là `<button>` →
  `/cinema/:id`, gồm:
  - **N° khổng lồ mờ** làm hình nền góc thẻ (watermark, `aria-hidden`);
  - **badge thành phố** (Tag) — tên TP từ `cinema.cityId`;
  - **tên rạp** (Bebas Neue);
  - **địa chỉ** (`cinema.address`);
  - **số phòng** (đếm rooms có `cinemaId === cinema.id` từ `useRooms`);
  - dòng "Xem lịch chiếu →".
  - Hover tactile (dịch + viền/đổ bóng cứng).
- Trạng thái: loading → `Skeleton` grid; rỗng sau lọc → "Không có rạp nào"; lỗi →
  thông báo + nút "Thử lại".
- Xoá `Cinemas.jsx` + class cũ (`.cinemas-section`, `.cinemas-title`,
  `.cinemas-cities`, `.cinema-card*`, `.cinemas-grid`, `.cinemas-empty`,
  `.genre-chip` dùng ở đây).

## 4. CinemaDetail.tsx — hero + khối phim có poster

Bố cục đã chốt: **hero header + khối phim có poster nhỏ**.

- **Hero**: `KineticHeading` tên rạp; địa chỉ + tên thành phố; hàng **thống kê**
  khối: **SỐ PHÒNG** (rooms lọc theo rạp) · **SỐ PHIM** (`byMovie.length`) ·
  **SỐ SUẤT** (`showtimes.length`).
- **Lịch chiếu** — mỗi phim là một khối (bọc `Reveal`):
  - **poster nhỏ** bên trái (`movie.poster`, fallback chữ cái đầu);
  - tên phim (→ `/movie/:id`) + `genre · duration phút`;
  - **các hàng ngày**: nhãn ngày (`fmtDate`) + lưới **nút giờ** (`fmtTime` +
    `roomType · giá₫`) → `/seats/:showtimeId`.
  - Giữ nguyên `byMovie`, gom ngày, sort giờ.
- Trạng thái: loading → `Spinner`; không có suất → "Rạp này chưa có suất chiếu".
- Xoá `CinemaDetail.jsx` + class cũ (`.cinema-detail-*`, `.cinema-movie-*`,
  `.cinema-date-*`, `.cinema-times`, `.time-btn`, `.cinema-empty`,
  `.section-label` cục bộ).

## 5. Chuyển động & a11y

- `Reveal` cho khối phim (CinemaDetail); hover tactile cho thẻ/chip/nút giờ;
  **tôn trọng `prefers-reduced-motion`**; chỉ animate `transform`/`opacity`.
- Chip/nút/thẻ là `<button>` thật; watermark N° `aria-hidden`; tương phản đạt
  chuẩn; responsive mobile-first (thẻ Cinemas về 1 cột; khối phim
  CinemaDetail: poster + lịch xếp gọn/ dọc trên mobile).

## 6. Kiểm thử & xác minh

- **Unit (Vitest):** key Query mới.
- **Playwright smoke (mở rộng):** `/cinemas` có h1 "Rạp chiếu phim" + ≥1
  `.venue-k`, bấm một chip TP lọc được (aria-pressed true, vẫn còn thẻ);
  `/cinema/:id` có tên rạp (heading) + ≥1 nút giờ chiếu.
- **Screenshot headless Chrome** desktop & mobile (script `.mjs` trong project,
  cuộn để `Reveal` hiện, `--virtual-time-budget`/networkidle chờ splash).

## 7. Chia lát (mỗi lát = 1 commit, push thẳng main)

1. **2d/1** — Query infra: `qk.cinema(id)`/`qk.showtimesByCinema(id)` +
   `useCinema`/`useShowtimesByCinema` + unit test.
2. **2d/2** — `Cinemas.tsx` lưới thẻ số lớn + `Cinemas.css`, wire Query, giữ lọc.
3. **2d/3** — `CinemaDetail.tsx` hero + khối phim có poster + `CinemaDetail.css`,
   wire Query, giữ lịch chiếu.
4. **2d/4** — mở rộng Playwright smoke Cinemas + CinemaDetail, verify screenshot,
   push.

## 8. Rủi ro / lưu ý

- Thêm `.tsx`/xoá `.jsx` → **HMR Vite hỏng, trang trắng**: kill :3000 +
  `rm -rf node_modules/.vite` + `npm start` (đã gặp nhiều lần ở 2c).
- `Reveal` ẩn khối dưới màn trong screenshot fullPage — script chụp phải **cuộn
  dần** trước khi chụp để verify.
- Script screenshot `.mjs` phải **xoá trước `format:check`** (prettier quét cả
  file gốc).
- Giữ **0 warning** ESLint; bỏ `useNavigate` nếu điều hướng chuyển hết vào thẻ
  con (tránh unused).
- Không commit `CLAUDE.md`/`README.md` (sửa tài liệu chưa commit).
- Cuối commit body: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
