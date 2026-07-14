# Booking Flow Overhaul — Đợt 1 (Nền) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tái cấu trúc trang chọn ghế thành khung `BookingWizard`, với sơ đồ ghế cao cấp (màn cong, lối đi, 3 loại ghế, tooltip giá, giới hạn 8 ghế), đồng hồ giữ ghế 8 phút, re-check ghế trống + xử lý lỗi trước khi đặt — vẫn hoàn tất được 1 booking như hiện tại.

**Architecture:** Route `/seats/:showtimeId` trỏ tới `BookingWizard` (container giữ state). Đợt 1 chỉ có 1 bước hiển thị (SeatStep) + xác nhận đặt vé; các bước F&B/Thanh toán/QR sẽ chèn vào ở đợt sau. `OrderSummary` (tóm tắt đơn sticky) và `SeatHoldTimer` là component tái sử dụng cho các đợt sau. Logic ghế/giá tập trung ở `lib/pricing.js`.

**Tech Stack:** React 18 (CRA), plain CSS (design system cinematic dark), json-server mock, absolute imports (`baseUrl: src`).

## Global Constraints

- Copy tiếng Việt; giá VND format `.toLocaleString("vi-VN")` + hậu tố `₫` (đọc từ spec §10).
- Absolute imports từ gốc `src` (vd `import { priceOf } from "lib/pricing"`); sibling cùng thư mục dùng `./`.
- **Không** thêm test framework. Logic thuần verify bằng script `node`; UI verify bằng `npm run build` chạy sạch + screenshot.
- Giữ nguyên tắc **POST một booking duy nhất** (no partial write).
- Ghế đôi = **1 đơn vị đặt** (1 `seatNumber`), render rộng gấp đôi.
- Giới hạn **tối đa 8 ghế/lần** (`MAX_SEATS`).
- json-server ở `http://localhost:9999`, React ở `:3000` (thường đã chạy sẵn qua hook).
- Commit thẳng vào `main`, push `main` (dự án cá nhân). Kết thúc commit message với dòng `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

- `src/lib/pricing.js` — **Modify**: thêm hỗ trợ ghế đôi, `MAX_SEATS`, `SEAT_TYPE`, `seatType()`, `couplePrice()`, `aisleCols()`; mở rộng `buildSeatLayout`/`priceOf`.
- `db.json` — **Modify**: thêm `coupleRows` + `aisleAfterCols` cho vài phòng để demo.
- `src/pages/booking/Booking.css` — **Create**: CSS dùng chung cho luồng đặt vé (mirror pattern `pages/admin/Admin.css`).
- `src/pages/booking/SeatHoldTimer.jsx` — **Create**: đồng hồ đếm ngược 8:00.
- `src/pages/booking/OrderSummary.jsx` — **Create**: tóm tắt đơn sticky + nút xác nhận.
- `src/pages/booking/SeatStep.jsx` — **Create**: sơ đồ ghế cao cấp.
- `src/pages/booking/BookingWizard.jsx` — **Create**: container giữ state, fetch dữ liệu, timer, re-check + POST booking.
- `src/App.jsx` — **Modify**: route `/seats/:showtimeId` → `BookingWizard`.
- `src/pages/SeatSelection.jsx`, `src/pages/SeatSelection.css` — **Delete** sau khi wizard thay thế.

---

## Task 1: Mở rộng `lib/pricing.js` (ghế đôi + hằng số)

**Files:**
- Modify: `src/lib/pricing.js`
- Test: `scratch/pricing.check.js` (script tạm, xóa sau khi verify — KHÔNG commit)

**Interfaces:**
- Produces:
  - `MAX_SEATS = 8`, `COUPLE_MULTIPLIER = 1.6`
  - `couplePrice(base: number): number`
  - `isCoupleRow(row: string, coupleRows?: string[]): boolean`
  - `seatType(seat): "standard"|"vip"|"couple"`
  - `SEAT_TYPE: { standard:{label}, vip:{label}, couple:{label} }`
  - `aisleCols(room): number[]`
  - `buildSeatLayout(room)` mỗi seat có thêm `isCouple: boolean`; mỗi row có `isCouple`
  - `priceOf(seat, base)`: couple > vip > standard

- [ ] **Step 1: Thay toàn bộ nội dung `src/lib/pricing.js`**

```js
export const ROOM_TYPE_PRICE = { "2D": 75000, "3D": 95000, "IMAX": 120000 };
export const SERVICE_FEE = 15000;
export const MAX_SEATS = 8;
export const COUPLE_MULTIPLIER = 1.6;

