# GĐ2g — Admin Panel · Kinetic "Operator Console" — Design Spec

**Ngày:** 2026-07-21 · **Trạng thái:** Đã duyệt

## A. Phạm vi & nguyên tắc

Redesign toàn bộ khu `/admin` sang hệ **Kinetic nhưng ở dạng "operator console"**: cùng chất liệu (nhãn mono, viền cứng 1–2px, đỏ dứt khoát, khối "bone" đảo màu) nhưng **tiết chế, dày đặc, tĩnh** — tối ưu để quét bảng và thao tác, KHÔNG hero khổng lồ, KHÔNG marquee. Đồng thời chuyển tầng dữ liệu sang **TanStack Query** và convert `.jsx`→`.tsx`.

| File | Hành động |
|------|-----------|
| `src/pages/admin/AdminLayout.jsx` → `.tsx` | Shell + sidebar kinetic |
| `src/pages/admin/AdminOverview.jsx` → `.tsx` | Stats + revenue + charts (recharts restyle) |
| `src/pages/admin/AdminMovies.jsx` → `.tsx` | Bảng CRUD + modal form |
| `src/pages/admin/AdminRooms.jsx` → `.tsx` | Bảng CRUD + modal form |
| `src/pages/admin/AdminShowtimes.jsx` → `.tsx` | Bảng CRUD + modal form |
| `src/pages/admin/AdminBookings.jsx` → `.tsx` | Bảng + sửa ghế/hủy |
| `src/components/admin/Pagination.jsx` → `.tsx` | Kinetic |
| `src/components/admin/ConfirmDialog.jsx` → `.tsx` | Kinetic |
| `src/pages/admin/Admin.css` | Viết lại theo `.adm-k` |
| `src/queries/admin.ts` | **Mới** — hooks list + mutations |

**Không đụng:** `services/api.ts` (dùng lại `create*/update*/delete*` sẵn có), backend, route trong `App.jsx` (vẫn `<AdminLayout>`/`<AdminOverview>`…), `AdminRoute`. `components/admin/Modal.jsx` giữ nguyên (đã re-export `ui/Modal`).

## B. Tầng dữ liệu — `src/queries/admin.ts`

- Tái dùng `useMovies` / `useCinemas` / `useRooms` / `useAllShowtimes` (đã có ở `queries/catalog.ts`).
- **`useAllBookings()`** — key `qk.allBookings = ["bookings","all"]` (tách khỏi `qk.myBookings`); gọi `getBookings()` (gateway trả tất cả cho admin).
- **Mutations** (mỗi cái `onSuccess: invalidateQueries` đúng key, bỏ `load()` thủ công):
  - `useCreateMovie` / `useUpdateMovie` / `useDeleteMovie` → invalidate `qk.movies`.
  - `useCreateRoom` / `useUpdateRoom` / `useDeleteRoom` → invalidate `qk.rooms`.
  - `useCreateShowtime` / `useUpdateShowtime` / `useDeleteShowtime` → invalidate `qk.showtimes` (key của `useAllShowtimes`).
  - `useUpdateBooking` / `useDeleteBooking` → invalidate `qk.allBookings` (+ `qk.occupiedSeats(showtimeId)` để mở lại ghế).
- Giữ **guard client-side** hiện có: chặn xoá movie/room khi còn suất chiếu tham chiếu (alert); giữ mọi validate form.

## C. Vỏ — Shell + Sidebar (`AdminLayout.tsx`)

- Trên cùng: `Navbar` (giữ). Dưới: **sidebar trái** cố định ~200px, **viền phải cứng 1px**; tiêu đề `QUẢN TRỊ` mono uppercase; 5 link mono uppercase. **Active = khối bone đảo màu** (`--surface-invert`, chữ đen). **Không đánh `N°`** (nav là tập đích, không phải chuỗi tuần tự — đánh số sẽ là trang trí).
- **Mobile (<900px):** sidebar biến thành **thanh tab cuộn ngang** (`overflow-x:auto`) phía trên nội dung; active vẫn đảo bone.
- Nền nội dung: tối, không glow/marquee (đây là công cụ).

## D. Trang danh sách (Movies / Rooms / Showtimes / Bookings)

