# Trang Admin — Design

**Ngày:** 2026-07-11
**Phạm vi:** Trang quản trị `/admin` cho admin quản lý **Phim**, **Phòng**, **Suất chiếu** (CRUD đầy đủ) và **xem Đơn đặt vé** (chỉ đọc). Phân quyền theo role. **Rạp read-only** (không CRUD). Form dạng **modal**, bảng có **tìm kiếm/lọc**. Copy tiếng Việt.

## Phân quyền

- Thêm field **`role`** (`"admin"` | `"user"`) vào `users`. User cũ id 1 → `"user"`. Thêm admin: id 2 `{ fullName: "Quản trị viên", email: "admin@cinema.vn", password: "admin123", role: "admin" }`.
- `AuthContext` không đổi (đã lưu user đã strip password; `role` được giữ). Cần verify `role` còn sau login.
- Component mới **`src/Components/AdminRoute.jsx`**: `!user` → `<Navigate to="/login" state={{from}}/>`; `user.role !== "admin"` → `<Navigate to="/" replace/>`; ngược lại render children/Outlet.
- **Navbar**: thêm mục **"Quản trị"** trong dropdown avatar, chỉ hiện khi `user.role === "admin"`, link `/admin`.

## Routing (`src/App.jsx`)
Nested dưới `/admin`, bọc trong `AdminRoute`, dùng `AdminLayout` (sidebar + `<Outlet/>`):
- `/admin` (index) → `AdminOverview` — thẻ thống kê số phim/rạp/phòng/suất/vé.
- `/admin/movies` → `AdminMovies`.
- `/admin/rooms` → `AdminRooms`.
- `/admin/showtimes` → `AdminShowtimes`.
- `/admin/bookings` → `AdminBookings`.

## API bổ sung (`src/Services/api.js`)
- Movies: `createMovie(body)`, `updateMovie(id, patch)`, `deleteMovie(id)`.
- Rooms: `createRoom(body)`, `updateRoom(id, patch)`, `deleteRoom(id)`.
- Showtimes: `createShowtime(body)`, `updateShowtime(id, patch)`, `deleteShowtime(id)`.
- Dùng json-server: POST `/x`, PATCH `/x/:id`, DELETE `/x/:id`. Rạp giữ read-only (`getCinemas`, `getCities`).

## Component dùng chung
- **`src/Components/admin/Modal.jsx`** — overlay mờ + card giữa màn hình, prop `title`, `onClose`, `children`; đóng khi bấm nền/nút X/Esc.
- **`src/Components/admin/ConfirmDialog.jsx`** — modal xác nhận xóa (prop `message`, `onConfirm`, `onCancel`).
- Mỗi trang admin tự quản lý: ô **tìm kiếm** (state cục bộ) + (nếu có) **select lọc**; bảng; nút "Thêm"; mỗi hàng có "Sửa"/"Xóa".

## Ràng buộc xóa an toàn
- `deleteMovie`: chặn nếu tồn tại `showtime.movieId === id` → báo "Không thể xóa: còn N suất chiếu liên quan".
- `deleteRoom`: chặn nếu tồn tại `showtime.roomId === id` → báo tương tự.
- `deleteShowtime`: cho phép (kể cả khi có booking — chỉ là mock).
- Kiểm tra client-side (fetch showtimes) trước khi gọi delete.

## Chi tiết từng trang
### AdminOverview
Thẻ số liệu: Phim, Rạp, Phòng, Suất chiếu, Đơn vé (đếm từ các collection).

### AdminMovies
- Bảng: Tên · Thể loại · Thời lượng. Tìm kiếm theo tên.
- Modal form: `title`, `genre` (text/select), `duration` (number), `description` (textarea), `poster` (text, tùy chọn). Validate: title/genre/duration bắt buộc.
- Xóa: có guard.

### AdminRooms
- Bảng: Rạp · Tên phòng · Loại · Layout (`rows×cols`) · Hàng VIP. Tìm theo tên phòng/rạp; **lọc theo rạp** (select).
- Modal form: `cinemaId` (select rạp có sẵn), `name`, `type` (select 2D/3D/IMAX), `rows` (number), `cols` (number), `vipRows` (text "E,F,G" → mảng). Validate rows/cols > 0.
- Xóa: có guard.

### AdminShowtimes
- Bảng: Phim · Rạp·Phòng · Ngày · Giờ · Giá. Tìm theo tên phim; **lọc theo rạp** (select).
- Modal form: `movieId` (select), `roomId` (select, nhãn "Rạp · Phòng · Loại"), `date` (input date), `time` (input time), `price` (number — mặc định gợi ý theo `ROOM_TYPE_PRICE[room.type]`, sửa được). Ghép date+time → ISO `YYYY-MM-DDTHH:mm:00`. `bookedSeats` mặc định `[]`.
- Xóa: tự do.

### AdminBookings (chỉ đọc)
- Bảng: Mã · Khách (`userName`) · Phim · Rạp·Phòng · Ghế · Tổng tiền · Ngày chiếu. Tìm theo khách/phim.
- Enrich: nạp maps `movies`, `cinemas`, `rooms`, `showtimes` 1 lần để hiển thị tên.

## Giao diện
- `src/Pages/Admin/Admin.css` (dùng chung cho layout + bảng + modal). Tông "cinematic dark", sidebar trái, bảng gọn, modal nổi. Toàn bộ tiếng Việt. Giá VND `.toLocaleString("vi-VN") + ₫`.

## Ngoài phạm vi
CRUD rạp (read-only), thanh toán, sửa/xóa booking, quản lý user.

## Rủi ro / lưu ý
- Phân quyền chỉ ở client (không bảo mật thật) — chấp nhận với mock API.
- json-server PATCH/DELETE đơn giản; ràng buộc xóa kiểm tra client-side.
- Thêm dữ liệu qua UI sẽ ghi thẳng `db.json` (json-server) — không cần seed thủ công.
