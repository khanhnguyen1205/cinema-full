# Mở rộng hệ thống nhiều rạp / nhiều phòng — Design

**Ngày:** 2026-07-11
**Phạm vi:** Mở rộng mô hình dữ liệu và luồng đặt vé phía khách hàng từ "1 rạp" thành hệ thống nhiều thành phố → nhiều rạp → nhiều phòng, có giá theo loại phòng và ghế VIP. **Chưa** làm trang admin, **chưa** làm thanh toán.

## Mục tiêu

1. Dữ liệu hỗ trợ: Thành phố → Rạp → Phòng (có layout ghế + loại) → Suất chiếu.
2. Đặt vé từ **2 hướng**: từ Phim (chọn thành phố/rạp/suất) và từ Rạp (xem phim tại rạp).
3. **Giá theo loại phòng** (2D/3D/IMAX) và **ghế VIP** (đắt hơn).
4. Ghế đặt được suy ra từ layout phòng + bookings (Phương án B) — bỏ bảng `seats` và vòng PATCH.

## Mô hình dữ liệu (`db.json`)

### Collection mới
```jsonc
cities:  { id, name }                    // TP.HCM, Hà Nội, Đà Nẵng
cinemas: { id, cityId, name, address }   // CGV Vincom Đồng Khởi, Lotte Nam Sài Gòn…
rooms:   { id, cinemaId, name, type, rows, cols, vipRows }
         // type: "2D" | "3D" | "IMAX"
         // rows: số hàng (A, B, …), cols: số ghế mỗi hàng
         // vipRows: mảng chữ hàng VIP, vd ["E","F","G"]
```

### Sửa collection cũ
```jsonc
showtimes: { id, movieId, roomId, time, price, bookedSeats }
           // BỎ field "room" (chuỗi). Thêm roomId, bookedSeats.
           // price = giá ghế THƯỜNG, seed theo loại phòng của room.
           // bookedSeats: mảng seatNumber đã bán sẵn (demo occupancy), vd ["A3","B4"]
bookings:  { id, movieId, showtimeId, cinemaId, roomId, seats, seatTypes,
             userId, userName, totalPrice, createdAt }
           // seats: mảng seatNumber. seatTypes: map/2 mảng để tính lại giá nếu cần.
```

### Bỏ hẳn
- Collection `seats` (không còn dùng — ghế suy ra từ layout phòng).
- Service `getSeats`, `updateSeat` trong `api.js`.

## Quy tắc giá

- **Giá ghế thường** = `showtime.price`, seed theo loại phòng: 2D = 75.000₫, 3D = 95.000₫, IMAX = 120.000₫.
- **Giá ghế VIP** = `round(showtime.price × 1.3 / 1000) × 1000` (làm tròn nghìn).
- Phí dịch vụ giữ 15.000₫ (như hiện tại).
- Tổng = Σ(ghế thường × giá thường) + Σ(ghế VIP × giá VIP) + phí dịch vụ.

## Mô hình ghế (Phương án B)

- Phòng định nghĩa lưới `rows × cols`. Hàng đánh chữ A, B, C… ghế = `${row}${col}` (A1, A2…).
- Ghế **VIP** nếu hàng thuộc `room.vipRows`.
- Ghế **đã đặt** cho 1 suất = hợp của:
  - `showtime.bookedSeats` (bán sẵn demo), và
  - tất cả `booking.seats` có `showtimeId` trùng.
- Khi xác nhận: **chỉ POST 1 booking** (kèm cinemaId, roomId, seats, seatTypes, totalPrice). Không PATCH ghế → hết lỗi race/rollback.

## Luồng & UI

### Điểm vào 1 — Từ phim (nâng cấp `MovieDetail`)
Chọn phim → panel đặt vé: chọn **Thành phố** → **Rạp** (lọc theo thành phố, chỉ rạp có suất của phim) → **Ngày** → **Suất** (hiện giờ + phòng + loại + giá) → nút Đặt vé → `SeatSelection`.

### Điểm vào 2 — Từ rạp (trang mới)
- **`/cinemas`** (Rạp): duyệt rạp nhóm theo thành phố; bộ lọc thành phố.
- **`/cinema/:id`**: trang 1 rạp — thông tin rạp + danh sách phim đang chiếu tại rạp + suất → chọn suất → `SeatSelection`.
- Navbar thêm mục **"Rạp"** (`/cinemas`).

### `SeatSelection` (refactor)
- Header hiển thị: phim, **Rạp · Phòng · Loại**, ngày/giờ.
- Sinh lưới ghế từ layout phòng; phân biệt Thường / VIP / Đang chọn / Đã đặt (4 trạng thái trong chú thích).
- Bảng giá tách dòng: Ghế thường (×n), Ghế VIP (×m), Phí dịch vụ, Tổng.
- Xác nhận → POST 1 booking.

## Service (`src/Services/api.js`)
Thêm: `getCities`, `getCinemas(cityId?)`, `getCinema(id)`, `getRooms(cinemaId?)`, `getRoom(id)`, `getShowtimesByCinema(cinemaId)`, `getShowtimesByRoom(roomId)`. Giữ `getShowtimes(movieId)`, `getMovie(s)`, `createBooking`, `getBookings`. Xóa `getSeats`, `updateSeat`. Cập nhật `MyTickets` để lấy thêm rạp/phòng.

## Dữ liệu mẫu (seed)
- 3 thành phố: TP.HCM, Hà Nội, Đà Nẵng.
- ~5 rạp trải các thành phố (CGV, Lotte, BHD, Galaxy…), mỗi rạp có địa chỉ.
- ~10 phòng: mix 2D/3D/IMAX, mỗi phòng có layout (vd 2D: 8×12, IMAX: 10×14) và vipRows.
- Suất chiếu: mỗi phim có nhiều suất ở nhiều phòng/rạp/thành phố khác nhau, ngày trong tương lai (từ 15/07/2026).
- Vài `bookedSeats` để sơ đồ ghế trông thật.
- Migrate 3 booking cũ: bổ sung cinemaId/roomId hợp lệ.

## Ngôn ngữ
Toàn bộ copy mới bằng tiếng Việt (khớp phần đã Việt hóa). Giữ tên thương hiệu/loại (CGV, IMAX…).

## Ngoài phạm vi (làm sau)
Trang admin (CRUD), thanh toán, đánh giá phim, dịch nội dung `db.json` (mô tả phim…).

## Rủi ro / lưu ý
- Đây là refactor lớn: đổi schema `db.json`, sửa `MovieDetail`, `SeatSelection`, thêm 2 trang, sửa `api.js`, `MyTickets`, `Navbar`.
- Không có migration tự động — thay `db.json` trực tiếp bằng dữ liệu mẫu mới (đã gồm bookings cũ đã cập nhật).
- json-server: quan hệ nhiều cấp resolve client-side (rạp→phòng→suất). Chấp nhận nhiều lời gọi fetch, tối ưu sau nếu cần.