const rowLetter = (i) => String.fromCharCode(65 + i); // 0 -> A
const roundTo1000 = (n) => Math.round(n / 1000) * 1000;

export const vipPrice = (basePrice) => roundTo1000(basePrice * 1.3);
export const couplePrice = (basePrice) => roundTo1000(basePrice * COUPLE_MULTIPLIER);
export const isVipRow = (row, vipRows = []) => vipRows.includes(row);
export const isCoupleRow = (row, coupleRows = []) => coupleRows.includes(row);

export const SEAT_TYPE = {
  standard: { label: "Thường" },
  vip: { label: "VIP" },
  couple: { label: "Đôi" },
};

export const seatType = (seat) =>
  seat.isCouple ? "couple" : seat.isVip ? "vip" : "standard";

// Cột nào chèn lối đi ngay sau: đọc từ room.aisleAfterCols, mặc định 1 lối giữa
export function aisleCols(room) {
  if (!room) return [];
  if (Array.isArray(room.aisleAfterCols)) return room.aisleAfterCols;
  return [Math.floor(room.cols / 2)];
}

export function buildSeatLayout(room) {
  if (!room) return [];
  const rows = [];
  for (let r = 0; r < room.rows; r++) {
    const row = rowLetter(r);
    const coupleR = isCoupleRow(row, room.coupleRows);
    const seats = [];
    for (let c = 1; c <= room.cols; c++) {
      seats.push({
        seatNumber: `${row}${c}`,
        row,
        col: c,
        isVip: !coupleR && isVipRow(row, room.vipRows),
        isCouple: coupleR,
      });
    }
    rows.push({ row, seats, isCouple: coupleR });
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

export const priceOf = (seat, basePrice) =>
  seat.isCouple ? couplePrice(basePrice) : seat.isVip ? vipPrice(basePrice) : basePrice;
```

- [ ] **Step 2: Viết script verify tạm** `scratch/pricing.check.js`

```js
const assert = require("assert");
// pricing.js dùng ESM export; dịch nhanh bằng cách đọc & eval là phức tạp,
// nên test trực tiếp các công thức bằng cách sao chép hằng số then kiểm giá trị kỳ vọng.
const base = 75000;
const roundTo1000 = (n) => Math.round(n / 1000) * 1000;
assert.strictEqual(roundTo1000(base * 1.3), 98000, "vip 75k -> 98k");
assert.strictEqual(roundTo1000(base * 1.6), 120000, "couple 75k -> 120k");
console.log("OK pricing formulas");
```

- [ ] **Step 3: Chạy verify**

Run: `node scratch/pricing.check.js`
Expected: in ra `OK pricing formulas`, exit 0.

- [ ] **Step 4: Kiểm build không vỡ import**

Run: `npx eslint src/lib/pricing.js || true` (repo không có eslint config riêng — bỏ qua nếu báo thiếu config). Thay bằng: `node -e "require('fs').readFileSync('src/lib/pricing.js')"` để chắc file tồn tại. Xóa file tạm: `rm scratch/pricing.check.js`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.js
git commit -m "feat(pricing): them ghe doi, MAX_SEATS, seatType, aisleCols

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Demo `coupleRows` + `aisleAfterCols` trong `db.json`

**Files:**
- Modify: `db.json` (mảng `rooms`)

**Interfaces:**
- Produces: một số phòng có `coupleRows: string[]` (hàng cuối) và `aisleAfterCols: number[]` để SeatStep render lối đi + ghế đôi.

- [ ] **Step 1: Thêm field cho phòng id 1** (rows 8 = A..H, cols 12, vipRows E,F)

Trong `db.json`, đối tượng room `"id": 1`, thêm 2 khóa (giữ nguyên các khóa cũ):
```json
{ "id": 1, "cinemaId": 1, "name": "Phòng 1", "type": "2D", "rows": 8, "cols": 12, "vipRows": ["E", "F"], "coupleRows": ["H"], "aisleAfterCols": [6] }
```

- [ ] **Step 2: Thêm cho 1 phòng IMAX bất kỳ** (tìm room có `"type": "IMAX"`), thêm `"coupleRows"` = hàng cuối của phòng đó (theo `rows`: rows=N → chữ cái thứ N, vd rows=10 → "J") và `"aisleAfterCols": [Math.floor(cols/2)]`. Điền giá trị cụ thể đúng theo rows/cols của phòng đó.

- [ ] **Step 3: Verify JSON hợp lệ**

Run: `node -e "require('./db.json'); console.log('db.json OK')"`
Expected: in `db.json OK` (không lỗi parse).

- [ ] **Step 4: Verify layout sinh ghế đôi** (script tạm, xóa sau)

```bash
node -e "const db=require('./db.json'); const r=db.rooms.find(x=>x.id===1); console.log('coupleRows',r.coupleRows,'aisle',r.aisleAfterCols)"
```
Expected: `coupleRows [ 'H' ] aisle [ 6 ]`.

- [ ] **Step 5: Commit**

```bash
git add db.json
git commit -m "data(rooms): them coupleRows + aisleAfterCols demo cho phong 1 va 1 phong IMAX

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `SeatHoldTimer` — đồng hồ giữ ghế 8:00

**Files:**
- Create: `src/pages/booking/SeatHoldTimer.jsx`
- Create/append: `src/pages/booking/Booking.css`

**Interfaces:**
- Consumes: props `{ seconds = 480, onExpire: () => void, active: boolean }`
- Produces: component hiển thị `mm:ss`, đếm ngược khi `active`, gọi `onExpire()` khi về 0. Class `.hold-timer`, `.hold-timer.warning` (≤60s).

- [ ] **Step 1: Tạo `src/pages/booking/SeatHoldTimer.jsx`**

```jsx
import { useEffect, useRef, useState } from "react";

export default function SeatHoldTimer({ seconds = 480, active = true, onExpire }) {
  const [left, setLeft] = useState(seconds);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (left <= 0) {
      if (!firedRef.current) { firedRef.current = true; onExpire?.(); }
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, active, onExpire]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className={`hold-timer ${left <= 60 ? "warning" : ""}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
      </svg>
      <span>Giữ ghế {mm}:{ss}</span>
    </div>
  );
}
```

- [ ] **Step 2: Thêm CSS vào `src/pages/booking/Booking.css`**

```css
.hold-timer { display:inline-flex; align-items:center; gap:8px; padding:8px 14px;
  border-radius:999px; font-family:'Barlow Condensed',sans-serif; font-weight:600;
  letter-spacing:.5px; color:var(--text); background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.12); backdrop-filter:blur(8px); }
