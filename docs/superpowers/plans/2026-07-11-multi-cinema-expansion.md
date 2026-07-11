# Multi-Cinema Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng app từ 1 rạp thành hệ thống nhiều thành phố → nhiều rạp → nhiều phòng, có giá theo loại phòng và ghế VIP; đặt vé từ cả phim lẫn rạp.

**Architecture:** Thêm collection `cities`/`cinemas`/`rooms` vào `db.json`; `showtimes` gắn `roomId`. Bỏ bảng `seats` — sơ đồ ghế sinh từ layout phòng (`rows×cols`, `vipRows`), ghế đã đặt suy ra từ `showtime.bookedSeats` ∪ `bookings`. Đặt vé chỉ POST 1 booking. UI thêm 2 trang (Rạp, Chi tiết rạp) và nâng cấp MovieDetail/SeatSelection/MyTickets.

**Tech Stack:** React 18, React Router v6, json-server (mock API, port 9999), CSS thuần. Không có test runner → verify bằng `npm run build`, node data-check, và Puppeteer screenshot.

## Global Constraints

- API base URL: `http://localhost:9999` (đã hardcode trong `src/Services/api.js`, `auth.js`, `MyTickets.jsx`).
- Copy hướng người dùng: **tiếng Việt**; giữ tên thương hiệu/loại (CGV, Lotte, IMAX, 2D, 3D).
- Giá VND, format `.toLocaleString("vi-VN")` + `₫`.
- Giá ghế thường theo loại phòng: **2D 75.000 · 3D 95.000 · IMAX 120.000**. Giá VIP = `Math.round(price*1.3/1000)*1000`. Phí dịch vụ 15.000.
- Ngày suất chiếu ở tương lai (từ 2026-07-15). Hôm nay coi là 2026-07-11.
- Không thêm dependency vào `package.json` của dự án. Puppeteer chỉ cài trong scratchpad.
- Verify mỗi task: `CI=true npm run build` phải "Compiled successfully" trước khi commit.

## File Structure

- `db.json` — schema + seed mới (cities, cinemas, rooms, showtimes, bookings; bỏ seats).
- `src/Services/api.js` — thêm helper cities/cinemas/rooms/showtimes; bỏ `getSeats`/`updateSeat`.
- `src/lib/pricing.js` (Create) — hàm thuần tính giá ghế + layout ghế (tái dùng ở nhiều trang).
- `src/Pages/SeatSelection.jsx` + `.css` — refactor layout-based + VIP + pricing.
- `src/Pages/MovieDetail.jsx` + `.css` — selector Thành phố→Rạp→Ngày→Suất.
- `src/Pages/Cinemas.jsx` + `.css` (Create) — duyệt rạp theo thành phố.
- `src/Pages/CinemaDetail.jsx` + `.css` (Create) — 1 rạp: phim + suất.
- `src/Components/Navbar.jsx` — thêm link "Rạp".
- `src/App.jsx` — route `/cinemas`, `/cinema/:id`.
- `src/Pages/MyTickets.jsx` — enrich rạp/phòng trên vé.

---

### Task 1: Mô hình dữ liệu & seed (`db.json`)

**Files:**
- Modify: `db.json` (thay toàn bộ)

**Interfaces:**
- Produces schema:
  - `cities: { id, name }`
  - `cinemas: { id, cityId, name, address }`
  - `rooms: { id, cinemaId, name, type: "2D"|"3D"|"IMAX", rows, cols, vipRows: string[] }`
  - `showtimes: { id, movieId, roomId, time (ISO), price, bookedSeats: string[] }`
  - `bookings: { id, movieId, showtimeId, cinemaId, roomId, seats: string[], seatTypes: {standard:number,vip:number}, userId, userName, totalPrice, createdAt }`
  - KHÔNG còn collection `seats`.

- [ ] **Step 1: Thay `db.json`** bằng schema + seed dưới đây.

Seed cụ thể:
- `cities`: 1 TP.HCM, 2 Hà Nội, 3 Đà Nẵng.
- `cinemas` (5): 1 CGV Vincom Đồng Khởi (cityId 1, "72 Lê Thánh Tôn, Q1"), 2 Lotte Nam Sài Gòn (cityId 1, "Quận 7"), 3 BHD Star Phạm Ngọc Thạch (cityId 2, "Đống Đa, Hà Nội"), 4 CGV Vincom Bà Triệu (cityId 2, "Hai Bà Trưng, Hà Nội"), 5 Galaxy Đà Nẵng (cityId 3, "Hải Châu, Đà Nẵng").
- `rooms` (10): mỗi rạp 2 phòng.
  - Layout theo loại: 2D → rows 8, cols 12, vipRows ["E","F"]; 3D → rows 8, cols 12, vipRows ["E","F","G"]; IMAX → rows 10, cols 14, vipRows ["F","G","H"].
  - r1{c1,"Phòng 1","2D"}, r2{c1,"Phòng IMAX","IMAX"}, r3{c2,"Phòng 1","2D"}, r4{c2,"Phòng 2","3D"}, r5{c3,"Phòng 1","2D"}, r6{c3,"Phòng 2","3D"}, r7{c4,"Phòng 1","3D"}, r8{c4,"Phòng IMAX","IMAX"}, r9{c5,"Phòng 1","2D"}, r10{c5,"Phòng 2","3D"}.
