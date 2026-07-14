# Booking Flow Overhaul — Design Spec

**Ngày:** 2026-07-14
**Phạm vi:** Đại tu end-to-end luồng đặt vé của cinema-full lên chuẩn "top 0.1%", mock trên json-server (không backend/thanh toán thật).
**Thiết kế:** Giữ hệ *cinematic dark* hiện có, nâng cấp tinh tế (glass, gradient, micro-interaction, motion) — chỉ áp cho luồng đặt vé.

---

## 1. Mục tiêu & phi mục tiêu

**Mục tiêu**
- Wizard 4 bước: Chọn ghế → Bắp nước → Thanh toán → Vé QR.
- Sơ đồ ghế cao cấp: màn cong, lối đi giữa, 3 loại ghế (thường/VIP/đôi), tooltip giá, giới hạn 8 ghế, mobile zoom.
- Đồng hồ giữ ghế ~8 phút (client-side).
- Bước F&B (concessions) + Thanh toán mock + Vé điện tử QR thật.
- Sửa các điểm chưa chuẩn của luồng hiện tại (bug ô Phòng ở MyTickets, thiếu re-check ghế, thiếu xử lý lỗi, nút XEM VÉ trơ).

**Phi mục tiêu**
- Không có backend/cổng thanh toán thật, không lưu thông tin thẻ.
- Không giữ ghế thật phía server (timer là UX, ghế chỉ thực sự "đặt" khi POST booking).
- Không đụng design system phần còn lại của app (admin, home…).

---

## 2. Kiến trúc wizard

Route giữ nguyên `/seats/:showtimeId` (không vỡ link từ MovieDetail/CinemaDetail). Component `SeatSelection` được tái cấu trúc thành **`BookingWizard`** — một container giữ toàn bộ state, render bước hiện tại.

```
BookingWizard (route /seats/:showtimeId)
├── BookingStepper        (thanh tiến trình dính đầu: ①②③④ + nút Quay lại)
├── SeatHoldTimer         (đếm ngược 8:00, cấp wizard)
├── Step 1: SeatStep      (sơ đồ ghế + tóm tắt đơn sticky)
├── Step 2: ConcessionStep(lưới combo bắp nước)
├── Step 3: PaymentStep   (chọn phương thức + review đơn → POST booking)
└── Step 4: TicketStep    (vé QR + CTA "Xem vé của tôi")
```

- **State cục bộ** (useState/useReducer trong BookingWizard):
  `{ step, selectedSeats: Seat[], concessions: {id: qty}, paymentMethod, booked: Set, bookingResult }`.
  Truyền xuống các step qua props + callback. Không thêm thư viện state global.
- **Điều hướng bước:** state `step` (1–4). Nút "Tiếp tục"/"Quay lại". Không cho tiến khi chưa đủ điều kiện (bước ① phải chọn ≥1 ghế).
- **Đồng hồ giữ ghế:** khởi động khi vào wizard. Hết 8:00 → modal "Hết thời gian giữ ghế" → reset về bước ①, xóa `selectedSeats`, restart timer. Sau khi POST thành công (bước ③→④) thì dừng timer.
- **Xác nhận (bước ③):** **fetch lại `getBookings()` + `getShowtime()`** để dựng lại `bookedSeatSet`; nếu ghế đã chọn bị người khác đặt → báo lỗi, quay về ①, bỏ ghế trùng. Nếu OK → `POST` **một** booking duy nhất.

**Payload booking mới** (tương thích ngược):
```json
{
  "movieId", "showtimeId", "cinemaId", "roomId", "userId", "userName",
  "seats": ["A1","A2"],
  "seatTypes": { "standard": 1, "vip": 1, "couple": 0 },
  "concessions": [ { "id": 1, "name": "Combo 1", "qty": 2, "price": 89000 } ],
  "paymentMethod": "momo",
  "seatTotal": 170000, "fnbTotal": 178000, "serviceFee": 15000,
  "totalPrice": 363000,
  "createdAt": "ISO"
}
```

---

## 3. Thay đổi dữ liệu (`db.json`) & `lib/pricing.js`

### 3.1 Collection mới `concessions`
```json
{ "id": 1, "name": "Combo Cặp Đôi", "category": "combo",
  "price": 89000, "description": "2 nước lớn + 1 bắp lớn", "image": "🍿" }
```
- `category`: `combo | popcorn | drink | snack`.
- Seed ~6–8 mục. `image` dùng emoji (không cần asset ngoài).
- Thêm helpers API: `getConcessions()` trong `services/api.js`.

### 3.2 Mở rộng `rooms` (tùy chọn, tương thích ngược)
- `coupleRows?: string[]` — hàng ghế đôi (mặc định không có → không đổi phòng cũ).
- `aisleAfterCols?: number[]` — chèn khoảng lối đi sau các cột này (chỉ ảnh hưởng cách vẽ). Nếu vắng, wizard tự tính 1 lối đi giữa.
- Cập nhật vài phòng mẫu để demo ghế đôi + lối đi.

