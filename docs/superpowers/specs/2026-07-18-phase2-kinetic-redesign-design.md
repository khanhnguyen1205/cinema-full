# GĐ2 — Kinetic Cinematic Redesign + Data Layer (Design Spec)

Ngày: 2026-07-18 · Giai đoạn 2 của lộ trình "chuyên nghiệp hoá" cinema-full.
Tiền đề: GĐ1 (nền móng kỹ thuật) đã xong — Vite + TypeScript + ESLint/Prettier +
Vitest + Playwright + CI, mọi gate xanh.

## 1. Mục tiêu & phạm vi

Tái sáng tạo **táo bạo** toàn bộ giao diện theo ngôn ngữ **Kinetic / neo-brutalist
điện ảnh**, đồng thời thay tầng dữ liệu bằng **TanStack Query** và convert toàn bộ
`pages` sang **TSX**.

- **Phạm vi:** tất cả trang — công khai (Home, Movies, MovieDetail, Cinemas,
  CinemaDetail, Booking wizard), auth (Login/Register), và admin.
- **Không thuộc GĐ2 (để GĐ3):** đổi backend sang Express+Prisma+DB, deploy, e2e
  đặt vé happy-path đầy đủ (cần DB test). GĐ2 giữ nguyên json-server + gateway.
- **Tiêu chí thành công:** (1) mỗi trang đạt "wow" nhìn thấy được; (2) 6 gate CI
  luôn xanh sau mỗi lát; (3) không rơi rớt tính năng hiện có; (4) responsive +
  a11y + reduced-motion đạt chuẩn nêu ở §7.

## 2. Ngôn ngữ thiết kế "Kinetic Cinematic"

Năm nguyên tắc:

1. **Cấu trúc là trang trí.** Đường kẻ lưới lộ rõ, rule/divider, viền cứng 1–2px,
   khối đóng hộp, mép "vé xé" (đục lỗ), dấu crop-mark ở góc.
2. **Chữ là nhân vật chính.** Display khổng lồ (Bebas Neue) tương phản cực mạnh với
   nhãn mono chữ hoa cỡ nhỏ. Tracking chặt cho tiêu đề, giãn rộng cho nhãn.
3. **Đơn sắc + một đỏ quyết đoán.** Nền gần đen, chữ trắng ngà, đỏ dùng dứt khoát.
   Có **khối đảo màu "bone" (trắng ngà nền, chữ đen)** cho vài mảng như vé in.
4. **Mô-típ điện ảnh–in ấn.** Cuống vé đục lỗ, barcode/scanline, đánh số `N°01`,
   marquee (dải chữ chạy).
5. **Chuyển động mạnh-có-kiểm-soát.** Marquee ticker, reveal-khi-cuộn, hover
   tactile (dịch/đảo), chuyển trang mượt, hero chữ stagger. **Tất cả** tôn trọng
   `prefers-reduced-motion`; chỉ animate `transform`/`opacity` để giữ 60fps.

**Font (self-host, bỏ CDN):** Bebas Neue (display) + Barlow (body) + **Space Mono**
(nhãn/số/ticket) — self-host qua các gói `@fontsource` (nhanh hơn, thân thiện CSP,
chạy offline). Gỡ `@import url(...)` Google Fonts trong `global.css`.

## 3. Hệ token + kiến trúc CSS

Tách `src/styles/global.css` thành lớp rõ ràng (giữ là plain CSS, không thêm
framework): **tokens → base/reset → utilities**. Có thể tách file
`styles/tokens.css`, `styles/base.css`, `styles/utilities.css` và `global.css`
`@import` chúng. Mỗi trang vẫn giữ CSS riêng nhưng chỉ tiêu thụ token (không
hardcode màu/spacing).

Nhóm token (CSS custom properties trong `:root`):

- **color:** `--bg`, `--surface`, `--surface-2`, `--surface-invert` (bone),
  `--border`, `--text`, `--text-muted`, `--text-dim`, thang đỏ
  `--red`/`--red-dark`/`--red-glow`, `--focus`.
- **spacing:** thang 4px `--sp-1 … --sp-12`.
- **typography:** `--font-display/-body/-mono`; thang cỡ (display dùng
  `clamp()` fluid) `--fs-…`; `--fw-…`; tracking `--tr-tight/-wide`.
- **radius:** brutalist ≈ 0–2px (`--r-0`, `--r-sm`).
- **border-width:** `--bw-1` (1px), `--bw-2` (2px).
- **shadow:** đổ bóng cứng offset đặc không blur `--shadow-hard`; phụ `--shadow-soft`.
- **motion:** `--dur-fast/-base/-slow`, `--ease-…`; toàn bộ animation bọc trong
  `@media (prefers-reduced-motion: reduce)` để tắt/rút gọn.
- **z-index:** thang `--z-nav/-dropdown/-modal/-toast`.
- **layout:** `--container-max`, `--gutter`.

## 4. Bộ component TypeScript (`src/components/ui/`)

Mỗi component 1 file `.tsx` có kiểu props rõ ràng, tài liệu ngắn, không phụ thuộc
lẫn nhau ngoài token.