- `showtimes`: cho mỗi phim (4 phim) tạo 3–5 suất trải các phòng/rạp/ngày (15–20/07/2026), `price` = giá theo `room.type` (2D 75000/3D 95000/IMAX 120000). Vài suất set `bookedSeats` (vd ["A3","E5","E6","F7"]) để sơ đồ trông thật. Tổng ~16 suất. Đảm bảo mỗi thành phố có ít nhất 1 suất cho phim 1.
- `bookings`: migrate 3 booking cũ — thêm `cinemaId`/`roomId` khớp `showtimeId` mới, thêm `seatTypes`. Giữ userId 1.
- `users`: giữ nguyên.

Nội dung ghế đã đặt phải nằm trong phạm vi layout phòng (row ≤ số hàng, col ≤ cols).

- [ ] **Step 2: Kiểm tra tính hợp lệ dữ liệu** (referential integrity)

Chạy (scratchpad hoặc inline node):
```bash
cd "D:/FPT/26SP/FER202/cinema-full"; node -e "
const d=require('./db.json');
const err=[];
const has=(a,id)=>a.some(x=>x.id===id);
d.cinemas.forEach(c=>{if(!has(d.cities,c.cityId))err.push('cinema '+c.id+' bad cityId')});
d.rooms.forEach(r=>{if(!has(d.cinemas,r.cinemaId))err.push('room '+r.id+' bad cinemaId')});
d.showtimes.forEach(s=>{if(!has(d.rooms,s.roomId))err.push('showtime '+s.id+' bad roomId');if(!has(d.movies,s.movieId))err.push('showtime '+s.id+' bad movieId')});
d.bookings.forEach(b=>{if(!has(d.showtimes,b.showtimeId))err.push('booking '+b.id+' bad showtimeId')});
console.log(err.length?('LỖI:\n'+err.join('\n')):'OK: dữ liệu hợp lệ. cities='+d.cities.length+' cinemas='+d.cinemas.length+' rooms='+d.rooms.length+' showtimes='+d.showtimes.length);
if('seats' in d) console.log('CẢNH BÁO: vẫn còn collection seats');
"
```
Expected: `OK: dữ liệu hợp lệ...`, không còn `seats`.

- [ ] **Step 3: Xác nhận json-server phục vụ** (json-server tự reload khi lưu file)
```bash
curl -s "http://localhost:9999/cinemas?cityId=1" --max-time 5 | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>console.log('cinemas ở TP.HCM:',JSON.parse(s).length))"
```
Expected: `cinemas ở TP.HCM: 2`

- [ ] **Step 4: Commit**
```bash
git add db.json && git commit -m "feat(data): multi-cinema schema and seed (cities, cinemas, rooms)"
```

---

### Task 2: Pricing/layout helpers + API service

**Files:**
- Create: `src/lib/pricing.js`
- Modify: `src/Services/api.js`

**Interfaces:**
- Produces `src/lib/pricing.js`:
  - `ROOM_TYPE_PRICE = { "2D":75000, "3D":95000, "IMAX":120000 }`
  - `SERVICE_FEE = 15000`
  - `vipPrice(basePrice: number): number` → `Math.round(basePrice*1.3/1000)*1000`
  - `isVipRow(row: string, vipRows: string[]): boolean`
  - `buildSeatLayout(room): { row:string, seats:{ seatNumber, row, col, isVip }[] }[]` — sinh từ `room.rows` (số hàng → A,B,…) × `room.cols`.
  - `bookedSeatSet(showtime, bookings): Set<string>` — hợp `showtime.bookedSeats` và mọi `booking.seats` có `showtimeId===showtime.id`.
  - `priceOf(seat, basePrice): number` — `seat.isVip ? vipPrice(basePrice) : basePrice`.
- Produces `api.js` helpers (đều trả Promise):
  - `getCities()`, `getCinemas(cityId?)`, `getCinema(id)`, `getRooms(cinemaId?)`, `getRoom(id)`, `getShowtimesByCinema(cinemaId)`, `getShowtimesByRoom(roomId)`. Giữ `getMovies,getMovie,getShowtimes(movieId),getShowtime(id),getAllShowtimes,createBooking,getBookings`. Xóa `getSeats,updateSeat`.

- [ ] **Step 1: Tạo `src/lib/pricing.js`**
```js
export const ROOM_TYPE_PRICE = { "2D": 75000, "3D": 95000, "IMAX": 120000 };
export const SERVICE_FEE = 15000;

const rowLetter = (i) => String.fromCharCode(65 + i); // 0→A

export const vipPrice = (basePrice) => Math.round((basePrice * 1.3) / 1000) * 1000;
export const isVipRow = (row, vipRows = []) => vipRows.includes(row);

export function buildSeatLayout(room) {
  if (!room) return [];
  const rows = [];
  for (let r = 0; r < room.rows; r++) {
    const row = rowLetter(r);
    const seats = [];
    for (let c = 1; c <= room.cols; c++) {
      seats.push({ seatNumber: `${row}${c}`, row, col: c, isVip: isVipRow(row, room.vipRows) });
    }
    rows.push({ row, seats });
  }
  return rows;
}

export function bookedSeatSet(showtime, bookings = []) {
  const set = new Set(showtime?.bookedSeats || []);
  bookings
    .filter((b) => b.showtimeId === showtime?.id)
    .forEach((b) => (b.seats || []).forEach((s) => set.add(s)));
  return set;
}

export const priceOf = (seat, basePrice) => (seat.isVip ? vipPrice(basePrice) : basePrice);
```

