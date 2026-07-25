# GĐ4 — Tính năng 2: Search nâng cao (thiết kế)

**Ngày:** 2026-07-25
**Trạng thái:** Đã duyệt thiết kế, chuẩn bị viết plan.
**Giai đoạn:** GĐ4 (chiều sâu tính năng) — tính năng thứ 2, sau Review phim (`f17de79`).

## Mục tiêu

Nâng khả năng tìm kiếm của cinema-full lên "cả 3 hướng":

1. **Ô search toàn cục ở Navbar** — gõ từ bất kỳ trang nào, dropdown gợi ý phim / rạp / suất chiếu (kiểu command palette), nhảy nhanh tới kết quả.
2. **Trang `/search` hợp nhất** — tìm chung **Phim + Rạp + Suất chiếu** trong một chỗ, kết quả phân 3 nhóm.
3. **Nâng bộ lọc trang Movies** — thêm đa thể loại, khoảng điểm, khoảng thời lượng, định dạng phòng; đồng bộ URL; nút xóa lọc.

Xuyên suốt cả 3: **tìm không phân biệt dấu tiếng Việt** ("endgame", "dien bien phu", "imax" đều khớp).

## Nguyên tắc & ràng buộc

- **Hướng A (đã chốt):** lõi tìm kiếm dùng chung + 3 bề mặt mỏng, **toàn bộ client-side**.
- **Không thêm endpoint gateway, không migration, không dependency mới.** Tái dùng hook TanStack Query sẵn có (dữ liệu đã cache, staleTime 60s). Giữ nguyên hợp đồng HTTP.
- Nhất quán hệ thiết kế **Kinetic** (viền cứng, mono, `N°`, bone, `KineticHeading`, `Reveal`, `MovieCard`, thẻ `.venue-k`).
- Giữ **6 cổng CI xanh** mỗi lát (typecheck · lint 0-warning · format · vitest · e2e · build). Tôn trọng `prefers-reduced-motion`, a11y bàn phím, responsive mobile-first (review qua điện thoại).
- Ràng buộc smoke cũ giữ nguyên (placeholder `your@email.com` / `••••••••`, nút "Đăng nhập").

## Hiện trạng (điểm xuất phát)

- Navbar **chưa có** ô search toàn cục.
- Trang **Movies** đã có: tìm theo tên (khớp chuỗi con, `title.toLowerCase().includes`), lọc thể loại (1 chip), lọc thành phố + ngày (suy từ showtimes), sort tên/thời lượng. Đã dựng sẵn map `rows = {movieId, cityId, dateKey}` từ rooms/cinemas — tái dùng mẫu này.
- Trang **Cinemas** chỉ lọc theo TP; chưa tìm rạp.
- Field phim khai thác được: `title`, `description`, `duration`, `genre`, `rating?`.
- Toàn bộ lọc đang **client-side**; dữ liệu nhỏ (16 phim, 5 rạp, 52 suất).

## Kiến trúc

### Lõi tìm kiếm — `src/lib/search.ts` (thuần, không React/Prisma)

```ts
// Chuẩn hoá bỏ dấu tiếng Việt + hạ thường để so khớp không phân biệt dấu/hoa-thường.
// NFD tách dấu tổ hợp -> xoá ̀-ͯ -> đ/Đ -> d -> toLowerCase -> trim.
export function normalize(s: string): string;

// Chuỗi con đã chuẩn hoá có nằm trong haystack (đã chuẩn hoá) không.
export function matches(haystack: string, queryNorm: string): boolean;

// Điểm liên quan để XẾP HẠNG: khớp nguyên = 3, bắt đầu bằng q = 2, chứa q = 1, không = 0.
export function scoreMatch(haystack: string, queryNorm: string): number;
```

- Colocated `search.test.ts` (Vitest, không cần DB). Đây là phần logic thật, test kỹ nhất: bỏ dấu mọi nguyên âm tiếng Việt, đ→d, hoa/thường, chuỗi rỗng, có/không khớp, thứ tự điểm.
- Mọi nơi tìm theo tên (Movies, GlobalSearch, /search) gọi `normalize()`.