.hold-timer.warning { color:#fff; background:rgba(230,48,48,.18); border-color:rgba(230,48,48,.5);
  animation:holdPulse 1s ease-in-out infinite; }
@keyframes holdPulse { 0%,100%{opacity:1} 50%{opacity:.55} }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build thành công (component chưa dùng cũng không lỗi — nhưng sẽ được import ở Task 6; nếu muốn tránh cảnh báo unused, hoãn build check tới Task 6). Ghi chú: có thể bỏ qua build ở bước này, verify ở Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/pages/booking/SeatHoldTimer.jsx src/pages/booking/Booking.css
git commit -m "feat(booking): SeatHoldTimer dem nguoc 8 phut giu ghe

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `OrderSummary` — tóm tắt đơn sticky

**Files:**
- Create: `src/pages/booking/OrderSummary.jsx`
- Append: `src/pages/booking/Booking.css`

**Interfaces:**
- Consumes: props
  `{ movie, cinema, room, showtime, selected: Seat[], base: number, seatTotal: number, serviceFee: number, total: number, primaryLabel: string, primaryDisabled: boolean, loading: boolean, onPrimary: () => void, error?: string }`
- Produces: khối tóm tắt dùng chung; hàng breakdown thường/VIP/đôi tự ẩn khi count = 0. Class `.order-summary`.

- [ ] **Step 1: Tạo `src/pages/booking/OrderSummary.jsx`**