- [ ] **Step 2: Cập nhật `src/Services/api.js`** — thêm helpers, xóa `getSeats`/`updateSeat`.
```js
const BASE_URL = "http://localhost:9999";

export const getMovies = () => fetch(`${BASE_URL}/movies`).then(r => r.json());
export const getMovie = (id) => fetch(`${BASE_URL}/movies/${id}`).then(r => r.json());

export const getShowtimes = (movieId) => fetch(`${BASE_URL}/showtimes?movieId=${movieId}`).then(r => r.json());
export const getShowtime = (id) => fetch(`${BASE_URL}/showtimes/${id}`).then(r => r.json());
export const getAllShowtimes = () => fetch(`${BASE_URL}/showtimes`).then(r => r.json());
export const getShowtimesByRoom = (roomId) => fetch(`${BASE_URL}/showtimes?roomId=${roomId}`).then(r => r.json());

export const getCities = () => fetch(`${BASE_URL}/cities`).then(r => r.json());
export const getCinemas = (cityId) =>
  fetch(`${BASE_URL}/cinemas${cityId ? `?cityId=${cityId}` : ""}`).then(r => r.json());
export const getCinema = (id) => fetch(`${BASE_URL}/cinemas/${id}`).then(r => r.json());
export const getRooms = (cinemaId) =>
  fetch(`${BASE_URL}/rooms${cinemaId ? `?cinemaId=${cinemaId}` : ""}`).then(r => r.json());
export const getRoom = (id) => fetch(`${BASE_URL}/rooms/${id}`).then(r => r.json());

// Suất chiếu của 1 rạp: lấy rooms của rạp rồi gom showtimes theo roomId
export const getShowtimesByCinema = async (cinemaId) => {
  const rooms = await getRooms(cinemaId);
  const lists = await Promise.all(rooms.map(r => getShowtimesByRoom(r.id)));
  return lists.flat();
};

export const createBooking = (booking) =>
  fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking)
  }).then(r => r.json());

export const getBookings = () => fetch(`${BASE_URL}/bookings`).then(r => r.json());
```

- [ ] **Step 3: Build + kiểm tra không còn tham chiếu `getSeats`/`updateSeat`**
```bash
cd "D:/FPT/26SP/FER202/cinema-full"; grep -rn "getSeats\|updateSeat" src || echo "OK: không còn tham chiếu"; CI=true npm run build 2>&1 | grep -E "Compiled|Failed|Error"
```
Expected: `OK: không còn tham chiếu` (SeatSelection sẽ được sửa ở Task 3 — nếu build lỗi vì SeatSelection còn dùng, làm Task 3 ngay sau) và cuối cùng `Compiled successfully` sau Task 3.
> Lưu ý thứ tự: Task 2 và Task 3 nên commit cùng nhau nếu build phụ thuộc lẫn nhau. Nếu build fail ở đây do SeatSelection cũ, tiếp tục Task 3 rồi mới commit chung.

- [ ] **Step 4: Commit** (có thể gộp với Task 3 nếu build phụ thuộc)
```bash
git add src/lib/pricing.js src/Services/api.js && git commit -m "feat(api): cinema/room/city helpers and pricing lib; drop seats API"
```

---

### Task 3: Refactor `SeatSelection` (layout-based + VIP + pricing)

**Files:**
- Modify: `src/Pages/SeatSelection.jsx`
- Modify: `src/Pages/SeatSelection.css`

**Interfaces:**
- Consumes: `getShowtime`, `getMovie`, `getRoom`, `getCinema`, `getBookings`, `createBooking` (api.js); `buildSeatLayout,bookedSeatSet,priceOf,vipPrice,SERVICE_FEE` (pricing.js).
- Produces: booking POST có shape `{ movieId, showtimeId, cinemaId, roomId, seats, seatTypes:{standard,vip}, userId, userName, totalPrice, createdAt }`.