### 3.3 `lib/pricing.js`
- `COUPLE_MULTIPLIER = 1.6` (giá ghế đôi = `round(base × 1.6)` về bội số 1.000).
- `isCoupleRow(row, coupleRows)`.
- `buildSeatLayout(room)` trả thêm `isCouple` cho mỗi ghế; ghế đôi vẫn là **1 đơn vị đặt** (1 seatNumber) nhưng render rộng gấp đôi.
- `priceOf(seat, base)`: couple > vip > standard.
- `SEAT_TYPE` labels/màu để chú thích.
- `fnbTotal(concessions, catalog)` helper cộng tiền F&B.

### 3.4 Mở rộng `bookings` — như payload mục 2 (booking cũ thiếu field mới vẫn đọc được ở MyTickets).

---

## 4. Bước ① — Sơ đồ ghế cao cấp

- **Màn hình cong** bằng CSS (border-radius + perspective/gradient glow).
- **Lối đi giữa**: chèn gap theo `aisleAfterCols`.
- **3 loại ghế** thường / VIP / đôi — màu & hình khác nhau; ghế đôi rộng gấp đôi. Chú thích (legend) đầy đủ + trạng thái Trống/Đang chọn/Đã đặt.
- **Tooltip giá** khi hover từng ghế (thường/VIP/đôi + số tiền).
- **Giới hạn 8 ghế/lần**: chọn quá → toast nhắc.
- **Tóm tắt đơn sticky** (phải trên desktop, đáy trên mobile): phim/rạp/phòng/suất, ghế đã chọn, breakdown giá, nút "Tiếp tục".
- **Mobile zoom**: nút phóng to/thu nhỏ hoặc pinch cho sơ đồ.
- **Micro-interaction**: ghế nảy nhẹ khi chọn; tổng tiền đếm mượt (count-up).

---

## 5. Bước ② — Bắp nước (F&B)

- Lưới combo từ `getConcessions()`, nhóm theo `category`, mỗi thẻ có nút −/＋ số lượng.
- Cộng dồn `fnbTotal` vào tổng đơn (hiển thị ở tóm tắt).
- Có thể **Bỏ qua** để sang bước ③.

## 6. Bước ③ — Thanh toán (mock)

- Chọn phương thức: **Momo / Thẻ / Tại quầy** (radio card; không nhập/lưu số thẻ thật).
- **Review** toàn bộ: ghế, concessions, breakdown (seatTotal + fnbTotal + serviceFee = total).
- Nút "Thanh toán" → re-check ghế → `POST` booking → sang bước ④. Có loading + xử lý lỗi (toast).

## 7. Bước ④ — Vé QR

- **QR thật** sinh từ mã booking (thêm dependency **`qrcode.react`**, cần `npm install`). Nội dung mã: chuỗi định danh vé (vd `TK-00042|showtimeId|seats`).
- Hiển thị vé điện tử (phim, suất, ghế, tổng) + QR + CTA "Xem vé của tôi" (`/tickets`).

---

## 8. MyTickets & MovieDetail

**MyTickets**
- 🐞 Sửa ô "PHÒNG": `showtime?.room` → `room?.name`.
- Thay QR giả (SVG hard-code) bằng **QR thật** (`qrcode.react`).
- Nút **"XEM VÉ"** → mở **modal vé toàn màn hình** (QR lớn + ghế + concessions + thông tin suất).
- Hiển thị concessions nếu booking có.

**MovieDetail (phễu đặt)** — polish giao diện select/ngày/giờ theo design nâng cấp, **giữ nguyên logic** phễu city→cinema→date→showtime.

---

## 9. Chia đợt triển khai (mỗi đợt xong → screenshot review)

1. **Đợt 1 — Nền:** `db.json` (rooms coupleRows/aisles) + `lib/pricing.js` + khung `BookingWizard` + `BookingStepper` + **SeatStep** (sơ đồ cao cấp) + `SeatHoldTimer` + re-check ghế + xử lý lỗi.
2. **Đợt 2 — F&B:** collection `concessions` + `getConcessions()` + **ConcessionStep**.
3. **Đợt 3 — Thanh toán + Vé:** **PaymentStep** (POST booking) + **TicketStep** + `qrcode.react`.
4. **Đợt 4 — Hoàn thiện:** polish MovieDetail + MyTickets (sửa bug Phòng, QR thật, modal XEM VÉ + concessions).

---

## 10. Rủi ro & quyết định

- **Dependency mới `qrcode.react`** — cần `npm install`; đã được duyệt.
- **Schema `db.json` mở rộng** — tương thích ngược; đã được duyệt.
- **Timer là UX theater** (không giữ ghế server-side) — chấp nhận vì là mock; re-check ghế ở bước ③ là lớp bảo vệ double-book thực sự.
- **Ghế đôi = 1 đơn vị đặt** (không phải 2 seatNumber) để giữ mô hình booking đơn giản, đúng no-partial-write.
- **Copy tiếng Việt**, giá VND `.toLocaleString("vi-VN") + ₫` — theo quy ước repo.
