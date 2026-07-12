# Nâng cấp Admin Panel — Design

Ngày: 2026-07-12
Trạng thái: Đã duyệt (chờ implement)

## Bối cảnh

Admin panel hiện có: Overview (chỉ đếm số lượng), Movies/Rooms/Showtimes (CRUD), Bookings (chỉ đọc + search). Các bảng render toàn bộ, chưa phân trang. Không có UI/chart library.

Spec này gồm 3 phần độc lập, làm theo thứ tự: **(1) Hủy & sửa đơn vé → (2) Phân trang → (3) Dashboard doanh thu**.

## Phần 1 — Hủy & sửa đơn vé (AdminBookings)

### API (`src/Services/api.js`)
Export thêm:
- `updateBooking(id, patch)` → dùng helper `patch` nội bộ sẵn có: `patch(\`/bookings/${id}\`, body)`
- `deleteBooking(id)` → dùng helper `del` nội bộ: `del(\`/bookings/${id}\`)`

### Bảng bookings
Thêm cột **"Thao tác"** cuối bảng với 2 nút: **Sửa ghế**, **Hủy**.

**Hủy đơn:**
- Mở `ConfirmDialog` (component sẵn có) với nội dung xác nhận (tiếng Việt).
- Xác nhận → `deleteBooking(id)` → cập nhật state (loại đơn khỏi `bookings`).
- Ghế tự động trống lại: "ghế đã bán" được suy ra từ chính `bookings` qua `bookedSeatSet`, nên không cần đụng `showtime.bookedSeats`.

**Sửa ghế:**
- Mở `Modal` (component sẵn có) chứa **lưới ghế thu nhỏ**.
- Dựng lưới bằng `buildSeatLayout(room)` cho phòng của đơn (`roomMap[b.roomId]`).
- Tập ghế đã đặt = `bookedSeatSet(showtime, allBookings)` **trừ đi ghế của chính đơn đang sửa** — để ghế cũ hiện dạng "đang chọn" và vẫn bấm được (nếu không, ghế của đơn hiện tại sẽ bị coi là "đã đặt" và khóa).
- Trạng thái chọn khởi tạo = ghế hiện tại của đơn.
- Toggle ghế → tính lại `seatTypes {standard, vip}` (đếm theo `isVip`) và `totalPrice` = tổng `priceOf(seat, base)` + `SERVICE_FEE` (khi có ít nhất 1 ghế), giống logic `SeatSelection`. `base = showtime.price`.
- Nút Lưu (disabled khi 0 ghế) → `updateBooking(id, { seats, seatTypes, totalPrice })` → cập nhật state → đóng modal.

### Tái sử dụng
Tách lưới ghế thành component nhỏ dùng chung nếu gọn (vd `SeatGrid`), hoặc render trực tiếp trong modal của AdminBookings. Ưu tiên giữ nhất quán style seat với `SeatSelection.css` nhưng ở kích thước thu nhỏ trong modal (style riêng trong `Admin.css`).

## Phần 2 — Phân trang (dùng chung mọi bảng admin)

### Hook `usePagination(items, pageSize)`
- Trả `{ pageItems, page, totalPages, setPage }`.
- Tự reset về trang 1 khi độ dài `items` thay đổi (sau search / xóa / thêm).
- Vị trí: `src/Components/admin/usePagination.js` (hoặc `src/lib/`).

### Component `Pagination`
- Props: `page`, `totalPages`, `onPage`, và thông tin range ("X–Y / N").
- UI: nút ‹ ›, số trang hiện tại/tổng, dòng đếm range. Ẩn khi `totalPages <= 1`.
- Style trong `Admin.css`, khớp dark theme.

### Áp dụng
- AdminMovies, AdminRooms, AdminShowtimes, AdminBookings.
- Phân trang chạy **sau** filter/search (phân trang trên danh sách `visible`).
- Page size mặc định **10 dòng**.

## Phần 3 — Dashboard doanh thu (AdminOverview)

### Thư viện
Cài **`recharts`** (`npm install recharts`). Khai báo bằng component, hợp React 18.

### Dữ liệu
Tính client-side từ `bookings`:
- Tổng doanh thu = Σ `totalPrice`.
- Tổng vé bán = Σ số phần tử `seats` (hoặc `seatTypes.standard + seatTypes.vip`).
- Doanh thu theo phim: group theo `movieId`, join `movieMap` lấy `title`, sort giảm dần, lấy **top 6**.
- Doanh thu theo rạp: group theo `cinemaId`, join `cinemaMap` lấy `name`.

### Trình bày
- Giữ các thẻ đếm hiện có (phim/rạp/phòng/suất/đơn).
- Thêm thẻ **Tổng doanh thu** và **Tổng vé bán** (format VND `.toLocaleString("vi-VN")` + `₫`).
- **BarChart** doanh thu theo phim (top 6).
- **BarChart** hoặc **PieChart** doanh thu theo rạp.
- Style dark theme: dùng token `--red` cho màu chính, `--text-muted` cho trục/nhãn, nền khớp `Admin.css`. Tooltip format VND.

## Ngoài phạm vi (YAGNI)
- Không sửa userName/khách hàng của đơn (chỉ sửa ghế).
- Không phân trang server-side (json-server) — chỉ client-side.
- Không lọc doanh thu theo khoảng thời gian (có thể thêm sau).
- Không đụng `showtime.bookedSeats` khi hủy/sửa (ghế bán suy ra từ bookings).

## Ghi chú
- Copy tiếng Việt xuyên suốt, khớp ngôn ngữ các trang admin hiện có.
- Không có test/linter trong dự án — verify thủ công qua UI (`npm start` + json-server).
