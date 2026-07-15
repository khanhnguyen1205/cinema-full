# Booking Flow — Đợt 2 (Bắp nước / F&B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bước ② "Bắp nước" vào `BookingWizard` — catalog concessions từ json-server, chọn số lượng, cộng `fnbTotal` vào đơn và lưu vào booking.

**Architecture:** Giữ nguyên container `BookingWizard` (route `/seats/:showtimeId`) làm nơi chứa toàn bộ state. Thêm state `step` (1→2) + `qty` (map `{concessionId: number}`). `BookingStepper` mới hiển thị tiến trình; `ConcessionStep` mới render lưới combo. Tiền F&B tính bằng helper thuần trong `lib/pricing.js`. Đợt 2 **chưa có** PaymentStep nên nút xác nhận + `POST /bookings` tạm nằm ở cuối bước ② — Đợt 3 sẽ dời sang bước ③.

**Tech Stack:** React 18 (CRA), json-server (`db.json`, port 9999), plain CSS (design system "cinematic dark"), absolute imports qua `jsconfig.json` (`baseUrl: "src"`).

## Global Constraints

- Copy hướng tới người dùng **bằng tiếng Việt**; giá VND format `.toLocaleString("vi-VN")` + hậu tố `₫`.
- Import cross-module dùng đường dẫn tuyệt đối từ `src` (`lib/pricing`, `services/api`); anh em cùng thư mục dùng `./`.
- **Không thêm dependency** trong đợt này (`qrcode.react` là của Đợt 3).
- **Không** có test framework / linter / type checker — verify bằng node assert script + `npm run build` + screenshot.
- Thay đổi `db.json` phải **additive / tương thích ngược**: booking cũ thiếu `concessions`/`fnbTotal` vẫn đọc được.
- Commit thẳng lên `main` (repo cá nhân, không dùng feature branch).
- Đường dẫn scratchpad dùng trong các lệnh verify:
  `C:/Users/ASUS/AppData/Local/Temp/claude/D--FPT-26SP-FER202-cinema-full/fcbcd278-1f08-4e7c-b84f-48f70a8ec499/scratchpad`

## File Structure

| File | Trách nhiệm |
|---|---|
| `db.json` (modify) | Thêm collection `concessions` (8 mục, 4 category) |
| `src/services/api.js` (modify) | Thêm `getConcessions()` |
| `src/lib/pricing.js` (modify) | Thêm `MAX_ITEM_QTY`, `fnbLines()`, `fnbTotal()` |
| `src/pages/booking/BookingStepper.jsx` (create) | Thanh tiến trình ①②③④ + nút Quay lại |
| `src/pages/booking/ConcessionStep.jsx` (create) | Lưới combo theo category + bộ đếm −/＋ |
| `src/pages/booking/OrderSummary.jsx` (modify) | Thêm các dòng F&B vào breakdown |
| `src/pages/booking/BookingWizard.jsx` (modify) | State `step`/`qty`/`catalog`, render step, payload mới |
| `src/pages/booking/Booking.css` (modify) | CSS cho stepper + F&B + topbar |

**Deviation từ spec (có chủ ý):** spec mục 5 nêu nút "**Bỏ qua**" ở bước ②. Ở Đợt 2 bước ② là bước cuối nên "Bỏ qua" trùng hoàn toàn với nút chính (xác nhận với 0 món) → **hoãn sang Đợt 3**, khi "Bỏ qua" mới có nghĩa là "sang thẳng Thanh toán". Không chọn món nào rồi bấm "Xác nhận đặt vé" vẫn hoạt động bình thường.

---

### Task 1: Dữ liệu concessions + API + helper tính tiền F&B

**Files:**
- Modify: `db.json` (thêm key `concessions` sau `bookings`)
- Modify: `src/services/api.js:33` (thêm sau `getBookings`)
- Modify: `src/lib/pricing.js` (thêm cuối file + hằng số đầu file)