- **Primitive:** `Button` (variant solid/outline/ghost/**invert**, size), `Tag`,
  `Badge`, `Card`, `Rule`, `Field` (Input/Select/Checkbox/Label), `Skeleton`,
  `Spinner`, `Modal` (nâng từ `components/admin/Modal` lên `ui/`, giữ
  `ConfirmDialog`), `IconButton`.
- **Primitive kinetic:** `Marquee` (ticker vô tận), `Reveal` (bọc
  IntersectionObserver), `TicketEdge` (mép đục lỗ), `Numbered` (`N°` index),
  `KineticHeading` (chữ stagger, tắt khi reduced-motion).
- **Layout & shell:** `Container`, `Section` (label + rule), `Grid`, `Navbar`
  (redesign, có menu mobile), `Footer` (redesign).
- **Route `/kitchen-sink`** (chỉ mount ở dev, không lên nav): render toàn bộ
  primitive ở mọi trạng thái để chụp ảnh review nhanh.

## 5. Tầng dữ liệu (TanStack Query + TSX)

- Thêm `@tanstack/react-query`; bọc `QueryClientProvider` trong `App` (đặt trong
  `ErrorBoundary`, ngoài `AuthProvider`) với default hợp lý (`staleTime`, `retry`,
  `refetchOnWindowFocus` cân nhắc). Bật React Query Devtools ở dev.
- `src/services/api.ts` giữ vai trò lớp fetch. Thêm `src/queries/` chứa hook có
  kiểu: `useMovies`, `useMovie(id)`, `useShowtimes(...)`, `useCinemas`,
  `useCinema(id)`, `useRooms`, `useConcessions`, `useOccupiedSeats(showtimeId)`
  (dùng `refetchInterval` thay `setInterval` thủ công ở Booking), `useMyBookings`;
  mutation: `useCreateBooking`, hold/release, admin CRUD (movies/rooms/showtimes).
- Quy ước **query key** tập trung (vd `qk.movies`, `qk.movie(id)`) + **invalidate**
  đúng key sau mutation (admin create/update/delete → invalidate list liên quan).
- Thay `fetch`-trong-`useEffect` từng trang bằng hook. Loading → `Skeleton`,
  error → state lỗi có nút thử lại, empty → empty state. Convert `.jsx→.tsx` khi
  động vào trang.
- Giữ nguyên hợp đồng API/gateway (credentials, scoping) — chỉ đổi cách gọi ở
  client, không đổi server.

## 6. Chẻ lát triển khai (mỗi lát ≥1 commit, luôn xanh CI)

Chiến lược đã chốt: **nền móng trước, rồi từng trang** (như GĐ1).

- **2a — Nền design-system:** token + tách CSS + self-host font + primitive +
  primitive kinetic + route `/kitchen-sink`. Chưa đổi layout trang; trang cũ vẫn
  chạy bằng class cũ (giữ tạm, gỡ dần ở các lát sau).
- **2b — Query infra + Home cờ đầu:** `QueryClientProvider` + toàn bộ hook có kiểu
  (chưa cần dùng hết) + **redesign Home** full kinetic (TSX + Query) làm bản mẫu
  tham chiếu. Chốt gu qua ảnh desktop & mobile.
- **2c — Movies + MovieDetail.**
- **2d — Cinemas + CinemaDetail.**
- **2e — Booking wizard** (áp Query cho occupied-seats/hold; giữ nguyên logic giữ
  ghế phía server; seat-map thao tác được bằng bàn phím).
- **2f — Auth** (Login/Register).
- **2g — Admin** (layout + bảng + form CRUD theo hệ mới; giữ mọi chức năng).
- **2h — Polish + tài liệu:** rà đồng bộ, gỡ CSS/class cũ còn sót, cập nhật
  `CLAUDE.md` + `README.md` cho tooling & UI mới.

Ranh giới lát có thể tách nhỏ thêm ở bước writing-plans nếu một lát quá lớn. Mỗi
lát kết thúc: TSX + Query (nếu trang có data) + redesign + e2e xanh + screenshot.

## 7. Ràng buộc chất lượng (áp cho mọi lát)

- **CI:** giữ 6 gate xanh — `typecheck`, `lint` (0 warning), `format:check`,
  `test:run`, `e2e`, `build`.
- **Reduced-motion:** mọi animation có nhánh `prefers-reduced-motion: reduce`.
- **Responsive:** mobile-first; kiểm ở 375px và desktop; Navbar có menu mobile.
- **A11y:** điều hướng bàn phím, focus ring rõ, tương phản chữ đạt AA, ARIA cho
  phần tử tương tác; **seat-map thao tác được bằng bàn phím**.
- **Testing:** mở rộng Playwright smoke cho luồng UI mới (vẫn read-only, không ghi
  `db.json`). Thêm unit (Vitest) cho logic thuần mới (vd builder query key). Cân
  nhắc test component nhẹ (jsdom) — tuỳ, không bắt buộc GĐ2.
- **Review:** mỗi lát gửi screenshot desktop + mobile (người dùng review qua điện
  thoại, không mở được localhost).

## 8. Rủi ro & giảm thiểu

- **Phạm vi lớn** → chẻ lát + giữ gate xanh + review ảnh từng bước.
- **Hiệu năng chuyển động** → chỉ animate transform/opacity, IntersectionObserver,
  hạn chế `will-change`.
- **Chạm trang 2 lần** (data rồi visual) → tránh bằng cách áp Query ngay tại lát
  redesign của mỗi nhóm trang (không tách lát data riêng cho từng trang).
- **Thêm dependency** (react-query, các gói @fontsource cho Bebas Neue/Barlow/Space
  Mono) → chấp nhận; self-host font đổi lại gỡ được request CDN.
- **Double-touch CSS cũ** → giữ class cũ ở 2a, gỡ dần theo từng lát, quét sạch ở 2h.

## 9. Ngoài phạm vi (YAGNI)

Không làm trong GĐ2: i18n, PWA, dark/light toggle (giao diện cố định "cinematic
dark", có khối bone cục bộ), thanh toán thật, review phim, gửi email vé, đổi
backend/DB. Các mục này thuộc GĐ3/GĐ4.
