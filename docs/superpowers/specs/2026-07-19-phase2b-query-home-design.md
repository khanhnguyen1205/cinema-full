# GĐ2b — Query Infra + Home Cờ Đầu (Kinetic) — Design Spec

Ngày: 2026-07-19 · Lát 2b của GĐ2 (Kinetic Cinematic Redesign).
Tiền đề: GĐ2a (nền design-system) đã xong — token + primitive `ui/` + kinetic
(`Marquee`/`Reveal`/`TicketEdge`/`Numbered`/`KineticHeading`) + layout
(`Container`/`Section`/`Grid`) + `Modal` a11y + route dev `/kitchen-sink`. Mọi
gate CI xanh (55 unit test).

## 1. Mục tiêu & phạm vi

Dựng **tầng dữ liệu TanStack Query** (hạ tầng dùng chung cho cả GĐ2) và
**redesign trang Home** theo ngôn ngữ Kinetic Cinematic làm **bản mẫu tham chiếu**
cho các lát trang sau. Bao gồm redesign **Navbar + Footer** (khung shell) để Home
đồng nhất tông từ đầu tới cuối.

**Trong phạm vi 2b:**

- Cài `@tanstack/react-query` (+ devtools DEV), `QueryClientProvider` trong `App`.
- Registry query-key `qk.*` có kiểu + **các hook Home cần** (movies/cinemas/cities/
  showtimes). Hook khác (movie chi tiết, rooms, concessions, occupied-seats,
  bookings, mutation) **để lát dùng tới** (2c–2g) — YAGNI.
- `Home.jsx → Home.tsx`, redesign kinetic full, wired vào Query hooks.
- `Navbar.jsx → Navbar.tsx` + `Footer.jsx → Footer.tsx`, redesign kinetic; **giữ
  nguyên logic `useAuth`/điều hướng**.
- `MovieCard.tsx` — component card phim dùng lại (Home nay, Movies 2c sau).

**Ngoài phạm vi 2b** (để lát/GĐ sau): redesign Movies/MovieDetail/Cinemas/
CinemaDetail/Booking/Auth/Admin (2c–2g); dựng hết hook Query; đổi backend/DB
(GĐ3); i18n/PWA/light-toggle (GĐ4). Không đổi hợp đồng API/gateway — chỉ đổi cách
gọi ở client.

**Tiêu chí thành công:** (1) Home đạt "wow" nhìn thấy được, đồng nhất tông cả
Navbar/Footer; (2) 6 gate CI xanh sau mỗi commit; (3) không rơi rớt tính năng
Home hiện có (6 vùng nội dung + carousel + điều hướng); (4) responsive 375px +
desktop, a11y, reduced-motion đạt chuẩn §6.

## 2. Tầng dữ liệu (TanStack Query)

**Provider.** `App.tsx` bọc `<QueryClientProvider client={queryClient}>` **bên
trong `ErrorBoundary`, bên ngoài `AuthProvider`** (thứ tự:
`ErrorBoundary > QueryClientProvider > AuthProvider > AppShell`). `ReactQueryDevtools`
chỉ mount khi `import.meta.env.DEV`.

**QueryClient default** (`src/queries/client.ts`):

- `staleTime: 60_000` (catalog ít đổi trong 1 phiên).
- `retry: 1`.
- `refetchOnWindowFocus: false` (tránh refetch phiền cho dữ liệu tĩnh; Booking
  sẽ tự đặt `refetchInterval` riêng ở lát 2e).
- `gcTime` để mặc định.

**Query-key registry** (`src/queries/keys.ts`) — hằng có kiểu, một nguồn sự thật:

```ts
export const qk = {
  movies: ["movies"] as const,
  cinemas: ["cinemas"] as const,
  cities: ["cities"] as const,
  showtimes: ["showtimes"] as const,
};
```

(Các key có tham số như `movie(id)`, `occupiedSeats(id)` thêm khi lát sau cần —
giữ cùng file, cùng quy ước.)

**Hook Home** (`src/queries/catalog.ts`): mỗi hook bọc hàm `api.ts` tương ứng,
trả về `UseQueryResult` có kiểu.

- `useMovies()` → `api.getMovies()` — key `qk.movies`.
- `useCinemas()` → `api.getCinemas()` — key `qk.cinemas`.
- `useCities()` → `api.getCities()` — key `qk.cities`.
- `useAllShowtimes()` → `api.getAllShowtimes()` — key `qk.showtimes`.