- [ ] **Step 1: Viết lại `SeatSelection.jsx`** — bỏ `getSeats/updateSeat`. Logic chính:
```jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getShowtime, getMovie, getRoom, getCinema, getBookings, createBooking } from "../Services/api";
import { buildSeatLayout, bookedSeatSet, priceOf, vipPrice, SERVICE_FEE } from "../lib/pricing";
import { useAuth } from "../Context/AuthContext";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "./SeatSelection.css";

export default function SeatSelection() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [showtime, setShowtime] = useState(null);
  const [movie, setMovie] = useState(null);
  const [room, setRoom] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [booked, setBooked] = useState(new Set());
  const [selected, setSelected] = useState([]); // seat objects {seatNumber,row,col,isVip}
  const [name, setName] = useState(user?.fullName || "");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const st = await getShowtime(showtimeId);
      setShowtime(st);
      const [m, r, bookings] = await Promise.all([
        getMovie(st.movieId), getRoom(st.roomId), getBookings()
      ]);
      setMovie(m); setRoom(r);
      setBooked(bookedSeatSet({ ...st, id: Number(st.id) }, bookings));
      getCinema(r.cinemaId).then(setCinema);
    })();
  }, [showtimeId]);

  const layout = buildSeatLayout(room);
  const base = showtime?.price || 0;

  const toggle = (seat) => {
    if (booked.has(seat.seatNumber)) return;
    setSelected(prev => prev.find(s => s.seatNumber === seat.seatNumber)
      ? prev.filter(s => s.seatNumber !== seat.seatNumber)
      : [...prev, seat]);
  };

  const stdCount = selected.filter(s => !s.isVip).length;
  const vipCount = selected.filter(s => s.isVip).length;
  const seatTotal = selected.reduce((sum, s) => sum + priceOf(s, base), 0);
  const serviceFee = selected.length > 0 ? SERVICE_FEE : 0;
  const total = seatTotal + serviceFee;

  const handleBooking = async () => {
    if (!name.trim() || selected.length === 0) return;
    setLoading(true);
    await createBooking({
      movieId: showtime.movieId,
      showtimeId: Number(showtimeId),
      cinemaId: room.cinemaId,
      roomId: room.id,
      seats: selected.map(s => s.seatNumber),
      seatTypes: { standard: stdCount, vip: vipCount },
      userId: user?.id,
      userName: name || user?.fullName,
      totalPrice: total,
      createdAt: new Date().toISOString()
    });
    setLoading(false);
    setConfirmed(true);
    setTimeout(() => navigate("/tickets"), 2000);
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("vi-VN", { day:"numeric", month:"short", year:"numeric" }) : "";
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" }) : "";

  if (confirmed) return (
    <div className="page" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div className="booked-icon">✓</div>
      <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, letterSpacing:2 }}>Đặt vé thành công!</h2>
      <p style={{ color:"var(--text-muted)" }}>Đang chuyển tới trang vé của bạn...</p>
    </div>
  );

  return (
    <div className="page seat-page">
      <Navbar back={movie ? `/movie/${movie.id}` : "/"} />
      <div className="seat-layout">
        <div className="seat-map-container">
          <div className="screen-container"><div className="screen-glow" /><div className="screen-label">MÀN HÌNH CHIẾU</div></div>
          <div className="seat-map">
            {layout.map(({ row, seats }) => (
              <div key={row} className="seat-row">
                <span className="row-label">{row}</span>
                <div className="seats-in-row">
                  {seats.map(seat => {
                    const isBooked = booked.has(seat.seatNumber);
                    const isSel = selected.find(s => s.seatNumber === seat.seatNumber);
                    return (
                      <button key={seat.seatNumber}
                        className={`seat ${seat.isVip ? "vip" : ""} ${isBooked ? "booked" : ""} ${isSel ? "selected" : ""}`}
                        disabled={isBooked} title={`${seat.seatNumber}${seat.isVip ? " · VIP" : ""}`}
                        onClick={() => toggle(seat)}>
                        {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                    );
                  })}
                </div>
                <span className="row-label">{row}</span>
              </div>
            ))}
          </div>
          <div className="seat-legend">
            <div className="legend-item"><div className="legend-dot available" /><span>Trống</span></div>
            <div className="legend-item"><div className="legend-dot vip-dot" /><span>VIP</span></div>
            <div className="legend-item"><div className="legend-dot selected-dot" /><span>Đang chọn</span></div>
            <div className="legend-item"><div className="legend-dot reserved" /><span>Đã đặt</span></div>
          </div>
        </div>

        <div className="booking-panel">
          {movie && (
            <div className="booking-movie-info">
              <div className="booking-movie-poster"><span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:40, color:"rgba(255,255,255,0.1)" }}>{movie.title[0]}</span></div>
              <div>
                <h2 className="booking-movie-title">{movie.title}</h2>
                <p className="booking-movie-meta">{movie.genre.toUpperCase()} · {movie.duration} PHÚT</p>
                <p className="booking-cinema-line">{cinema?.name} · {room?.name} · {room?.type}</p>
                <div className="booking-info-grid">
                  <div className="booking-info-cell"><span className="booking-info-label">Ngày</span><span className="booking-info-value">{fmtDate(showtime?.time)}</span></div>
                  <div className="booking-info-cell"><span className="booking-info-label">Giờ</span><span className="booking-info-value">{fmtTime(showtime?.time)}</span></div>
                </div>
                <div className="booking-info-cell" style={{ marginTop:12 }}>
                  <span className="booking-info-label">Ghế đã chọn</span>
                  <span className="booking-info-value selected-seats-display">{selected.length ? selected.map(s=>s.seatNumber).join(", ") : "Chưa chọn"}</span>
                </div>
              </div>
            </div>
          )}
          <div className="booking-name-field">
            <label className="section-label" style={{ display:"block", marginBottom:10 }}>Tên của bạn</label>
            <input className="name-input" placeholder="Tên của bạn" readOnly={!!user} value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div className="price-breakdown">
            <div className="price-row"><span>Ghế thường (×{stdCount})</span><span>{(stdCount*base).toLocaleString("vi-VN")}₫</span></div>
            <div className="price-row"><span>Ghế VIP (×{vipCount})</span><span>{(vipCount*vipPrice(base)).toLocaleString("vi-VN")}₫</span></div>
            <div className="price-row"><span>Phí dịch vụ</span><span>{serviceFee.toLocaleString("vi-VN")}₫</span></div>
            <div className="price-row total"><span>TỔNG CỘNG</span><span className="total-amount">{total.toLocaleString("vi-VN")}₫</span></div>
          </div>
          <button className="btn-primary confirm-btn" disabled={selected.length===0 || !name.trim() || loading} onClick={handleBooking}>
            {loading ? "Đang xử lý..." : "Xác nhận đặt vé"}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Thêm CSS cho ghế VIP** vào `SeatSelection.css` (nối cuối file)
```css
/* VIP seats */
.seat.vip { background: rgba(230,160,48,0.18); border-color: rgba(230,160,48,0.5); }
.seat.vip:hover:not(:disabled) { background: rgba(230,160,48,0.35); }
.seat.vip.selected { background: var(--red); border-color: var(--red); }
.legend-dot.vip-dot { background: rgba(230,160,48,0.6); }
.booking-cinema-line { font-size: 12px; color: var(--text-muted); margin-top: 4px; letter-spacing: 0.3px; }
```

- [ ] **Step 3: Build**
```bash
cd "D:/FPT/26SP/FER202/cinema-full"; CI=true npm run build 2>&1 | grep -E "Compiled|Failed|Error"
```
Expected: `Compiled successfully.`

- [ ] **Step 4: Verify trực quan** (Puppeteer, đăng nhập user 1, chụp `/seats/<id>` của 1 suất IMAX để thấy ghế VIP). Dùng script `shot.js` trong scratchpad (đổi URL sang một showtimeId thuộc phòng IMAX). Kiểm tra: có hàng ghế VIP màu khác, chú thích 4 trạng thái, chọn ghế thấy giá cập nhật.

- [ ] **Step 5: Commit**
```bash
git add src/Pages/SeatSelection.jsx src/Pages/SeatSelection.css src/lib/pricing.js src/Services/api.js && git commit -m "feat(seats): layout-based seat map with VIP pricing; single-booking POST"
```

---

### Task 4: Nâng cấp `MovieDetail` — chọn Thành phố → Rạp → Ngày → Suất

**Files:**
- Modify: `src/Pages/MovieDetail.jsx`
- Modify: `src/Pages/MovieDetail.css`

**Interfaces:**
- Consumes: `getMovie, getShowtimes(movieId), getCities, getCinemas, getRooms` (api.js). Cần map showtime→room→cinema→city để lọc.
- Produces: điều hướng `/seats/:showtimeId`.

- [ ] **Step 1: Viết lại panel đặt vé** trong `MovieDetail.jsx`. Logic:
  - Fetch `getMovie(id)` và `getShowtimes(id)`.
  - Fetch `getRooms()` (tất cả) và `getCinemas()` và `getCities()` 1 lần; build map `roomId→room`, `cinemaId→cinema`.
  - Với mỗi showtime, đính kèm `room`, `cinema`, `cityId`.
  - State: `cityId` (mặc định thành phố đầu có suất), `cinemaId` (mặc định rạp đầu có suất trong thành phố), `dateKey` (YYYY-MM-DD, mặc định ngày sớm nhất), `selectedShowtime`.
  - UI: dropdown/chip **Thành phố** (chỉ những thành phố có suất) → **Rạp** (lọc theo thành phố, chỉ rạp có suất phim này) → hàng **Ngày** (các ngày có suất tại rạp đó) → lưới **Giờ** (kèm loại phòng + giá). Chọn giờ → nút "Đặt vé" điều hướng `/seats/<id>`.
  - Hiển thị giá suất: `{price.toLocaleString('vi-VN')}₫ / ghế` và nhãn loại phòng.

Code khung (thay phần `showtimes-panel` và `dates`/logic liên quan; giữ phần hero phía trên):
```jsx
// trong component, sau khi có showtimes + maps:
const enriched = showtimes.map(s => {
  const room = roomMap[s.roomId];
  const cinema = room ? cinemaMap[room.cinemaId] : null;
  return { ...s, room, cinema, cityId: cinema?.cityId, dateKey: s.time.slice(0,10) };
});
const cityIds = [...new Set(enriched.map(e => e.cityId))];
const inCity = enriched.filter(e => e.cityId === cityId);
const cinemaIds = [...new Set(inCity.map(e => e.cinema.id))];
const inCinema = inCity.filter(e => e.cinema.id === cinemaId);
const dateKeys = [...new Set(inCinema.map(e => e.dateKey))].sort();
const times = inCinema.filter(e => e.dateKey === dateKey).sort((a,b)=>a.time.localeCompare(b.time));
```
Panel render: Thành phố (map `cityIds`→`cityMap[id].name`), Rạp (map `cinemaIds`→`cinemaMap[id].name`), Ngày (map `dateKeys`, format `toLocaleDateString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit'})`), Giờ (map `times`, hiển thị `fmtTime(e.time)` + `e.room.type`). Khi đổi Thành phố → reset Rạp về rạp đầu; đổi Rạp → reset Ngày; đổi Ngày → reset giờ. Nút "Đặt vé" `disabled={!selectedShowtime}` → `navigate('/seats/'+selectedShowtime)`.