**Interfaces:**
- Consumes: không (task đầu).
- Produces:
  - `getConcessions(): Promise<Concession[]>` — `Concession = { id:number, name:string, category:"combo"|"popcorn"|"drink"|"snack", price:number, description:string, image:string }`
  - `MAX_ITEM_QTY = 10`
  - `fnbLines(qtyMap: {[id:number]:number}, catalog: Concession[]): Line[]` — `Line = { id, name, qty, price, amount }`, bỏ qua qty ≤ 0 và id không có trong catalog, giữ thứ tự catalog.
  - `fnbTotal(qtyMap, catalog): number`

- [ ] **Step 1: Thêm collection `concessions` vào `db.json`**

Thêm **sau** mảng `"bookings"` (nhớ dấu phẩy sau `]` của bookings):

```json
  "concessions": [
    { "id": 1, "name": "Combo Cặp Đôi", "category": "combo", "price": 89000, "description": "2 nước ngọt lớn + 1 bắp lớn", "image": "🍿" },
    { "id": 2, "name": "Combo Gia Đình", "category": "combo", "price": 159000, "description": "4 nước ngọt vừa + 2 bắp lớn", "image": "🎬" },
    { "id": 3, "name": "Combo Solo", "category": "combo", "price": 65000, "description": "1 nước ngọt lớn + 1 bắp vừa", "image": "🎟️" },
    { "id": 4, "name": "Bắp Rang Bơ (Lớn)", "category": "popcorn", "price": 55000, "description": "Bắp rang vị bơ truyền thống, size lớn", "image": "🍿" },
    { "id": 5, "name": "Bắp Phô Mai (Vừa)", "category": "popcorn", "price": 49000, "description": "Bắp rang phủ phô mai, size vừa", "image": "🧀" },
    { "id": 6, "name": "Coca-Cola (Lớn)", "category": "drink", "price": 32000, "description": "Nước ngọt có ga, ly 32oz", "image": "🥤" },
    { "id": 7, "name": "Nước Suối Aquafina", "category": "drink", "price": 20000, "description": "Chai 500ml", "image": "💧" },
    { "id": 8, "name": "Snack Khoai Tây", "category": "snack", "price": 35000, "description": "Khoai tây chiên giòn vị BBQ", "image": "🍟" }
  ]
```

- [ ] **Step 2: Kiểm tra `db.json` vẫn là JSON hợp lệ**

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && node -e "const d=require('./db.json');console.log('collections:',Object.keys(d).join(', '));console.log('concessions:',d.concessions.length);console.log('categories:',[...new Set(d.concessions.map(c=>c.category))].join(','))"
```

Expected:
```
collections: users, movies, cities, cinemas, rooms, showtimes, bookings, concessions
concessions: 8
categories: combo,popcorn,drink,snack
```

- [ ] **Step 3: Thêm `getConcessions()` vào `src/services/api.js`**

Thêm ngay sau dòng `export const getBookings = ...` (dòng 33):

```js
export const getConcessions = () => fetch(`${BASE_URL}/concessions`).then(r => r.json());
```

- [ ] **Step 4: Thêm helper F&B vào `src/lib/pricing.js`**

Sửa dòng 3 (`export const MAX_SEATS = 8;`) thành 2 dòng:

```js
export const MAX_SEATS = 8;
export const MAX_ITEM_QTY = 10;
```

Thêm vào **cuối file**:

```js
// --- Bắp nước (F&B) ---
// qtyMap: { [concessionId]: number }. Trả về các dòng đơn theo thứ tự catalog.
export function fnbLines(qtyMap = {}, catalog = []) {
  return catalog
    .filter((c) => (qtyMap[c.id] || 0) > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      qty: qtyMap[c.id],
      price: c.price,
      amount: c.price * qtyMap[c.id],
    }));
}

export const fnbTotal = (qtyMap = {}, catalog = []) =>
  fnbLines(qtyMap, catalog).reduce((sum, l) => sum + l.amount, 0);