**Test.** Unit Vitest cho `keys.ts` (thuần): xác nhận cấu trúc key ổn định (dùng
làm hợp đồng cho invalidate sau này). Không cần test hook (cần MSW/DOM — hoãn).

## 3. Redesign Home (`Home.tsx`)

Convert `.jsx→.tsx`. Thay 4 `useState` + `Promise.all`-trong-`useEffect` bằng
Query hooks. Trạng thái:

- **Loading:** khối `Skeleton` cho hero + lưới card (không spinner toàn trang, để
  cảm giác nhanh).
- **Error:** state lỗi gọn có nút "Thử lại" (gọi `refetch`), copy tiếng Việt.
- **Empty:** nếu không có phim → empty state (hiếm, nhưng xử lý).

**Cấu trúc vùng (giữ đủ 6 vùng nội dung, reimagine kinetic):**

1. **Navbar** (§5).
2. **HERO — Kinetic Carousel.** `featured = movies.slice(0, 5)`. Tự xoay 6s;
   **pause khi hover**; **KHÔNG tự xoay khi `prefers-reduced-motion: reduce`**
   (chỉ điều hướng tay). Thành phần: tiêu đề phim bằng `KineticHeading` khổng lồ
   (Bebas, stagger — tắt stagger khi reduced-motion); hàng nhãn mono kiểu cuống vé
   (★`rating.toFixed(1)` · `genre` · `duration` PHÚT); poster nền cạnh phải trong
   khối "bone"/khung có **crop-mark** góc + lớp **scanline** mờ; CTA đỏ "Đặt vé"
   (→ `/movie/:id`) + `Button` ghost "Chi tiết"; **điều hướng bằng tab số
   `N°01…N°05`** (thay dot cũ) — mỗi tab là `<button>` có `aria-label`; mũi tên
   ‹ › prev/next. Chuyển slide chỉ animate `opacity`/`transform`.
3. **Marquee ticker.** Dải `Marquee` (primitive) chạy tên các phim đang chiếu, làm
   băng ngăn dưới hero. Tắt chuyển động khi reduced-motion (primitive đã có).
4. **Phim đang chiếu.** `Section` (label "Suất chiếu hôm nay", `index N°01`) + tiêu
   đề "Phim đang chiếu" + `Grid` các `MovieCard` (top 8) + link "Xem tất cả →"
   (→ `/movies`).
5. **Duyệt theo thể loại.** `Section` (`index N°02`) "Duyệt theo thể loại". Tile
   thể loại tự sinh từ dữ liệu (`genreStats`): nhãn mono + số phim + thanh/khối màu
   theo genre; click → `/movies` với `state:{ genre }` (giữ hành vi hiện có).
6. **Thống kê.** Dải số lớn mono: số Phim / Rạp / Thành phố / Suất chiếu (từ
   `useAllShowtimes().data.length`). Có thể dùng `Numbered`/khối bordered.
7. **Hệ thống rạp.** `Section` (`index N°03`) "Hệ thống rạp" + card rạp (N° + tên +
   thành phố resolve từ `cities` + mũi tên →, → `/cinema/:id`) + "Tất cả rạp →".
8. **CTA.** Khối **bone đảo màu** (`u-invert`) "Sẵn sàng cho suất chiếu tiếp
   theo?" + nút đỏ "Đặt vé ngay" (→ `/movies`).
9. **Footer** (§5).

CSS Home viết lại theo token (không hardcode màu/spacing), chỉ tiêu thụ biến từ
`tokens.css`. Giữ file `Home.css` colocated.

## 4. `MovieCard` (component dùng lại)

`src/components/MovieCard.tsx` — domain component (không thuộc `ui/` vì gắn model
phim). Props: `{ movie: Movie }`. Render: ảnh poster (fallback chữ cái đầu khi
thiếu/lỗi ảnh, `onError` ẩn `<img>`), `Badge` rating (★ + số), `Tag` genre, tên
phim, meta (`genre · duration phút`). Hover **tactile**: đổ bóng cứng offset +
dịch `translate` (tôn trọng reduced-motion). Click điều hướng `/movie/:id`. CSS
`MovieCard.css` colocated. Đây là card tái dùng ở Movies (2c).

## 5. Navbar + Footer (redesign, tsx)