- [ ] **Step 2: CSS** — thêm style cho dropdown/chip thành phố-rạp-ngày (tái dùng `.date-btn`, `.time-btn` sẵn có; thêm `.detail-select-row`, `.detail-select` nếu dùng `<select>`).
```css
.detail-select-row { display:flex; flex-direction:column; gap:10px; margin-bottom:16px; }
.detail-select { background: var(--bg-card2); border:1px solid var(--border); color:var(--text); border-radius:8px; padding:10px 12px; font-family:'Barlow',sans-serif; font-size:13px; outline:none; cursor:pointer; }
.detail-select:hover { border-color: rgba(230,48,48,0.3); }
.time-btn .time-type { display:block; font-size:9px; letter-spacing:1px; color:var(--text-dim); margin-top:2px; }
```

- [ ] **Step 3: Build**
```bash
cd "D:/FPT/26SP/FER202/cinema-full"; CI=true npm run build 2>&1 | grep -E "Compiled|Failed|Error"
```
Expected: `Compiled successfully.`

- [ ] **Step 4: Verify trực quan** — screenshot `/movie/1`: thấy dropdown Thành phố/Rạp, hàng Ngày, lưới Giờ có loại phòng; đổi thành phố → rạp/suất đổi theo.

- [ ] **Step 5: Commit**
```bash
git add src/Pages/MovieDetail.jsx src/Pages/MovieDetail.css && git commit -m "feat(movie-detail): city/cinema/date/showtime picker"
```