- **Head** `.adm-k__head`: eyebrow mono (vd `QUẢN TRỊ · PHIM`) + tiêu đề Bebas **cỡ vừa** (`--fs-lg`/`--fs-xl` thấp, KHÔNG `--fs-2xl`) + đếm bản ghi mono.
- **Toolbar** `.adm-k__toolbar`: ô tìm mono viền cứng; select lọc (mũi tên SVG mono) nếu trang có; nút chính **khối bone** `+ THÊM…`.
- **Bảng** `.adm-k__table`: viền ngoài cứng; `thead` mono uppercase nhỏ nền tối; hàng ngăn bằng hairline `--border`; hover nền mờ; số/giá `font-variant-numeric: tabular-nums`; bọc `.adm-k__tablewrap { overflow-x:auto }` cho mobile. Thao tác hàng `.adm-k__rowact`: `Sửa` (ghost viền cứng) + `Xóa`/`Hủy` (đỏ).
- **Phân vai màu:** **bone** = hành động chính/xác nhận (Thêm, Lưu); **đỏ** = phá huỷ (Xóa, Hủy). Đỏ cũng là accent thương hiệu — nhất quán.
- Trạng thái rỗng `.adm-k__empty`, loading `Skeleton`.

## E. Overview (dashboard)

- **Stat tiles** `.adm-k__stat`: hộp viền cứng, số **Bebas đỏ** lớn + nhãn mono uppercase. 5 ô (Phim/Rạp/Phòng/Suất/Đơn).
- **Revenue cards** `.adm-k__rev`: 3 thẻ (Tổng doanh thu / Bắp nước / Tổng vé); một thẻ nhấn nền bone.
- **Charts** (giữ **recharts** — đã cài, chạy tốt): 2 `BarChart` (theo phim Top 6 · theo rạp) trong hộp `.adm-k__chartbox` viền cứng; restyle: font mono, cột đỏ **radius 0**, trục/tooltip nền tối token kinetic. Hằng màu đỏ vẫn hardcode (SVG fill không đọc CSS var ổn định) — dùng đúng `#e63030`.

## F. Modal & seat-grid

- Form trong `ui/Modal` (đã a11y): `.adm-k__field` nhãn mono + input/select/textarea viền cứng nền tối, focus viền đỏ; `.adm-k__field-two` lưới 2 cột (mobile 1 cột). Error `.adm-k__formerr` viền đỏ cứng. Actions `.adm-k__modalact`: Hủy (ghost) + Lưu (bone).
- **Seat-grid-mini** (sửa ghế đơn ở Bookings) `.sgm-k`: đồng bộ sơ đồ ghế booking — ô vuông mép cứng, VIP viền đỏ, đôi rộng gấp đôi, đã đặt gạch chéo, đang chọn **đảo bone**; legend mono; summary hàng dưới (ghế + loại + tổng đỏ).
- `ConfirmDialog`: viền cứng, nút Xóa đỏ, Hủy ghost.
- **Pagination** `.adm-k__pag`: mono, `‹ ›` nút ghost viền cứng, thông tin `từ–đến / tổng` tabular-nums.

## G. A11y & chi tiết

- Nav sidebar: `NavLink` giữ `aria-current` mặc định; focus-visible ring rõ.
- Bảng: `<th scope="col">`; nút thao tác có text rõ (không chỉ icon).
- Seat-grid: nút ghế `title` + `disabled` khi đã đặt (giữ hành vi cũ; không cần roving tabindex ở modal admin — phạm vi nhỏ).
- `prefers-reduced-motion`: tắt hiệu ứng vào (nếu có).
- Số tiền VND `.toLocaleString("vi-VN")` + `₫` (giữ).

## H. Ràng buộc smoke (giữ e2e xanh)

- Test hiện có "đăng nhập admin và thấy mục Quản trị" dựa vào `.nav-k__avatar` + link "Quản trị" (Navbar, **không đổi**) → không ảnh hưởng.
- Lát 2g/4 thêm smoke: vào `/admin` (đăng nhập admin) → sidebar/tab "Quản trị" hiện; điều hướng `/admin/movies` → bảng `.adm-k__table` hiện. **Chỉ đọc, không tạo/sửa/xoá** (không ghi db.json).

## I. Chia lát (chi tiết ở plan)

- **2g/1** — `queries/admin.ts` + `AdminLayout.tsx` shell/sidebar + `Pagination.tsx` + `ConfirmDialog.tsx` + `Admin.css` nền `.adm-k` (shell, table, toolbar, modal, pagination cơ bản).
- **2g/2** — `AdminOverview.tsx` wire Query + stats/revenue/charts kinetic.
- **2g/3** — `AdminMovies.tsx` + `AdminRooms.tsx` + `AdminShowtimes.tsx` wire mutations (3 bảng CRUD cùng khuôn).
- **2g/4** — `AdminBookings.tsx` (sửa ghế/hủy) + seat-grid-mini kinetic + smoke + dọn CSS cũ + review.

Mỗi lát: 6 gate CI xanh (typecheck · lint 0-warning · format · unit · e2e · build) + screenshot desktop/mobile.