**Navbar** (`Navbar.tsx`): logo "CINEMA" (Bebas + đỏ) → `/`; link điều hướng mono
chữ hoa (Trang chủ/Phim/Rạp/Vé); **menu hamburger ở mobile** (`≤` breakpoint):
nút toggle có `aria-expanded` + `aria-controls`, panel mở/đóng, đóng khi chọn link
hoặc Esc; vùng phải: avatar + tên khi đăng nhập (link `/tickets`, `/admin` nếu
admin, nút Đăng xuất) hoặc nút "Đăng nhập". **Giữ nguyên toàn bộ logic `useAuth`,
`logout`, điều hướng** — chỉ đổi trình bày. Sticky top, viền dưới, nền nền-đen.

**Footer** (`Footer.tsx`): bố cục mono tối giản, cột đánh số `N°`, điểm nhấn bone/
rule, bản quyền + liên kết tĩnh. Không thêm tính năng mới.

Cả hai reduced-motion an toàn (chỉ transition nhẹ). Class cũ của Navbar/Footer gỡ
theo (nếu không trang khác dùng) hoặc giữ tạm nếu còn trang cũ tham chiếu — quét
sạch ở 2h.

## 6. Ràng buộc chất lượng

- **CI:** 6 gate xanh mỗi commit — `typecheck`, `lint` (0 warning), `format:check`,
  `test:run`, `e2e`, `build`.
- **Reduced-motion:** mọi animation (hero autoplay/stagger, marquee, hover card,
  reveal) có nhánh `prefers-reduced-motion: reduce`; autoplay hero **tắt hẳn**.
- **Responsive:** mobile-first; kiểm 375px + desktop; Navbar có menu mobile hoạt
  động; Grid phim co cột; hero xếp dọc trên mobile.
- **A11y:** tab số & mũi tên hero là `<button>` có `aria-label`; carousel pause
  hover; focus ring rõ (token `--focus`); tương phản AA; menu mobile khai báo ARIA.
- **Testing:** Playwright smoke mở rộng (vẫn read-only): Home tải được + hero hiện
  tiêu đề + ≥1 `MovieCard` + toggle menu mobile. Unit Vitest cho `keys.ts`. (Test
  component nhẹ tuỳ chọn, không bắt buộc.)
- **Review:** chụp **desktop + mobile** gửi người dùng mỗi bước (review qua điện
  thoại, không mở được localhost).

## 7. Chẻ lát con (mỗi lát ≥1 commit, luôn xanh)

- **2b-1 — Query infra:** cài dep + `client.ts` + `keys.ts` + hook Home
  (`catalog.ts`) + `QueryClientProvider` trong `App.tsx` + devtools DEV + unit test
  `keys`. **Chưa đổi UI** (Home cũ vẫn chạy). Gate xanh.
- **2b-2 — Shell + card:** `MovieCard.tsx` + redesign `Navbar.tsx` + `Footer.tsx`
  (tsx). Verify trang cũ vẫn dùng Navbar/Footer đúng (Home/Movies/… vẫn render).
  Screenshot shell.
- **2b-3 — Home kinetic:** `Home.tsx` redesign đầy đủ wired Query hooks + CSS token
  + mở rộng Playwright smoke. Screenshot desktop+mobile gửi review. Push lát 2b.

(Ranh giới có thể tinh chỉnh ở writing-plans; ví dụ tách CSS lớn hoặc gộp 2b-2 vào
2b-3 nếu hợp lý.)

## 8. Rủi ro & giảm thiểu

- **Chạm Home 2 lần** (data rồi visual) → gộp Query + redesign vào cùng lát 2b
  (2b-1 chỉ hạ tầng, 2b-3 vừa wired vừa redesign).
- **Navbar/Footer đổi ảnh hưởng mọi trang** → chỉ đổi trình bày, giữ logic; verify
  các trang cũ vẫn render trong 2b-2 trước khi đụng Home.
- **Autoplay + a11y** → tắt autoplay khi reduced-motion, pause hover, nav tay.
- **Hiệu năng chuyển động** → chỉ animate `transform`/`opacity`, không `will-change`
  tràn lan.
- **CSS cũ còn sót** → gỡ dần, quét sạch ở 2h.

## 9. Ngoài phạm vi (YAGNI)

Không làm ở 2b: các trang khác (2c–2g); hook Query chưa cần; mutation/invalidate
(chưa có write trên Home); light/dark toggle; i18n/PWA; đổi backend. Giữ nguyên
json-server + gateway + hợp đồng API.