---

### Task 5: Trang `Cinemas` (duyệt rạp theo thành phố) + Navbar + route

**Files:**
- Create: `src/Pages/Cinemas.jsx`
- Create: `src/Pages/Cinemas.css`
- Modify: `src/Components/Navbar.jsx` (thêm link "Rạp")
- Modify: `src/App.jsx` (route `/cinemas`)

**Interfaces:**
- Consumes: `getCities, getCinemas` (api.js).
- Produces: link tới `/cinema/:id` (Task 6). Navbar mục "Rạp" → `/cinemas`.

- [ ] **Step 1: Tạo `Cinemas.jsx`** — fetch cities + cinemas; lọc theo thành phố (chip "Tất cả" + từng thành phố); danh sách thẻ rạp (tên, địa chỉ, thành phố) click → `/cinema/:id`. Có empty state "Không có rạp nào". Dùng `Navbar`/`Footer`, class thẻ giống `movie-card` nếu hợp.
```jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCities, getCinemas } from "../Services/api";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "./Cinemas.css";

export default function Cinemas() {
  const [cities, setCities] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [cityId, setCityId] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    getCities().then(setCities);
    getCinemas().then(setCinemas);
  }, []);

  const cityName = (id) => cities.find(c => c.id === id)?.name || "";
  const visible = useMemo(
    () => cityId === "all" ? cinemas : cinemas.filter(c => c.cityId === cityId),
    [cinemas, cityId]
  );

  return (
    <div className="page cinemas-page">
      <Navbar />
      <section className="cinemas-section">
        <div className="section-label">Hệ thống rạp</div>
        <h1 className="cinemas-title">Rạp chiếu phim</h1>
        <div className="cinemas-cities">
          <button className={`genre-chip ${cityId==="all"?"active":""}`} onClick={()=>setCityId("all")}>Tất cả</button>
          {cities.map(c => (
            <button key={c.id} className={`genre-chip ${cityId===c.id?"active":""}`} onClick={()=>setCityId(c.id)}>{c.name}</button>
          ))}
        </div>
        {visible.length === 0 ? (
          <div className="cinemas-empty">Không có rạp nào</div>
        ) : (
          <div className="cinemas-grid">
            {visible.map(c => (
              <div key={c.id} className="cinema-card" onClick={()=>navigate(`/cinema/${c.id}`)}>
                <div className="cinema-card-badge">{cityName(c.cityId)}</div>
                <h3 className="cinema-card-name">{c.name}</h3>
                <p className="cinema-card-addr">{c.address}</p>
                <span className="cinema-card-link">Xem lịch chiếu →</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Tạo `Cinemas.css`**
```css
.cinemas-section { padding: 100px 40px 60px; max-width: 1200px; margin: 0 auto; }
.cinemas-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(40px,6vw,64px); letter-spacing:2px; line-height:1; margin:6px 0 24px; }
.cinemas-cities { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:28px; }
.cinemas-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
.cinema-card { background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:24px; cursor:pointer; transition:border-color .2s, transform .2s; }
.cinema-card:hover { border-color:rgba(230,48,48,0.3); transform:translateY(-4px); }
.cinema-card-badge { display:inline-block; font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:var(--red); margin-bottom:10px; }
.cinema-card-name { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; margin-bottom:6px; }
.cinema-card-addr { font-size:13px; color:var(--text-muted); line-height:1.5; margin-bottom:14px; }
.cinema-card-link { font-size:12px; color:var(--red); font-weight:600; }
.cinemas-empty { padding:60px 0; text-align:center; color:var(--text-muted); }
@media (max-width:900px){ .cinemas-grid{ grid-template-columns:repeat(2,1fr);} }
@media (max-width:600px){ .cinemas-section{ padding:90px 20px 40px;} .cinemas-grid{ grid-template-columns:1fr;} }
```

- [ ] **Step 3: Navbar** — thêm link "Rạp" giữa "Phim" và "Vé".
```jsx
// trong .navbar-links, sau link "Phim":
<Link to="/cinemas" className={location.pathname.startsWith("/cinema") ? "active" : ""}>Rạp</Link>
```

- [ ] **Step 4: App.jsx** — import + route.
```jsx
import Cinemas from "./Pages/Cinemas";
// ...
<Route path="/cinemas" element={<Cinemas />} />
```

- [ ] **Step 5: Build + screenshot `/cinemas`** (lọc theo thành phố hoạt động).
```bash
cd "D:/FPT/26SP/FER202/cinema-full"; CI=true npm run build 2>&1 | grep -E "Compiled|Failed|Error"
```
Expected: `Compiled successfully.`

- [ ] **Step 6: Commit**
```bash
git add src/Pages/Cinemas.jsx src/Pages/Cinemas.css src/Components/Navbar.jsx src/App.jsx && git commit -m "feat(cinemas): browse cinemas by city + nav link"
```

---

### Task 6: Trang `CinemaDetail` (1 rạp: phim + suất) + route

**Files:**
- Create: `src/Pages/CinemaDetail.jsx`
- Create: `src/Pages/CinemaDetail.css`
- Modify: `src/App.jsx` (route `/cinema/:id`)

**Interfaces:**
- Consumes: `getCinema, getShowtimesByCinema, getMovies` (api.js).
- Produces: điều hướng `/seats/:showtimeId`.

- [ ] **Step 1: Tạo `CinemaDetail.jsx`** — fetch rạp + showtimes của rạp + movies; nhóm suất theo phim, trong mỗi phim nhóm theo ngày; nút giờ → `/seats/:id`. Header hiện tên rạp + địa chỉ.
```jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCinema, getShowtimesByCinema, getMovies, getRooms } from "../Services/api";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "./CinemaDetail.css";