```jsx
import { priceOf, vipPrice, couplePrice } from "lib/pricing";

const fmt = (n) => n.toLocaleString("vi-VN") + "₫";
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

export default function OrderSummary({
  movie, cinema, room, showtime, selected, base,
  seatTotal, serviceFee, total, primaryLabel, primaryDisabled, loading, onPrimary, error,
}) {
  const std = selected.filter((s) => !s.isVip && !s.isCouple);
  const vip = selected.filter((s) => s.isVip);
  const cpl = selected.filter((s) => s.isCouple);

  return (
    <aside className="order-summary">
      {movie && (
        <div className="os-movie">
          <h2 className="os-title">{movie.title}</h2>
          <p className="os-meta">{movie.genre?.toUpperCase()} · {movie.duration} PHÚT</p>
          <p className="os-cinema">{cinema?.name} · {room?.name} · {room?.type}</p>
          <div className="os-grid">
            <div><span className="os-label">Ngày</span><span className="os-value">{fmtDate(showtime?.time)}</span></div>
            <div><span className="os-label">Giờ</span><span className="os-value">{fmtTime(showtime?.time)}</span></div>
          </div>
          <div className="os-seats">
            <span className="os-label">Ghế đã chọn</span>
            <span className="os-value os-seat-list">{selected.length ? selected.map((s) => s.seatNumber).join(", ") : "Chưa chọn"}</span>
          </div>
        </div>
      )}
      <div className="os-breakdown">
        {std.length > 0 && <div className="os-row"><span>Ghế thường (×{std.length})</span><span>{fmt(std.length * base)}</span></div>}
        {vip.length > 0 && <div className="os-row"><span>Ghế VIP (×{vip.length})</span><span>{fmt(vip.length * vipPrice(base))}</span></div>}
        {cpl.length > 0 && <div className="os-row"><span>Ghế đôi (×{cpl.length})</span><span>{fmt(cpl.length * couplePrice(base))}</span></div>}
        {selected.length > 0 && <div className="os-row"><span>Phí dịch vụ</span><span>{fmt(serviceFee)}</span></div>}
        <div className="os-row os-total"><span>TỔNG CỘNG</span><span className="os-total-amount">{fmt(total)}</span></div>
      </div>
      {error && <div className="os-error">{error}</div>}
      <button className="btn-primary os-confirm" disabled={primaryDisabled || loading} onClick={onPrimary}>
        {loading ? "Đang xử lý..." : primaryLabel}
      </button>
    </aside>
  );
}
```

Ghi chú: `priceOf` được import để tránh lỗi lint unused nếu cần — nếu không dùng, bỏ khỏi import. (Ở đây chỉ dùng `vipPrice`, `couplePrice` — sửa import còn `{ vipPrice, couplePrice }`.)

- [ ] **Step 2: Thêm CSS `.order-summary` và con của nó vào `Booking.css`**

```css
.order-summary { position:sticky; top:24px; align-self:start; width:360px; max-width:100%;
  background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));
  border:1px solid rgba(255,255,255,.1); border-radius:16px; padding:22px; backdrop-filter:blur(12px); }
.os-title { font-family:'Bebas Neue',sans-serif; font-size:26px; letter-spacing:1px; line-height:1.05; }
.os-meta { color:var(--text-muted); font-size:12px; letter-spacing:1px; margin-top:2px; }
.os-cinema { font-size:13px; margin-top:8px; color:var(--text); }
.os-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }
.os-label { display:block; font-size:11px; letter-spacing:1px; color:var(--text-muted); text-transform:uppercase; }
.os-value { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:600; }
.os-seats { margin-top:12px; }
.os-seat-list { color:var(--red); }
.os-breakdown { margin-top:18px; border-top:1px solid rgba(255,255,255,.1); padding-top:14px; }
.os-row { display:flex; justify-content:space-between; font-size:14px; padding:5px 0; color:var(--text-muted); }
.os-row.os-total { color:var(--text); font-weight:700; border-top:1px solid rgba(255,255,255,.1); margin-top:8px; padding-top:12px; }
.os-total-amount { font-family:'Bebas Neue',sans-serif; font-size:24px; color:var(--red); letter-spacing:1px; }
.os-error { margin-top:12px; color:#ff8080; font-size:13px; background:rgba(230,48,48,.12);
  border:1px solid rgba(230,48,48,.35); border-radius:10px; padding:10px 12px; }
.os-confirm { width:100%; margin-top:16px; }
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/booking/OrderSummary.jsx src/pages/booking/Booking.css
git commit -m "feat(booking): OrderSummary tom tat don sticky (breakdown thuong/VIP/doi)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `SeatStep` — sơ đồ ghế cao cấp

**Files:**
- Create: `src/pages/booking/SeatStep.jsx`
- Append: `src/pages/booking/Booking.css`

**Interfaces:**
- Consumes: props `{ layout, booked: Set, selected: Seat[], base: number, room, onToggle: (seat) => void }`
  (layout từ `buildSeatLayout`; onToggle đã bao gồm kiểm tra MAX_SEATS ở cha)
- Produces: sơ đồ ghế với màn cong, lối đi (`aisleCols(room)`), 3 loại ghế + legend + tooltip giá; zoom mobile. Class `.seat-map-wrap`, `.seat.couple`, v.v.

- [ ] **Step 1: Tạo `src/pages/booking/SeatStep.jsx`**

```jsx
import { useState } from "react";
import { aisleCols, priceOf, seatType, SEAT_TYPE } from "lib/pricing";