### Bản đồ file

| File | Việc |
|---|---|
| `src/lib/search.ts` + `.test.ts` | 🆕 lõi tìm kiếm |
| `src/components/GlobalSearch.tsx` + `.css` | 🆕 ô search Navbar + dropdown |
| `src/components/Navbar.tsx` | ✏️ nhúng GlobalSearch (desktop + trong menu mobile) |
| `src/pages/Search.tsx` + `.css` | 🆕 trang `/search` |
| `src/pages/Movies.tsx` + `.css` | ✏️ 4 lọc nâng cao + URL sync + normalize |
| `src/App.tsx` | ✏️ route `/search` |
| `e2e/smoke.spec.ts` | ✏️ +vài test đọc |

Không thêm endpoint, không migration, không dependency.

## Ba bề mặt

### 2.1 · `GlobalSearch` (Navbar)

- Vị trí: giữa `nav-k__links` và `nav-k__right`; trên **mobile** nằm trong menu hamburger.
- Input debounce ~150ms. Có query → **dropdown** tối đa **4 phim · 3 rạp · 4 suất sắp tới**, mỗi nhóm có tiêu đề mono (`PHIM` / `RẠP` / `SUẤT CHIẾU`), xếp theo `scoreMatch` giảm dần.
  - Phim → poster nhỏ + tên + genre → `/movie/:id`.
  - Rạp → tên + địa chỉ/TP → `/cinema/:id`.
  - Suất (khớp tên phim **hoặc** tên rạp, chỉ `time >= now`) → "Tên phim · 19:30 T7 25/07 · Rạp X" → `/seats/:id`.
- **A11y bàn phím**: `role="combobox"` + `aria-expanded`/`aria-controls`; danh sách `role="listbox"`; ↑↓ roving; Enter chọn mục đang focus; **Enter khi không focus mục nào** → `/search?q=...`; Esc đóng; click ngoài đóng (theo mẫu dropdown Navbar sẵn có).
- Dòng cuối dropdown: **"Xem tất cả kết quả cho '…' →"** → `/search?q=`.
- Rỗng/không khớp → "Không tìm thấy. Nhấn Enter để tìm nâng cao."
- Đang load dữ liệu → không mở dropdown.

### 2.2 · Trang `/search`

- Đọc `?q=` từ URL (**nguồn sự thật**). Ô search lớn ở đầu (đồng bộ `?q=`, gõ tiếp lọc tại chỗ qua `useSearchParams`).
- **3 khu** trong `<Section>` + `Reveal`, mỗi khu `KineticHeading` + đếm số:
  - **N°01 Phim** — `<Grid>` `MovieCard` (xếp theo score).
  - **N°02 Rạp** — thẻ `.venue-k` (mẫu từ Cinemas, tự chứa CSS).
  - **N°03 Suất chiếu** — danh sách suất **sắp tới** (phim + giờ + rạp + định dạng phòng) → `/seats/:id`.
- Khu Phim có nút **"Lọc chi tiết trên trang Phim →"** → `/movies?q=...` (chuyển tiếp query).
- Query rỗng → màn gợi ý "Nhập từ khoá để tìm phim, rạp, suất chiếu". Có query mà 0 kết quả tổng → empty state gợi ý bỏ bớt từ khoá. Khu nào 0 kết quả → **ẩn khu đó**.
- Loading Skeleton; error nút thử lại (mẫu Movies).

### 2.3 · Movies nâng bộ lọc

Giữ khối điều khiển viền cứng, thêm **hàng lọc nâng cao** (gập `<details>` "Lọc nâng cao" để gọn trên mobile):

