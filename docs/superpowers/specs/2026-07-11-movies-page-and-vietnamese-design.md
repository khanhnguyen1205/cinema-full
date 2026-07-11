# Trang Movies + Đồng bộ ngôn ngữ (tiếng Việt) — Design

**Ngày:** 2026-07-11
**Phạm vi:** Thêm trang danh sách phim có tìm kiếm/lọc/sắp xếp; Việt hóa Home + Navbar.

## Mục tiêu

1. Biến link "Movies" (đang trỏ `/`) thành một trang danh mục phim thật tại `/movies`.
2. Cho phép người dùng **tìm kiếm** theo tên, **lọc** theo thể loại, **sắp xếp** danh sách.
3. Đồng bộ ngôn ngữ về **tiếng Việt** cho Home và Navbar (các trang còn lại để bước sau).

## Trang Movies

- **File:** `src/Pages/Movies.jsx` + `src/Pages/Movies.css`.
- **Route:** thêm `<Route path="/movies" element={<Movies />} />` vào `src/App.jsx` (public, không cần login).
- **Dữ liệu:** dùng `getMovies()` sẵn có trong `src/Services/api.js`. Không thêm service mới.
- **Tái sử dụng** class `movie-card` và tông màu genre (`GENRE_COLORS`) giống Home để nhất quán.

### Thanh điều khiển
- **Ô tìm kiếm** (`search`): lọc theo `title` (không phân biệt hoa/thường), realtime.
- **Chip thể loại** (`genre`): `Tất cả` + các thể loại **tự sinh** từ `movies` (dedupe). Chọn 1 tại một thời điểm.
- **Sắp xếp** (`sort`): `Tên A→Z`, `Tên Z→A`, `Thời lượng ↑`, `Thời lượng ↓`.

### Logic
- State: `movies` (fetch 1 lần), `search`, `genre` (mặc định "Tất cả"), `sort` (mặc định "Tên A→Z").
- Danh sách hiển thị = `useMemo` từ `movies` qua chuỗi: lọc theo genre → lọc theo search → sắp xếp. Chỉ 4 phim nên client-side là đủ.
- **Empty state:** không khớp → "Không tìm thấy phim nào".
- Click thẻ → `navigate("/movie/:id")`.

## Việt hóa

### Navbar (`src/Components/Navbar.jsx`)
- `Home → Trang chủ`
- `Movies → Phim` **và sửa link từ `/` sang `/movies`**
- `Tickets → Vé`
- (Nút "Đăng nhập", dropdown "Vé của tôi"/"Đăng xuất" đã là tiếng Việt.)

### Home (`src/Pages/Home.jsx`)
- `Top Pick This Week → Lựa chọn hàng đầu tuần`
- `8.9 Rating → 8.9 Điểm`
- `Book Now → Đặt vé`, `Details → Chi tiết`
- `Now Showing → Đang chiếu`, `Trending Now → Thịnh hành`
- `View All → Xem tất cả` (trỏ `/movies`)
- `New Releases → Phim mới`, `Latest Blockbusters → Bom tấn mới nhất`, mô tả → tiếng Việt
- `Select Seats → Chọn ghế`, `Book Now → → Đặt vé →`
- `min → phút`

## Ngoài phạm vi (follow-up)
- Việt hóa MovieDetail, SeatSelection, MyTickets.
- Sắp xếp theo giá (giá nằm ở showtime, không ở movie → cần cân nhắc riêng).

## Rủi ro
Thấp. Chỉ thêm 1 page + 1 route và đổi text tĩnh ở 2 file. Không đổi service, không thêm dependency.