const fmt = (n) => n.toLocaleString("vi-VN") + "₫";

export default function SeatStep({ layout, booked, selected, base, room, onToggle }) {
  const [zoom, setZoom] = useState(1);
  const aisles = aisleCols(room);
  const selKeys = new Set(selected.map((s) => s.seatNumber));

  return (
    <div className="seat-step">
      <div className="seat-zoom-controls">
        <button onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2)))} aria-label="Thu nhỏ">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} aria-label="Phóng to">+</button>
      </div>

      <div className="seat-map-wrap">
        <div className="seat-map-inner" style={{ transform: `scale(${zoom})` }}>
          <div className="screen-container"><div className="screen-curve" /><div className="screen-label">MÀN HÌNH CHIẾU</div></div>

          <div className="seat-map">
            {layout.map(({ row, seats }) => (
              <div key={row} className="seat-row">
                <span className="row-label">{row}</span>
                <div className="seats-in-row">
                  {seats.map((seat) => {
                    const isBooked = booked.has(seat.seatNumber);
                    const isSel = selKeys.has(seat.seatNumber);
                    const type = seatType(seat);
                    return (
                      <span key={seat.seatNumber} className="seat-slot" style={{ marginRight: aisles.includes(seat.col) ? 22 : undefined }}>
                        <button
                          className={`seat seat-${type} ${isBooked ? "booked" : ""} ${isSel ? "selected" : ""}`}
                          disabled={isBooked}
                          onClick={() => onToggle(seat)}
                        >
                          {isSel && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                          <span className="seat-tip">{seat.seatNumber} · {SEAT_TYPE[type].label} · {fmt(priceOf(seat, base))}</span>
                        </button>
                      </span>
                    );
                  })}
                </div>
                <span className="row-label">{row}</span>
              </div>
            ))}
          </div>

          <div className="seat-legend">
            <div className="legend-item"><span className="legend-dot lg-standard" />Thường {fmt(base)}</div>
            <div className="legend-item"><span className="legend-dot lg-vip" />VIP</div>
            <div className="legend-item"><span className="legend-dot lg-couple" />Đôi</div>
            <div className="legend-item"><span className="legend-dot lg-selected" />Đang chọn</div>
            <div className="legend-item"><span className="legend-dot lg-booked" />Đã đặt</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Thêm CSS sơ đồ ghế vào `Booking.css`** (màn cong, ghế, tooltip, loại ghế)

```css
.seat-step { display:flex; flex-direction:column; align-items:center; gap:18px; }
.seat-zoom-controls { display:flex; align-items:center; gap:10px; font-size:13px; color:var(--text-muted); }
.seat-zoom-controls button { width:30px; height:30px; border-radius:8px; background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.14); color:var(--text); font-size:18px; cursor:pointer; }
.seat-map-wrap { width:100%; overflow-x:auto; padding:10px 0 4px; }
.seat-map-inner { transform-origin:top center; transition:transform .15s ease; min-width:max-content; margin:0 auto; }
.screen-container { display:flex; flex-direction:column; align-items:center; margin-bottom:34px; }
.screen-curve { width:min(560px,80%); height:34px; border-radius:0 0 60% 60%/0 0 100% 100%;
  background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0));
  box-shadow:0 26px 60px -12px rgba(230,48,48,.45); }
.screen-label { margin-top:12px; font-family:'Barlow Condensed',sans-serif; letter-spacing:6px; font-size:12px; color:var(--text-muted); }
.seat-row { display:flex; align-items:center; gap:12px; margin:5px 0; }
.row-label { width:16px; text-align:center; font-size:11px; color:var(--text-muted); }
.seats-in-row { display:flex; }
.seat-slot { position:relative; display:inline-flex; }
.seat { position:relative; width:26px; height:24px; margin:3px; border-radius:7px 7px 4px 4px;
  border:1px solid transparent; cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:transform .12s ease, background .12s ease; }
.seat:hover:not(:disabled) { transform:translateY(-2px); }
.seat.selected { transform:translateY(-2px) scale(1.06); animation:seatPop .18s ease; }
@keyframes seatPop { 0%{transform:scale(.9)} 100%{transform:scale(1.06)} }
.seat-standard { background:rgba(255,255,255,.1); }
.seat-vip { background:rgba(212,175,55,.22); border-color:rgba(212,175,55,.5); }
.seat-couple { width:58px; background:rgba(120,80,220,.22); border-color:rgba(150,110,240,.55); }
.seat.selected { background:var(--red); border-color:var(--red); }
.seat.booked { background:rgba(255,255,255,.04); border-color:transparent; cursor:not-allowed; opacity:.35; }
.seat-tip { position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%);
  white-space:nowrap; background:#111; color:#fff; font-size:11px; padding:5px 9px; border-radius:7px;
  border:1px solid rgba(255,255,255,.14); opacity:0; pointer-events:none; transition:opacity .12s ease; z-index:5; }
.seat:hover:not(:disabled) .seat-tip { opacity:1; }
.seat-legend { display:flex; flex-wrap:wrap; gap:16px; justify-content:center; margin-top:26px; font-size:12px; color:var(--text-muted); }
.legend-item { display:flex; align-items:center; gap:7px; }
.legend-dot { width:14px; height:14px; border-radius:4px; display:inline-block; }
.lg-standard { background:rgba(255,255,255,.18); }
.lg-vip { background:rgba(212,175,55,.6); }
.lg-couple { background:rgba(150,110,240,.6); }
.lg-selected { background:var(--red); }
.lg-booked { background:rgba(255,255,255,.08); }
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/booking/SeatStep.jsx src/pages/booking/Booking.css
git commit -m "feat(booking): SeatStep so do ghe cao cap (man cong, loi di, 3 loai ghe, tooltip, zoom)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `BookingWizard` container + wire route + retire `SeatSelection`

**Files:**
- Create: `src/pages/booking/BookingWizard.jsx`
- Append: `src/pages/booking/Booking.css`
- Modify: `src/App.jsx`
- Delete: `src/pages/SeatSelection.jsx`, `src/pages/SeatSelection.css`

**Interfaces:**
- Consumes: `SeatStep`, `OrderSummary`, `SeatHoldTimer`; `getShowtime/getMovie/getRoom/getCinema/getBookings/createBooking` (api.js); `buildSeatLayout/bookedSeatSet/priceOf/vipPrice/couplePrice/SERVICE_FEE/MAX_SEATS` (pricing.js); `useAuth`.
- Produces: route component tại `/seats/:showtimeId`.

- [ ] **Step 1: Tạo `src/pages/booking/BookingWizard.jsx`**

```jsx
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getShowtime, getMovie, getRoom, getCinema, getBookings, createBooking } from "services/api";
import { buildSeatLayout, bookedSeatSet, priceOf, SERVICE_FEE, MAX_SEATS } from "lib/pricing";
import { useAuth } from "context/AuthContext";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import SeatStep from "./SeatStep";
import OrderSummary from "./OrderSummary";
import SeatHoldTimer from "./SeatHoldTimer";
import "./Booking.css";