- **Đa thể loại**: chip genre → **chọn nhiều** (bấm bật/tắt; không chọn = tất cả). Phim khớp nếu `genre ∈` tập chọn.
- **Khoảng điểm**: chip nhanh `Tất cả / ≥7 / ≥8 / ≥9`.
- **Khoảng thời lượng**: select `Tất cả / <90′ / 90–120′ / >120′`.
- **Định dạng phòng**: chip `2D / 3D / IMAX` (đa chọn) — phim khớp nếu **có suất** ở định dạng đó (suy `rooms`→`showtimes`).
- **Đồng bộ URL** toàn bộ trạng thái (`?q=&genres=&rating=&dur=&fmt=&city=&date=&sort=`) qua `useSearchParams` → chia sẻ/bookmark/back-forward hoạt động.
- Nút **"Xóa lọc"** hiện khi có ≥1 lọc bật; badge "N phim" giữ nguyên.
- Ô tìm-theo-tên cũ đổi sang dùng `normalize()`.

## Data flow

- **Không hook Query mới.** Tái dùng `useMovies` / `useCinemas` / `useAllShowtimes` / `useRooms` / `useCities`. Tìm kiếm = `useMemo` lọc/tính trên dữ liệu đã cache → tức thời, không gọi mạng khi gõ.
- **Làm giàu suất chiếu** (dropdown + /search + định dạng phòng): dựng map `roomId→room→cinema→city` một lần bằng `useMemo` (mẫu `rows` sẵn có trong `Movies.tsx`). "Sắp tới" = `time >= new Date().toISOString()`.
- **URL là nguồn sự thật** cho `/search` (`?q=`) và Movies (toàn bộ lọc). GlobalSearch chỉ giữ state input cục bộ + điều hướng.

## Xử lý lỗi & rìa

- Mỗi bề mặt có empty / error / loading riêng (Skeleton + thử lại theo mẫu Movies). Dropdown không mở khi đang load.
- Query rỗng/toàn khoảng trắng → không lọc (Movies hiện tất cả; /search hiện gợi ý; dropdown đóng).
- Ký tự đặc biệt trong `?q=` → encode/decode qua `useSearchParams`; `normalize()` không vỡ với chuỗi lạ.
- `prefers-reduced-motion`: `Reveal` đã tôn trọng.

## Testing

- **Unit (Vitest):** `search.test.ts` phủ `normalize`/`matches`/`scoreMatch`.
- **E2E (Playwright, chỉ đọc — thêm vào `smoke.spec.ts`):** (a) gõ ô Navbar → dropdown nhóm + Enter tới `/search?q=`; (b) `/search?q=avengers` render 3 khu; (c) Movies bật 1 lọc nâng cao (vd chip IMAX) → URL đổi + số phim đổi. Không ghi dữ liệu. Ràng buộc smoke cũ giữ nguyên.
- Giữ 6 cổng xanh; lint 0 warning (mẫu `const x = useMemo(()=>q.data ?? [],[q.data])`).

## Chia lát (mỗi lát = 1 commit, push thẳng main, 6 cổng xanh)

- **S1** — Lõi `lib/search.ts` + `search.test.ts` (thuần, chưa nối UI).
- **S2** — `GlobalSearch` + nhúng Navbar (dropdown phim/rạp/suất, a11y bàn phím, mobile trong hamburger).
- **S3** — Trang `/search` + route `App.tsx` (3 khu, đọc `?q=`).
- **S4** — Nâng lọc Movies (4 lọc + URL sync + Xóa lọc + normalize) + điều hướng `/movies?q=`.
- **S5** — Mở rộng e2e smoke + cập nhật `CLAUDE.md` (route `/search`, `lib/search.ts`, GlobalSearch).

## Verify & review

- Mỗi lát: screenshot headless Chrome desktop+mobile, gom vào **Artifact gallery** để mở trên điện thoại (`--virtual-time-budget=5000` chờ AppShell qua splash `fetchMe`).

## Ngoài phạm vi (YAGNI)

- Endpoint search server-side / Postgres `unaccent` (hướng B) — để dành nếu dữ liệu phình to.
- Fuzzy/chịu lỗi gõ sai (Fuse.js, hướng C).
- Tìm trong mô tả phim, tìm theo diễn viên/đạo diễn (dữ liệu chưa có).