export default function CinemaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cinema, setCinema] = useState(null);
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    getCinema(id).then(setCinema);
    getMovies().then(setMovies);
    getRooms(id).then(setRooms);
    getShowtimesByCinema(Number(id)).then(setShowtimes);
  }, [id]);

  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
  const fmtDate = (k) => new Date(k).toLocaleDateString("vi-VN",{weekday:"short",day:"2-digit",month:"2-digit"});

  const byMovie = movies
    .map(m => ({ movie: m, sts: showtimes.filter(s => s.movieId === m.id) }))
    .filter(x => x.sts.length > 0);

  if (!cinema) return <div className="page" style={{display:"flex",alignItems:"center",justifyContent:"center"}}><div className="loading-spinner"/></div>;

  return (
    <div className="page cinema-detail-page">
      <Navbar back="/cinemas" />
      <section className="cinema-detail-section">
        <div className="section-label">Lịch chiếu tại rạp</div>
        <h1 className="cinema-detail-title">{cinema.name}</h1>
        <p className="cinema-detail-addr">{cinema.address}</p>

        {byMovie.length === 0 ? (
          <div className="cinema-empty">Rạp này chưa có suất chiếu</div>
        ) : byMovie.map(({ movie, sts }) => {
          const dates = [...new Set(sts.map(s => s.time.slice(0,10)))].sort();
          return (
            <div key={movie.id} className="cinema-movie-block">
              <div className="cinema-movie-head">
                <h3 className="cinema-movie-title" onClick={()=>navigate(`/movie/${movie.id}`)}>{movie.title}</h3>
                <span className="cinema-movie-meta">{movie.genre} · {movie.duration} phút</span>
              </div>
              {dates.map(d => (
                <div key={d} className="cinema-date-row">
                  <span className="cinema-date-label">{fmtDate(d)}</span>
                  <div className="cinema-times">
                    {sts.filter(s => s.time.slice(0,10)===d).sort((a,b)=>a.time.localeCompare(b.time)).map(s => (
                      <button key={s.id} className="time-btn" onClick={()=>navigate(`/seats/${s.id}`)}>
                        {fmtTime(s.time)}
                        <span className="time-type">{roomMap[s.roomId]?.type} · {s.price.toLocaleString("vi-VN")}₫</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </section>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Tạo `CinemaDetail.css`**
```css
.cinema-detail-section { padding: 100px 40px 60px; max-width: 1000px; margin: 0 auto; }
.cinema-detail-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(36px,5vw,56px); letter-spacing:2px; line-height:1; margin:6px 0 6px; }
.cinema-detail-addr { color:var(--text-muted); font-size:14px; margin-bottom:32px; }
.cinema-movie-block { border-top:1px solid var(--border); padding:24px 0; }
.cinema-movie-head { display:flex; align-items:baseline; gap:12px; margin-bottom:16px; }
.cinema-movie-title { font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:700; cursor:pointer; }
.cinema-movie-title:hover { color:var(--red); }
.cinema-movie-meta { font-size:13px; color:var(--text-muted); }
.cinema-date-row { display:flex; gap:16px; align-items:flex-start; margin-bottom:14px; }
.cinema-date-label { min-width:90px; font-family:'Barlow Condensed',sans-serif; font-weight:600; letter-spacing:0.5px; color:var(--text-muted); padding-top:8px; text-transform:capitalize; }
.cinema-times { display:flex; flex-wrap:wrap; gap:10px; }
.cinema-times .time-btn { min-width:90px; }
.cinema-times .time-type { display:block; font-size:9px; letter-spacing:0.5px; color:var(--text-dim); margin-top:2px; }
.cinema-empty { padding:60px 0; text-align:center; color:var(--text-muted); }
@media (max-width:600px){ .cinema-detail-section{ padding:90px 20px 40px;} .cinema-date-row{ flex-direction:column; gap:6px;} }
```

- [ ] **Step 3: App.jsx** — import + route.
```jsx
import CinemaDetail from "./Pages/CinemaDetail";
// ...
<Route path="/cinema/:id" element={<CinemaDetail />} />
```

- [ ] **Step 4: Build + screenshot `/cinema/1`** (thấy phim + suất nhóm theo ngày, nút giờ có loại phòng + giá).
```bash
cd "D:/FPT/26SP/FER202/cinema-full"; CI=true npm run build 2>&1 | grep -E "Compiled|Failed|Error"
```
Expected: `Compiled successfully.`

- [ ] **Step 5: Commit**
```bash
git add src/Pages/CinemaDetail.jsx src/Pages/CinemaDetail.css src/App.jsx && git commit -m "feat(cinema-detail): per-cinema movie showtimes page"
```

---

### Task 7: `MyTickets` — hiển thị rạp/phòng trên vé

**Files:**
- Modify: `src/Pages/MyTickets.jsx`

**Interfaces:**
- Consumes: `getBookings, getMovie, getShowtime, getCinema, getRoom` (api.js).

- [ ] **Step 1: Enrich booking** — thay inline `fetch` showtime bằng `getShowtime`; lấy thêm `cinema` (từ `booking.cinemaId`) và `room` (từ `booking.roomId`). Hiển thị dòng "Rạp · Phòng" trong thẻ vé và badge loại phòng thay cho điều kiện `price>100000`.
```jsx
// trong useEffect map:
const [movie, showtime, cinema, room] = await Promise.all([
  getMovie(b.movieId).catch(()=>null),
  getShowtime(b.showtimeId).catch(()=>null),
  b.cinemaId ? getCinema(b.cinemaId).catch(()=>null) : Promise.resolve(null),
  b.roomId ? getRoom(b.roomId).catch(()=>null) : Promise.resolve(null),
]);
return { ...b, movie, showtime, cinema, room };
```
Trong `TicketCard`, thêm dòng rạp và badge loại:
```jsx
// dưới ticket-title:
{ (cinema || room) && <div className="ticket-cinema-line">{cinema?.name}{room?` · ${room.name}`:""}</div> }
// badge:
{ room?.type && <span className="ticket-badge">{room.type}</span> }
```
Cập nhật import: `import { getBookings, getMovie, getShowtime, getCinema, getRoom } from "../Services/api";` và bỏ inline `fetch("http://localhost:9999/showtimes/...")`.

- [ ] **Step 2: CSS nhỏ** (nối vào `MyTickets.css`)
```css
.ticket-cinema-line { font-size: 12px; color: var(--text-muted); margin: 2px 0 10px; }
```

- [ ] **Step 3: Build + screenshot `/tickets`** (đăng nhập user 1) — vé hiện tên rạp · phòng và badge loại.
```bash
cd "D:/FPT/26SP/FER202/cinema-full"; CI=true npm run build 2>&1 | grep -E "Compiled|Failed|Error"
```
Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**
```bash
git add src/Pages/MyTickets.jsx src/Pages/MyTickets.css && git commit -m "feat(tickets): show cinema/room and room-type badge"
```

---

### Task 8: Kiểm thử end-to-end + dọn dẹp + docs

**Files:**
- Modify: `README.md` (bảng route + mô tả data model)
- Modify: `CLAUDE.md` (mục Architecture: cinemas/rooms, bỏ seats, pricing lib)

- [ ] **Step 1: E2E thủ công qua Puppeteer** — kịch bản: Home → `/movies` → chọn phim → chọn Thành phố/Rạp/Ngày/Giờ → `/seats` chọn 1 ghế thường + 1 ghế VIP → xác nhận → `/tickets` thấy vé mới đúng rạp/phòng/giá. Đồng thời `/cinemas` → `/cinema/:id` → đặt được từ rạp. Chụp lại các bước gửi cho user.

- [ ] **Step 2: Cập nhật README** — bảng route thêm `/cinemas`, `/cinema/:id`; mô tả data model mới (cities/cinemas/rooms; ghế suy ra từ layout).

- [ ] **Step 3: Cập nhật CLAUDE.md** — phần Architecture: mô tả cinemas/rooms/city, bỏ mô tả `seats` table và vòng PATCH, thêm `src/lib/pricing.js`.

- [ ] **Step 4: Commit + push**
```bash
git add README.md CLAUDE.md && git commit -m "docs: update README/CLAUDE for multi-cinema model" && git push origin main
```

## Self-Review

- **Spec coverage:** cities/cinemas/rooms + showtime.roomId/bookedSeats + bỏ seats (Task 1); pricing theo loại phòng + VIP (Task 2, dùng ở 3/4/6); ghế suy ra layout (Task 2/3); luồng từ phim (Task 4) + từ rạp (Task 5/6); Navbar "Rạp" (Task 5); SeatSelection refactor (Task 3); MyTickets enrich (Task 7); seed mẫu (Task 1); tiếng Việt (mọi task); docs (Task 8). Không thấy khoảng trống.
- **Placeholder scan:** không có TODO/TBD; mọi step có code hoặc lệnh cụ thể.
- **Type consistency:** booking shape `{cinemaId,roomId,seats,seatTypes:{standard,vip},...}` nhất quán giữa Task 3 (tạo) và Task 7 (đọc). `buildSeatLayout/bookedSeatSet/priceOf/vipPrice/SERVICE_FEE` khai báo ở Task 2, dùng đúng tên ở Task 3. Helper `getShowtimesByCinema` (Task 2) dùng ở Task 6.