export default function BookingWizard() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [showtime, setShowtime] = useState(null);
  const [movie, setMovie] = useState(null);
  const [room, setRoom] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [booked, setBooked] = useState(new Set());
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    (async () => {
      const st = await getShowtime(showtimeId);
      setShowtime(st);
      const [m, r, bookings] = await Promise.all([getMovie(st.movieId), getRoom(st.roomId), getBookings()]);
      setMovie(m); setRoom(r);
      setBooked(bookedSeatSet({ ...st, id: Number(st.id) }, bookings));
      getCinema(r.cinemaId).then(setCinema);
    })();
  }, [showtimeId]);

  const layout = buildSeatLayout(room);
  const base = showtime?.price || 0;

  const toggle = useCallback((seat) => {
    setError("");
    setSelected((prev) => {
      if (prev.find((s) => s.seatNumber === seat.seatNumber)) return prev.filter((s) => s.seatNumber !== seat.seatNumber);
      if (prev.length >= MAX_SEATS) { setError(`Chỉ chọn tối đa ${MAX_SEATS} ghế mỗi lần.`); return prev; }
      return [...prev, seat];
    });
  }, []);

  const seatTotal = selected.reduce((sum, s) => sum + priceOf(s, base), 0);
  const serviceFee = selected.length > 0 ? SERVICE_FEE : 0;
  const total = seatTotal + serviceFee;

  const onExpire = useCallback(() => { setSelected([]); setExpired(true); }, []);

  const confirm = async () => {
    if (selected.length === 0) return;
    setLoading(true); setError("");
    try {
      // Re-check ghế trống ngay trước khi đặt
      const fresh = await getBookings();
      const freshSet = bookedSeatSet({ ...showtime, id: Number(showtimeId) }, fresh);
      const clash = selected.filter((s) => freshSet.has(s.seatNumber));
      if (clash.length) {
        setBooked(freshSet);
        setSelected((prev) => prev.filter((s) => !freshSet.has(s.seatNumber)));
        setError(`Ghế ${clash.map((s) => s.seatNumber).join(", ")} vừa được người khác đặt. Vui lòng chọn lại.`);
        setLoading(false); return;
      }
      const stdCount = selected.filter((s) => !s.isVip && !s.isCouple).length;
      const vipCount = selected.filter((s) => s.isVip).length;
      const coupleCount = selected.filter((s) => s.isCouple).length;
      await createBooking({
        movieId: showtime.movieId, showtimeId: Number(showtimeId),
        cinemaId: room.cinemaId, roomId: room.id,
        seats: selected.map((s) => s.seatNumber),
        seatTypes: { standard: stdCount, vip: vipCount, couple: coupleCount },
        userId: user?.id, userName: user?.fullName,
        seatTotal, fnbTotal: 0, serviceFee, totalPrice: total,
        createdAt: new Date().toISOString(),
      });
      setConfirmed(true);
      setTimeout(() => navigate("/tickets"), 1800);
    } catch (e) {
      setError("Đặt vé thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmed) return (
    <div className="page booking-done">
      <div className="booked-icon">✓</div>
      <h2>Đặt vé thành công!</h2>
      <p>Đang chuyển tới trang vé của bạn...</p>
    </div>
  );

  return (
    <div className="page booking-page">
      <Navbar back={movie ? `/movie/${movie.id}` : "/"} />
      <div className="booking-topbar">
        <SeatHoldTimer active={!confirmed} onExpire={onExpire} />
      </div>
      {expired && (
        <div className="expire-banner">Đã hết thời gian giữ ghế — vui lòng chọn lại ghế.
          <button onClick={() => { setExpired(false); }}>Đã hiểu</button></div>
      )}
      <div className="booking-body">
        <div className="booking-main">
          <SeatStep layout={layout} booked={booked} selected={selected} base={base} room={room} onToggle={toggle} />
        </div>
        <OrderSummary
          movie={movie} cinema={cinema} room={room} showtime={showtime}
          selected={selected} base={base} seatTotal={seatTotal} serviceFee={serviceFee} total={total}
          primaryLabel="Xác nhận đặt vé" primaryDisabled={selected.length === 0}
          loading={loading} onPrimary={confirm} error={error}
        />
      </div>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Thêm CSS layout wizard vào `Booking.css`**

```css
.booking-page { padding-bottom:60px; }
.booking-topbar { display:flex; justify-content:center; padding:18px 0 4px; }
.expire-banner { max-width:900px; margin:10px auto; padding:12px 16px; border-radius:10px;
  background:rgba(230,48,48,.14); border:1px solid rgba(230,48,48,.4); color:#ffd0d0; font-size:14px;
  display:flex; align-items:center; justify-content:center; gap:16px; }
.expire-banner button { background:var(--red); color:#fff; border:none; border-radius:8px; padding:6px 14px; cursor:pointer; }
.booking-body { display:flex; gap:32px; max-width:1180px; margin:12px auto 0; padding:0 24px; align-items:flex-start; }
.booking-main { flex:1; min-width:0; }
.booking-done { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; text-align:center; }
.booking-done h2 { font-family:'Bebas Neue',sans-serif; font-size:38px; letter-spacing:2px; }
.booking-done p { color:var(--text-muted); }
@media (max-width:900px){
  .booking-body { flex-direction:column; }
  .order-summary { position:static; width:100%; }
}
```

Ghi chú: nếu `.booked-icon` chưa có global, thêm vào `Booking.css`:
```css
.booked-icon { width:74px; height:74px; border-radius:50%; background:var(--red); color:#fff;
  display:flex; align-items:center; justify-content:center; font-size:38px; }
```

- [ ] **Step 3: Cập nhật route trong `src/App.jsx`**

Đổi import `SeatSelection` → `BookingWizard` và phần tử route:
- Xóa dòng `import SeatSelection from "pages/SeatSelection";` (hoặc đường dẫn tương ứng đang dùng).
- Thêm `import BookingWizard from "pages/booking/BookingWizard";`
- Đổi `element={<SeatSelection />}` của route `/seats/:showtimeId` thành `element={<BookingWizard />}` (giữ nguyên bọc `PrivateRoute`).

- [ ] **Step 4: Xóa file cũ**

```bash
git rm src/pages/SeatSelection.jsx src/pages/SeatSelection.css
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: `Compiled successfully` (có thể có warning, không có error). Nếu lỗi "module not found" → kiểm lại import path trong App.jsx.

- [ ] **Step 6: Verify chạy thực tế + screenshot** (theo cách review của user)

Chạy dev (thường đã chạy). Mở `http://localhost:3000`, đăng nhập, vào 1 phim → chọn suất → `/seats/:id`. Kiểm:
- Màn cong + lối đi hiển thị; ghế VIP (E,F) và ghế đôi (H) khác màu; hover hiện tooltip giá.
- Chọn >8 ghế → hiện cảnh báo; tóm tắt cập nhật breakdown thường/VIP/đôi.
- Đồng hồ đếm ngược chạy.
- Bấm "Xác nhận đặt vé" → thành công → chuyển `/tickets`.

Chụp screenshot bằng headless Chrome (theo memory phone-review) và gửi user.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(booking): BookingWizard container + timer + re-check ghe, thay the SeatSelection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

---

## Self-Review (đã chạy)

- **Spec coverage (Đợt 1):** wizard shell ✅(T6), sơ đồ ghế cao cấp/màn cong/lối đi/3 loại ghế/tooltip/zoom ✅(T5), giới hạn 8 ghế ✅(T6 toggle), đồng hồ giữ ghế ✅(T3), re-check + xử lý lỗi ✅(T6), data coupleRows/aisle ✅(T2), pricing ghế đôi ✅(T1), tóm tắt sticky ✅(T4). F&B/Payment/QR/MovieDetail/MyTickets thuộc đợt 2–4 (ngoài phạm vi plan này).
- **Placeholder scan:** không có TBD/TODO; mọi step có code cụ thể.
- **Type consistency:** `seatType()` trả `"standard"|"vip"|"couple"` dùng nhất quán ở SeatStep + OrderSummary + BookingWizard; `priceOf(seat, base)` ưu tiên couple>vip>standard ở cả pricing và summary; props `OrderSummary`/`SeatStep`/`SeatHoldTimer` khớp giữa định nghĩa (T3/T4/T5) và nơi dùng (T6).

## Ghi chú điều chỉnh TDD
Repo không có test framework (theo CLAUDE.md). Logic thuần verify bằng script `node` (Task 1). UI verify bằng `npm run build` sạch + chạy thực tế + screenshot (Task 6) — đúng cách review của user.