```

- [ ] **Step 5: Chạy assert script kiểm tra helper**

`pricing.js` là ESM không có import tương đối → copy sang `.mjs` rồi import trực tiếp:

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && SP="C:/Users/ASUS/AppData/Local/Temp/claude/D--FPT-26SP-FER202-cinema-full/fcbcd278-1f08-4e7c-b84f-48f70a8ec499/scratchpad" && cp src/lib/pricing.js "$SP/pricing.mjs" && node --input-type=module -e "
import assert from 'assert';
const { fnbLines, fnbTotal, MAX_ITEM_QTY } = await import('file:///C:/Users/ASUS/AppData/Local/Temp/claude/D--FPT-26SP-FER202-cinema-full/fcbcd278-1f08-4e7c-b84f-48f70a8ec499/scratchpad/pricing.mjs');
const catalog = [
  { id: 1, name: 'Combo Cặp Đôi', price: 89000 },
  { id: 4, name: 'Bắp Rang Bơ (Lớn)', price: 55000 },
  { id: 6, name: 'Coca-Cola (Lớn)', price: 32000 },
];
assert.strictEqual(MAX_ITEM_QTY, 10);
assert.deepStrictEqual(fnbLines({}, catalog), []);
assert.strictEqual(fnbTotal({}, catalog), 0);
assert.strictEqual(fnbTotal(undefined, undefined), 0);
assert.strictEqual(fnbTotal({ 1: 2 }, catalog), 178000);
assert.strictEqual(fnbTotal({ 1: 1, 4: 2, 6: 3 }, catalog), 89000 + 110000 + 96000);
assert.deepStrictEqual(fnbLines({ 4: 2 }, catalog), [{ id: 4, name: 'Bắp Rang Bơ (Lớn)', qty: 2, price: 55000, amount: 110000 }]);
assert.strictEqual(fnbTotal({ 99: 5 }, catalog), 0, 'id la phai bi bo qua');
assert.strictEqual(fnbTotal({ 1: 0 }, catalog), 0, 'qty 0 phai bi bo qua');
assert.deepStrictEqual(fnbLines({ 6: 1, 1: 1 }, catalog).map(l => l.id), [1, 6], 'phai giu thu tu catalog');
console.log('PRICING FNB OK');
"
```

Expected: `PRICING FNB OK` (không có AssertionError).

- [ ] **Step 6: Kiểm tra json-server phục vụ được endpoint mới**

json-server chạy với `--watch` nên tự nạp lại `db.json`.

```bash
curl -s http://localhost:9999/concessions?category=combo
```

Expected: JSON array 3 mục (`Combo Cặp Đôi`, `Combo Gia Đình`, `Combo Solo`).

- [ ] **Step 7: Commit**

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && git add db.json src/services/api.js src/lib/pricing.js && git commit -m "feat(booking): collection concessions + getConcessions + helper fnbLines/fnbTotal"
```

---

### Task 2: BookingStepper (thanh tiến trình)

**Files:**
- Create: `src/pages/booking/BookingStepper.jsx`
- Modify: `src/pages/booking/Booking.css` (thêm cuối file)

**Interfaces:**
- Consumes: không.
- Produces:
  - default export `BookingStepper({ step: number, steps?: Step[], onBack?: () => void })` — `Step = { n: number, label: string }`
  - named export `BOOKING_STEPS: Step[]` — đủ 4 bước của spec.

- [ ] **Step 1: Tạo `src/pages/booking/BookingStepper.jsx`**

```jsx
export const BOOKING_STEPS = [
  { n: 1, label: "Chọn ghế" },
  { n: 2, label: "Bắp nước" },
  { n: 3, label: "Thanh toán" },
  { n: 4, label: "Vé của bạn" },
];

export default function BookingStepper({ step, steps = BOOKING_STEPS, onBack }) {
  return (
    <div className="stepper">
      <button className="stepper-back" onClick={onBack} disabled={step <= 1}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Quay lại
      </button>
      <ol className="stepper-list">
        {steps.map(({ n, label }, i) => (
          <li key={n} className={`stepper-item ${n === step ? "current" : ""} ${n < step ? "done" : ""}`}>
            <span className="stepper-dot">{n < step ? "✓" : n}</span>
            <span className="stepper-label">{label}</span>
            {i < steps.length - 1 && <span className="stepper-line" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Thêm CSS vào cuối `src/pages/booking/Booking.css`**

```css
/* --- Stepper --- */
.stepper { display:flex; align-items:center; gap:20px; }
.stepper-back { display:inline-flex; align-items:center; gap:6px; padding:7px 13px; border-radius:999px;
  background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); color:var(--text);
  font-family:'Barlow Condensed',sans-serif; font-weight:600; letter-spacing:.5px; font-size:14px; cursor:pointer;
  transition:background .12s ease, opacity .12s ease; }
.stepper-back:hover:not(:disabled) { background:rgba(255,255,255,.12); }
.stepper-back:disabled { opacity:0; pointer-events:none; }
.stepper-list { display:flex; align-items:center; gap:0; list-style:none; margin:0; padding:0; }
.stepper-item { display:flex; align-items:center; gap:8px; color:var(--text-muted); }
.stepper-dot { width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:14px; flex-shrink:0;
  background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); transition:all .18s ease; }
.stepper-label { font-family:'Barlow Condensed',sans-serif; font-size:14px; letter-spacing:.6px;
  text-transform:uppercase; white-space:nowrap; }
.stepper-line { width:44px; height:1px; background:rgba(255,255,255,.14); margin:0 14px; }
.stepper-item.current { color:var(--text); }
.stepper-item.current .stepper-dot { background:var(--red); border-color:var(--red); color:#fff;
  box-shadow:0 0 0 4px rgba(230,48,48,.18); }
.stepper-item.done .stepper-dot { background:rgba(230,48,48,.2); border-color:rgba(230,48,48,.5); color:var(--red); }
@media (max-width:700px){
  .stepper-label { display:none; }
  .stepper-line { width:22px; margin:0 8px; }
}
```

- [ ] **Step 3: Build để chắc chắn không lỗi cú pháp**

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && npm run build
```

Expected: `Compiled successfully.` (cảnh báo có sẵn từ trước thì bỏ qua; **không** được có lỗi mới).

- [ ] **Step 4: Commit**

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && git add src/pages/booking/BookingStepper.jsx src/pages/booking/Booking.css && git commit -m "feat(booking): BookingStepper thanh tien trinh 4 buoc"
```

---

### Task 3: ConcessionStep (lưới bắp nước)

**Files:**
- Create: `src/pages/booking/ConcessionStep.jsx`
- Modify: `src/pages/booking/Booking.css` (thêm cuối file)

**Interfaces:**
- Consumes: `MAX_ITEM_QTY` từ `lib/pricing` (Task 1); shape `Concession` (Task 1).
- Produces: default export `ConcessionStep({ catalog: Concession[], qty: {[id]:number}, onChange: (id:number, delta:number) => void, loading: boolean })`.
  `onChange` được gọi với **delta** `+1`/`-1`, **không phải** giá trị tuyệt đối. Lý do: delta được cộng vào state trước đó bên trong `setQty`, nên **toàn bộ việc kẹp biên `[0, MAX_ITEM_QTY]` nằm gọn một chỗ** ở BookingWizard (Task 5); `disabled` trong ConcessionStep chỉ còn là gợi ý giao diện, không phải nơi giữ ràng buộc. Component con không cần biết luật, container là nguồn sự thật duy nhất.

  > Ghi chú lịch sử: bản đầu dùng `onChange(id, n + 1)` với `n` lấy từ lần render hiện tại. Test bằng puppeteer thấy bấm `+` hai lần chỉ lên 1 và tôi đã kết luận nhầm rằng người dùng bấm nhanh sẽ mất nhịp. Thực tế app dùng `createRoot` (React 18), click là discrete event được flush đồng bộ → hai click thật nằm ở hai task, có re-render xen giữa, nên bản cũ **vẫn đúng với người dùng**. Lỗi chỉ tái hiện vì script gọi `.click()` hai lần trong cùng một tick. Đổi sang delta vẫn là lựa chọn đúng, nhưng vì lý do kẹp-biên-một-chỗ ở trên, không phải vì sửa bug người dùng gặp.

- [ ] **Step 1: Tạo `src/pages/booking/ConcessionStep.jsx`**

```jsx
import { MAX_ITEM_QTY } from "lib/pricing";

const CATEGORIES = [
  { key: "combo", label: "Combo tiết kiệm" },
  { key: "popcorn", label: "Bắp rang" },
  { key: "drink", label: "Nước uống" },
  { key: "snack", label: "Snack" },
];

const fmt = (n) => n.toLocaleString("vi-VN") + "₫";

export default function ConcessionStep({ catalog = [], qty = {}, onChange, loading }) {
  if (loading) return <div className="fnb-empty">Đang tải bắp nước...</div>;
  if (!catalog.length) return <div className="fnb-empty">Hiện chưa có bắp nước cho suất chiếu này.</div>;

  return (
    <div className="fnb-step">
      <div className="fnb-head">
        <h2 className="fnb-title">Thêm bắp nước</h2>
        <p className="fnb-sub">Không bắt buộc — bạn có thể xác nhận đặt vé mà không chọn món nào.</p>
      </div>

      {CATEGORIES.map(({ key, label }) => {
        const items = catalog.filter((c) => c.category === key);
        if (!items.length) return null;
        return (
          <section key={key} className="fnb-group">
            <h3 className="fnb-group-title">{label}</h3>
            <div className="fnb-grid">
              {items.map((item) => {
                const n = qty[item.id] || 0;
                return (
                  <article key={item.id} className={`fnb-card ${n > 0 ? "picked" : ""}`}>
                    <div className="fnb-emoji" aria-hidden="true">{item.image}</div>
                    <div className="fnb-info">
                      <h4 className="fnb-name">{item.name}</h4>
                      <p className="fnb-desc">{item.description}</p>
                      <span className="fnb-price">{fmt(item.price)}</span>
                    </div>
                    <div className="fnb-qty">
                      <button
                        className="fnb-btn"
                        disabled={n === 0}
                        onClick={() => onChange(item.id, -1)}
                        aria-label={`Bớt ${item.name}`}
                      >
                        −
                      </button>
                      <span className="fnb-count">{n}</span>
                      <button
                        className="fnb-btn"
                        disabled={n >= MAX_ITEM_QTY}
                        onClick={() => onChange(item.id, 1)}
                        aria-label={`Thêm ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Thêm CSS vào cuối `src/pages/booking/Booking.css`**

```css
/* --- Bắp nước (F&B) --- */
.fnb-step { width:100%; }
.fnb-empty { padding:40px 0; text-align:center; color:var(--text-muted); }
.fnb-head { margin-bottom:20px; }
.fnb-title { font-family:'Bebas Neue',sans-serif; font-size:30px; letter-spacing:1.5px; }
.fnb-sub { color:var(--text-muted); font-size:13px; margin-top:4px; }
.fnb-group { margin-bottom:26px; }
.fnb-group-title { font-family:'Barlow Condensed',sans-serif; font-size:15px; letter-spacing:2px;
  text-transform:uppercase; color:var(--text-muted); margin-bottom:12px;
  padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,.08); }
.fnb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:14px; }
.fnb-card { display:flex; align-items:center; gap:14px; padding:14px;
  background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));
  border:1px solid rgba(255,255,255,.1); border-radius:14px; transition:border-color .15s ease, transform .15s ease; }
.fnb-card:hover { transform:translateY(-2px); border-color:rgba(255,255,255,.2); }
.fnb-card.picked { border-color:rgba(230,48,48,.55); background:rgba(230,48,48,.08); }
.fnb-emoji { font-size:34px; line-height:1; flex-shrink:0; width:52px; height:52px; border-radius:12px;
  display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.05); }
.fnb-info { flex:1; min-width:0; }
.fnb-name { font-family:'Barlow Condensed',sans-serif; font-size:17px; font-weight:600; letter-spacing:.4px; }
.fnb-desc { font-size:12px; color:var(--text-muted); margin:2px 0 6px; }
.fnb-price { font-family:'Bebas Neue',sans-serif; font-size:19px; letter-spacing:.8px; color:var(--red); }
.fnb-qty { display:flex; align-items:center; gap:9px; flex-shrink:0; }
.fnb-btn { width:28px; height:28px; border-radius:8px; background:rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.14); color:var(--text); font-size:17px; line-height:1; cursor:pointer;
  display:flex; align-items:center; justify-content:center; transition:background .12s ease; }
.fnb-btn:hover:not(:disabled) { background:var(--red); border-color:var(--red); color:#fff; }
.fnb-btn:disabled { opacity:.3; cursor:not-allowed; }
.fnb-count { min-width:16px; text-align:center; font-family:'Barlow Condensed',sans-serif;
  font-size:17px; font-weight:700; }
```

- [ ] **Step 3: Build**

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && npm run build
```

Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && git add src/pages/booking/ConcessionStep.jsx src/pages/booking/Booking.css && git commit -m "feat(booking): ConcessionStep luoi bap nuoc theo category + bo dem so luong"
```

---

### Task 4: OrderSummary hiển thị dòng bắp nước

**Files:**
- Modify: `src/pages/booking/OrderSummary.jsx:7-38`
- Modify: `src/pages/booking/Booking.css` (thêm cuối file)

**Interfaces:**
- Consumes: `Line[]` từ `fnbLines()` (Task 1).
- Produces: `OrderSummary` nhận thêm prop `fnb: Line[]` (mặc định `[]`). Các prop cũ (`movie, cinema, room, showtime, selected, base, serviceFee, total, primaryLabel, primaryDisabled, loading, onPrimary, error`) **giữ nguyên**.

- [ ] **Step 1: Thêm prop `fnb` vào signature**

Sửa `src/pages/booking/OrderSummary.jsx` dòng 7-10, từ:

```jsx
export default function OrderSummary({
  movie, cinema, room, showtime, selected, base,
  serviceFee, total, primaryLabel, primaryDisabled, loading, onPrimary, error,
}) {
```

thành:

```jsx
export default function OrderSummary({
  movie, cinema, room, showtime, selected, base, fnb = [],
  serviceFee, total, primaryLabel, primaryDisabled, loading, onPrimary, error,
}) {
```

- [ ] **Step 2: Render các dòng F&B trong breakdown**

Trong `src/pages/booking/OrderSummary.jsx`, chèn **giữa** dòng ghế đôi (`cpl.length > 0 && ...`) và dòng phí dịch vụ (`selected.length > 0 && ...`):

```jsx
        {fnb.length > 0 && (
          <div className="os-subhead">Bắp nước</div>
        )}
        {fnb.map((l) => (
          <div className="os-row" key={l.id}><span>{l.name} (×{l.qty})</span><span>{fmt(l.amount)}</span></div>
        ))}
```

Kết quả khối `.os-breakdown` phải theo thứ tự: ghế thường → VIP → đôi → **Bắp nước** → phí dịch vụ → TỔNG CỘNG.

- [ ] **Step 3: Thêm CSS vào cuối `src/pages/booking/Booking.css`**

```css
.os-subhead { margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,.07);
  font-family:'Barlow Condensed',sans-serif; font-size:11px; letter-spacing:1.5px;
  text-transform:uppercase; color:var(--text-muted); }
```

- [ ] **Step 4: Build**

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && npm run build
```

Expected: `Compiled successfully.`

- [ ] **Step 5: Commit**

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && git add src/pages/booking/OrderSummary.jsx src/pages/booking/Booking.css && git commit -m "feat(booking): OrderSummary them cac dong bap nuoc vao breakdown"
```

---

### Task 5: Ghép bước ② vào BookingWizard

**Files:**
- Modify: `src/pages/booking/BookingWizard.jsx` (viết lại toàn bộ — nội dung đầy đủ bên dưới)
- Modify: `src/pages/booking/Booking.css:66` (`.booking-topbar`)

**Interfaces:**
- Consumes: `getConcessions` (Task 1), `MAX_ITEM_QTY`/`fnbLines`/`fnbTotal` (Task 1), `BookingStepper` + `BOOKING_STEPS` (Task 2), `ConcessionStep` (Task 3), prop `fnb` của `OrderSummary` (Task 4).
- Produces: booking payload có thêm `concessions: [{id,name,qty,price}]` và `fnbTotal: number`.

- [ ] **Step 1: Sửa `.booking-topbar` trong `src/pages/booking/Booking.css`**

Từ (dòng 66):

```css
.booking-topbar { display:flex; justify-content:center; padding:18px 0 4px; }
```

thành:

```css
.booking-topbar { display:flex; justify-content:space-between; align-items:center; gap:16px;
  max-width:1180px; margin:0 auto; padding:18px 24px 4px; }
@media (max-width:700px){
  .booking-topbar { flex-direction:column; align-items:stretch; gap:12px; }
  .stepper { justify-content:space-between; }
}
```

- [ ] **Step 2: Viết lại `src/pages/booking/BookingWizard.jsx`**

Nội dung đầy đủ của file (thay toàn bộ):

```jsx
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getShowtime, getMovie, getRoom, getCinema, getBookings, createBooking, getConcessions } from "services/api";
import { buildSeatLayout, bookedSeatSet, priceOf, fnbLines, fnbTotal, SERVICE_FEE, MAX_SEATS, MAX_ITEM_QTY } from "lib/pricing";
import { useAuth } from "context/AuthContext";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import BookingStepper, { BOOKING_STEPS } from "./BookingStepper";
import SeatStep from "./SeatStep";
import ConcessionStep from "./ConcessionStep";
import OrderSummary from "./OrderSummary";
import SeatHoldTimer from "./SeatHoldTimer";
import "./Booking.css";

// Đợt 2 mới có 2 bước; Đợt 3 thêm Thanh toán + Vé QR thì bỏ slice đi.
const LIVE_STEPS = BOOKING_STEPS.slice(0, 2);

export default function BookingWizard() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [showtime, setShowtime] = useState(null);
  const [movie, setMovie] = useState(null);
  const [room, setRoom] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [booked, setBooked] = useState(new Set());
  const [selected, setSelected] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [qty, setQty] = useState({});
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

  useEffect(() => {
    getConcessions()
      .then(setCatalog)
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  }, []);

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

  // delta (+1/-1) chứ không phải giá trị tuyệt đối: tính từ prev nên bấm nhanh không mất nhịp
  const changeQty = useCallback((id, delta) => {
    setQty((prev) => {
      const n = Math.max(0, Math.min(MAX_ITEM_QTY, (prev[id] || 0) + delta));
      const copy = { ...prev };
      if (n === 0) delete copy[id]; else copy[id] = n;
      return copy;
    });
  }, []);

  const seatTotal = selected.reduce((sum, s) => sum + priceOf(s, base), 0);
  const fnb = fnbLines(qty, catalog);
  const fnbSum = fnbTotal(qty, catalog);
  const serviceFee = selected.length > 0 ? SERVICE_FEE : 0;
  const total = seatTotal + fnbSum + serviceFee;

  const onExpire = useCallback(() => { setSelected([]); setStep(1); setExpired(true); }, []);

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
        setStep(1);
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
        concessions: fnb.map(({ id, name, qty: q, price }) => ({ id, name, qty: q, price })),
        userId: user?.id, userName: user?.fullName || user?.email,
        seatTotal, fnbTotal: fnbSum, serviceFee, totalPrice: total,
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

  const onPrimary = () => {
    if (step === 1) { setError(""); setStep(2); return; }
    confirm();
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
        <BookingStepper step={step} steps={LIVE_STEPS} onBack={() => { setError(""); setStep(1); }} />
        <SeatHoldTimer active onExpire={onExpire} />
      </div>
      {expired && (
        <div className="expire-banner">Đã hết thời gian giữ ghế — vui lòng chọn lại ghế.
          <button onClick={() => { setExpired(false); }}>Đã hiểu</button></div>
      )}
      <div className="booking-body">
        <div className="booking-main">
          {step === 1 ? (
            <SeatStep layout={layout} booked={booked} selected={selected} base={base} room={room} onToggle={toggle} />
          ) : (
            <ConcessionStep catalog={catalog} qty={qty} onChange={changeQty} loading={catalogLoading} />
          )}
        </div>
        <OrderSummary
          movie={movie} cinema={cinema} room={room} showtime={showtime}
          selected={selected} base={base} fnb={fnb} serviceFee={serviceFee} total={total}
          primaryLabel={step === 1 ? "Tiếp tục" : "Xác nhận đặt vé"}
          primaryDisabled={selected.length === 0}
          loading={loading} onPrimary={onPrimary} error={error}
        />
      </div>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 3: Build**

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && npm run build
```

Expected: `Compiled successfully.`

- [ ] **Step 4: Kiểm tra bằng script screenshot (đã có sẵn, chỉ sửa thêm bước ②)**

Script mẫu ở scratchpad: `shot-seats.js` (puppeteer-core + Chrome thật, seed `localStorage.cinema_user`). Chạy lại để chắc bước ① không vỡ:

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && SP="C:/Users/ASUS/AppData/Local/Temp/claude/D--FPT-26SP-FER202-cinema-full/fcbcd278-1f08-4e7c-b84f-48f70a8ec499/scratchpad" && NODE_PATH="D:/FPT/26SP/FER202/cinema-full/node_modules" node "$SP/shot-seats.js" "$SP"
```

Expected: `shot 1 done`, `picks A1:ok, F2:ok, H1:ok`, `shot 2 done`.

Kiểm tra bằng mắt trong `seats-02-selected.png`: có thanh stepper (①Chọn ghế đang active, ②Bắp nước mờ), đồng hồ giữ ghế bên phải, nút chính ghi **"Tiếp tục"**.

- [ ] **Step 5: Commit**

```bash
cd "D:/FPT/26SP/FER202/cinema-full" && git add src/pages/booking/BookingWizard.jsx src/pages/booking/Booking.css && git commit -m "feat(booking): ghep buoc Bap nuoc vao wizard (step state + payload concessions/fnbTotal)"
```

---

## Kiểm thử end-to-end sau Task 5 (do người điều phối chạy, không phải subagent)

1. Screenshot bước ② (chọn 2-3 món) → xác minh:
   - Stepper: ① có dấu ✓, ② đang active, nút "Quay lại" hiện ra.
   - Thẻ đã chọn có viền đỏ, bộ đếm đúng số.
   - OrderSummary có mục "Bắp nước" + các dòng món, **TỔNG CỘNG = seatTotal + fnbTotal + 15.000**.
2. Xác nhận đặt vé → `curl -s http://localhost:9999/bookings` → booking mới nhất có `concessions` (mảng) + `fnbTotal` khớp, `totalPrice` = tổng.
3. `/tickets` vẫn render được booking mới (tương thích ngược — MyTickets chưa đọc concessions, sẽ làm ở Đợt 4).
