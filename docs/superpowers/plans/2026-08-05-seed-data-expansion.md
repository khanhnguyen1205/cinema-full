# Mở rộng dữ liệu catalogue — kế hoạch thực thi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa catalogue từ 16 phim / 52 suất / 9 đánh giá / 3 đơn lên 40 phim / ~840 suất / ~200 đánh giá / ~150 đơn, trên cả DB dev lẫn production, không xoá một dòng nào đang có.

**Architecture:** Dữ liệu "biên tập" (phim, rạp, phòng, người, bắp nước) gõ tay trong `scripts/seed-data/*.mjs`; dữ liệu "cơ học" (suất chiếu, đơn, đánh giá) do `scripts/gen-seed-data.mjs` sinh bằng PRNG có seed cố định và **đúng công thức giá của `src/lib/pricing.ts`**. Generator **chỉ nối thêm** vào `db.json`. Hai đường ra: `prisma:seed` cho dev/CI, và `server/prisma/backfill-seed-data.ts` (chỉ-CHÈN, dry-run mặc định) cho production.

**Tech Stack:** Node 22 ESM (`.mjs`), Prisma 6 + PostgreSQL, `bcryptjs`, `tsx`, Vitest, ESLint 9 flat config, Prettier.

## Global Constraints

Mọi task đều phải tôn trọng, không nhắc lại ở từng task:

- **Ngày cứng của suất chiếu phải nằm đúng trong `2026-07-14` → `2026-07-20`.** `planShift` neo theo ngày sớm nhất của fixture; rơi ra ngoài là lệch toàn bộ cửa sổ lịch chiếu.
- **Không được sinh review có `movieId === 7 && userId === 1`.** `e2e/reviews.spec.ts` chọn đúng cặp đó vì nó trống, để tránh 409 từ `@@unique([movieId, userId])`.
- **Không sửa/xoá bất kỳ dòng nào đã có trong `db.json`.** Chỉ nối thêm; id mới chạy tiếp từ `max(id)` của từng bảng.
- **Giá phải khớp `src/lib/pricing.ts`**: `ROOM_TYPE_PRICE` = `{"2D":75000,"3D":95000,"IMAX":120000}`, `vipPrice = round(base×1.3 /1000)×1000`, `couplePrice = round(base×1.6 /1000)×1000`, `SERVICE_FEE = 15000` (phẳng, mỗi đơn một lần), `MAX_SEATS = 8`, `MAX_ITEM_QTY = 10`.
- **Hàng ghế đôi chỉ có `floor(cols/2)` ghế**, không phải `cols`.
- **`lint` phải 0 cảnh báo, `format:check` phải sạch.** `scripts/**/*.{js,mjs}` đã có block ESLint riêng với `globals.node`.
- Mọi file mới chạy qua `npx prettier --write` trước khi commit.
- Commit message: tiếng Việt **không dấu**, có thân bài giải thích *vì sao*, kết bằng `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Commit thẳng vào `main`, không tạo nhánh.

## Cấu trúc file

| File | Trách nhiệm |
| --- | --- |
| `scripts/lib/rng.mjs` | PRNG mulberry32 có seed + `pick`/`sample`/`intBetween` |
| `scripts/lib/seed-pricing.mjs` | Bản port thuần JS của luật giá + dựng sơ đồ ghế |
| `src/lib/seedPricing.test.ts` | **Khoá** bản port trên vào `src/lib/pricing.ts` |
| `scripts/seed-data/movies.mjs` | `MOVIE_POOL` — ~70 phim ứng viên kèm URL ảnh |
| `scripts/seed-data/venues.mjs` | 2 thành phố, 7 rạp, 14 phòng |
| `scripts/seed-data/people.mjs` | 26 user + kho bình luận tiếng Việt theo số sao |
| `scripts/seed-data/concessions.mjs` | 6 món bắp nước |
| `scripts/seed-data/images.verified.json` | **Sinh ra**, không gõ tay |
| `scripts/verify-images.mjs` | curl từng URL → bảng báo cáo → ghi file trên |
| `scripts/gen-seed-data.mjs` | Sinh + nối vào `db.json` |
| `server/prisma/seed.ts` | *Sửa*: mang thêm cột tiền của booking |
| `server/prisma/backfill-seed-data.ts` | Đẩy phần mới lên production |
| `package.json` | *Sửa*: 3 script mới |
| `CLAUDE.md` | *Sửa*: ghi 3 lệnh mới vào mục Commands |

---

### Task 1: PRNG có seed + bản port luật giá, khoá bằng test

Generator phải **chạy lại ra kết quả y hệt** (diff ổn định) và phải tính tiền **giống hệt** app. `scripts/*.mjs` không import được `src/lib/pricing.ts` (file đó import path-alias `"types"`, chỉ Vite/tsc phân giải được), nên phải port — đúng tiền lệ `server/src/payments/quote.ts` đã làm. Khác một điểm quan trọng: chỗ đó khoá bằng số gõ cứng, còn ở đây **test import được cả hai bên** nên khoá chặt hơn.

**Files:**
- Create: `scripts/lib/rng.mjs`
- Create: `scripts/lib/seed-pricing.mjs`
- Test: `src/lib/seedPricing.test.ts`

**Interfaces:**
- Consumes: `src/lib/pricing.ts` (`ROOM_TYPE_PRICE`, `SERVICE_FEE`, `vipPrice`, `couplePrice`, `buildSeatLayout`, `priceOf`, `seatType`)
- Produces:
  - `makeRng(seed: number) => { next(): number, int(min,max): number, pick<T>(arr: T[]): T, sample<T>(arr: T[], n: number): T[], chance(p: number): boolean }`
  - `ROOM_TYPE_PRICE: Record<string, number>`, `SERVICE_FEE: number`
  - `vipPrice(base: number): number`, `couplePrice(base: number): number`
  - `buildSeatLayout(room): { row: string, seats: { seatNumber, row, col, isVip, isCouple }[], isCouple: boolean }[]`
  - `priceOf(seat, base): number`, `seatType(seat): "standard"|"vip"|"couple"`
  - `flatSeats(room): { seatNumber, isVip, isCouple }[]` — sơ đồ đã trải phẳng, tiện lấy mẫu

- [ ] **Bước 1: Viết `scripts/lib/rng.mjs`**

```js
// PRNG có seed — generator phải chạy lại ra kết quả y hệt, nếu không mỗi lần
// sinh lại là một diff db.json khác nhau và không ai review nổi.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min, max) => min + Math.floor(next() * (max - min + 1));
  const pick = (arr) => arr[Math.floor(next() * arr.length)];
  const sample = (arr, n) => {
    const copy = [...arr];
    const out = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
    }
    return out;
  };
  const chance = (p) => next() < p;
  return { next, int, pick, sample, chance };
}
```

- [ ] **Bước 2: Viết `scripts/lib/seed-pricing.mjs`**

```js
// Bản port thuần JS của src/lib/pricing.ts. KHÔNG import được bản gốc: file đó
// dùng path-alias "types" mà chỉ Vite/tsc phân giải. Cùng lý do với
// server/src/payments/quote.ts. Khoá bằng src/lib/seedPricing.test.ts — sửa một
// bên mà quên bên kia là test đỏ ngay.
export const ROOM_TYPE_PRICE = { "2D": 75000, "3D": 95000, IMAX: 120000 };
export const SERVICE_FEE = 15000;
export const MAX_SEATS = 8;

const roundTo1000 = (n) => Math.round(n / 1000) * 1000;
const rowLetter = (i) => String.fromCharCode(65 + i);

export const vipPrice = (base) => roundTo1000(base * 1.3);
export const couplePrice = (base) => roundTo1000(base * 1.6);
export const coupleUnits = (cols) => Math.floor(cols / 2);

export function seatType(seat) {
  if (seat.isCouple) return "couple";
  if (seat.isVip) return "vip";
  return "standard";
}

export function priceOf(seat, base) {
  if (seat.isCouple) return couplePrice(base);
  if (seat.isVip) return vipPrice(base);
  return base;
}

export function buildSeatLayout(room) {
  const rows = [];
  for (let r = 0; r < room.rows; r++) {
    const row = rowLetter(r);
    const coupleR = (room.coupleRows || []).includes(row);
    const count = coupleR ? coupleUnits(room.cols) : room.cols;
    const seats = [];
    for (let c = 1; c <= count; c++) {
      seats.push({
        seatNumber: `${row}${c}`,
        row,
        col: c,
        isVip: !coupleR && (room.vipRows || []).includes(row),
        isCouple: coupleR,
      });
    }
    rows.push({ row, seats, isCouple: coupleR });
  }
  return rows;
}

export const flatSeats = (room) =>
  buildSeatLayout(room).flatMap((r) => r.seats);
```

- [ ] **Bước 3: Viết test khoá — `src/lib/seedPricing.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  ROOM_TYPE_PRICE,
  SERVICE_FEE,
  buildSeatLayout,
  couplePrice,
  priceOf,
  seatType,
  vipPrice,
} from "./pricing";
import * as seed from "../../scripts/lib/seed-pricing.mjs";
import type { Room } from "types";

// scripts/lib/seed-pricing.mjs là bản SAO CHÉP luật giá cho generator (không
// import được bản gốc vì path-alias "types"). Test này là thứ giữ hai bên khớp
// nhau — thiếu nó thì một hôm ai đó đổi giá VIP ở một bên và dữ liệu seed âm
// thầm lệch với app.
describe("seed-pricing.mjs khớp lib/pricing.ts", () => {
  it("hằng số giống nhau", () => {
    expect(seed.ROOM_TYPE_PRICE).toEqual(ROOM_TYPE_PRICE);
    expect(seed.SERVICE_FEE).toBe(SERVICE_FEE);
  });

  it("giá VIP và giá đôi giống nhau trên mọi giá nền đang dùng", () => {
    for (const base of [75000, 95000, 120000, 60000, 88000]) {
      expect(seed.vipPrice(base)).toBe(vipPrice(base));
      expect(seed.couplePrice(base)).toBe(couplePrice(base));
    }
  });

  it("sơ đồ ghế giống nhau, kể cả hàng ghế đôi nửa số ghế", () => {
    const room = {
      id: 1,
      name: "Phòng 1",
      type: "2D",
      rows: 8,
      cols: 12,
      vipRows: ["E", "F"],
      coupleRows: ["H"],
      aisleAfterCols: [],
      cinemaId: 1,
    } as unknown as Room;
    const mine = seed.buildSeatLayout(room);
    const theirs = buildSeatLayout(room);
    expect(mine.map((r) => r.seats.map((s) => s.seatNumber))).toEqual(
      theirs.map((r) => r.seats.map((s) => s.seatNumber)),
    );
    expect(mine[7].seats).toHaveLength(6); // hàng H là ghế đôi -> 12/2
    for (let i = 0; i < theirs.length; i++) {
      for (let j = 0; j < theirs[i].seats.length; j++) {
        const a = mine[i].seats[j];
        const b = theirs[i].seats[j];
        expect(seed.seatType(a)).toBe(seatType(b));
        expect(seed.priceOf(a, 75000)).toBe(priceOf(b, 75000));
      }
    }
  });
});
```

- [ ] **Bước 4: Chạy test — phải ĐỎ**

Chạy: `npx vitest run src/lib/seedPricing.test.ts`
Kỳ vọng: FAIL — `Cannot find module '../../scripts/lib/seed-pricing.mjs'` (nếu bước 2 chưa xong) hoặc pass ngay nếu đã viết cả hai. Nếu pass ngay, cố tình sửa `vipPrice` trong `.mjs` thành `×1.4`, chạy lại phải ĐỎ, rồi sửa về `×1.3`.

- [ ] **Bước 5: Chạy lại — phải XANH**

Chạy: `npx vitest run src/lib/seedPricing.test.ts`
Kỳ vọng: PASS, 3 test.

- [ ] **Bước 6: Kiểm coverage không bị kéo tụt**

Chạy: `npx vitest run --coverage src/lib/`
Kỳ vọng: `scripts/` **không** xuất hiện trong bảng coverage (config chỉ tính `src/` + `server/`). Nếu có, thêm `"scripts/**"` vào `coverage.exclude` trong `vite.config.mjs`.

- [ ] **Bước 7: Commit**

```bash
npx prettier --write scripts/lib/rng.mjs scripts/lib/seed-pricing.mjs src/lib/seedPricing.test.ts
git add scripts/lib src/lib/seedPricing.test.ts vite.config.mjs
git commit -F - <<'EOF'
feat(seed): PRNG co seed va ban port luat gia cho generator

Generator phai chay lai ra ket qua Y HET, neu khong moi lan sinh lai la mot diff
db.json khac nhau va khong ai review noi. Nen dung mulberry32 co seed thay vi
Math.random.

scripts/ khong import duoc src/lib/pricing.ts: file do import path-alias "types"
ma chi Vite/tsc phan giai duoc. Nen phai port sang .mjs — dung tien le da co o
server/src/payments/quote.ts. Khac mot diem: cho do khoa bang so go cung, con o
day TEST IMPORT DUOC CA HAI BEN nen khoa chat hon han. Thieu test nay thi mot
hom ai do doi gia VIP o mot ben, du lieu seed am tham lech voi app ma khong co
gi bao.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Dữ liệu biên tập (phim, rạp, phòng, người, bắp nước)

**Files:**
- Create: `scripts/seed-data/movies.mjs`
- Create: `scripts/seed-data/venues.mjs`
- Create: `scripts/seed-data/people.mjs`
- Create: `scripts/seed-data/concessions.mjs`
- Test: `scripts/seed-data/shape.test.mjs` chạy qua Node, xem bước 6

**Interfaces:**
- Produces:
  - `movies.mjs` → `MOVIE_POOL: { title, description, duration, genre, rating, poster, backdrop }[]` (~70 phần tử)
  - `venues.mjs` → `NEW_CITIES: { name }[]` (2), `NEW_CINEMAS: { name, address, cityName }[]` (7), `NEW_ROOMS: { cinemaName, name, type, rows, cols, vipRows, coupleRows, aisleAfterCols }[]` (14)
  - `people.mjs` → `PASSWORD_HASH: string`, `NEW_USERS: { fullName, email }[]` (26), `COMMENTS: Record<1|2|3|4|5, string[]>`
  - `concessions.mjs` → `NEW_CONCESSIONS: { name, category, price, description, image }[]` (6)

Không phần tử nào mang `id`: id do generator cấp, chạy tiếp từ `max(id)` hiện có.

- [ ] **Bước 1: `scripts/seed-data/movies.mjs` — pool ~70 phim**

Mỗi phần tử theo đúng khuôn dưới. `genre` phải là một trong các mã đã có trong `src/i18n/locales/*.json` (`Action`, `Sci-Fi`, `Horror`, `Drama`, `Comedy`, `Crime`, `Animation`, `Romance`) — mã lạ sẽ hiện nguyên mã thay vì nhãn dịch. `description` **tiếng Anh một dòng**, y phong cách 16 phim cũ.

```js
// Pool ung vien. KHONG phai danh sach cuoi cung: scripts/verify-images.mjs se
// curl tung URL va loai phim nao poster 404. Pool co y du LON de con lai >= 24
// phim dung duoc — duong dan TMDB la chuoi bam, khong suy ra duoc tu ten phim,
// nen mot ti le nhat dinh se sai.
export const MOVIE_POOL = [
  {
    title: "Mad Max: Fury Road",
    description: "A rebel warrior and a runaway queen flee a tyrant across the wasteland.",
    duration: 120,
    genre: "Action",
    rating: 8.1,
    poster: "https://image.tmdb.org/t/p/w500/hA2ple9q4qnwxp3hKVNhroipsir.jpg",
    backdrop: "https://image.tmdb.org/t/p/w1280/gqrnQA6Xppdl8vIb2eJc58VC1tW.jpg",
  },
  // ... tổng cộng ~70 phần tử, KHÔNG trùng title với 16 phim đã có trong db.json
];
```

Danh sách 16 title đã có (không được lặp lại): Avengers: Endgame · Spider-Man: No Way Home · Interstellar · The Conjuring · Dune: Part Two · Oppenheimer · Barbie · The Batman · Top Gun: Maverick · Joker · Parasite · The Dark Knight · Inception · Frozen II · La La Land · John Wick: Chapter 4.

- [ ] **Bước 2: `scripts/seed-data/venues.mjs`**

Rạp mới phải trải đủ 5 thành phố. Ít nhất **6 trong 14 phòng phải có `coupleRows`** — hiện chỉ 2 phòng có, cả hai ở rạp 1, nên ghế đôi vô hình ở 4/5 rạp.

```js
export const NEW_CITIES = [{ name: "Hải Phòng" }, { name: "Cần Thơ" }];

export const NEW_CINEMAS = [
  { name: "CGV Crescent Mall", address: "101 Tôn Dật Tiên, Quận 7, TP.HCM", cityName: "TP. Hồ Chí Minh" },
  { name: "Beta Cinemas Thủ Đức", address: "18 Võ Văn Ngân, Thủ Đức, TP.HCM", cityName: "TP. Hồ Chí Minh" },
  { name: "Lotte Cinema Hà Đông", address: "8 Quang Trung, Hà Đông, Hà Nội", cityName: "Hà Nội" },
  { name: "Cinestar Mỹ Đình", address: "2 Lê Đức Thọ, Nam Từ Liêm, Hà Nội", cityName: "Hà Nội" },
  { name: "CGV Vincom Ngô Quyền", address: "910A Ngô Quyền, Sơn Trà, Đà Nẵng", cityName: "Đà Nẵng" },
  { name: "BHD Star Hải Phòng", address: "1 Lê Hồng Phong, Ngô Quyền, Hải Phòng", cityName: "Hải Phòng" },
  { name: "Lotte Cinema Cần Thơ", address: "84 Mậu Thân, Ninh Kiều, Cần Thơ", cityName: "Cần Thơ" },
];

// 14 phòng: mỗi rạp mới 2 phòng. type quyết định giá nền (2D 75k / 3D 95k / IMAX 120k).
export const NEW_ROOMS = [
  { cinemaName: "CGV Crescent Mall", name: "Phòng 1", type: "2D", rows: 8, cols: 12, vipRows: ["E", "F"], coupleRows: ["H"], aisleAfterCols: [6] },
  { cinemaName: "CGV Crescent Mall", name: "Phòng IMAX", type: "IMAX", rows: 10, cols: 14, vipRows: ["F", "G", "H"], coupleRows: ["J"], aisleAfterCols: [7] },
  // ... 12 phòng còn lại, 2 phòng mỗi rạp
];
```

- [ ] **Bước 3: Sinh hằng số `PASSWORD_HASH` một lần**

Chạy: `node -e "console.log(require('bcryptjs').hashSync('123456', 10))"`

Chép **nguyên văn** chuỗi `$2b$10$...` in ra vào `people.mjs`. Không hash trong generator: bcrypt tự sinh salt ngẫu nhiên nên mỗi lần chạy ra hash khác, làm diff `db.json` nhảy lung tung dù dữ liệu không đổi.

- [ ] **Bước 4: `scripts/seed-data/people.mjs`**

```js
// Tat ca user moi dung chung mot mat khau "123456" nen dung chung mot hash —
// bcrypt nhung salt ngay trong chuoi hash nen van xac thuc binh thuong. Hash
// MOT LAN roi nhung hang so vao day: hash luc sinh thi moi lan chay ra chuoi
// khac (salt ngau nhien) va diff db.json nhay lung tung du du lieu khong doi.
export const PASSWORD_HASH = "$2b$10$..."; // <- dán chuỗi từ bước 3

export const NEW_USERS = [
  { fullName: "Trần Thị Mai", email: "mai.tran@cinema.vn" },
  // ... đủ 26, email không trùng nhau và không trùng 4 email đã có
];

// Bình luận chia theo số sao để giọng văn khớp điểm — 5 sao mà viết "tạm được"
// thì nhìn là biết máy sinh.
export const COMMENTS = {
  5: ["Quá đã! Hình ảnh và âm thanh ngoài rạp đúng là khác hẳn ở nhà.", /* ... >= 12 câu */],
  4: ["Phim hay, diễn viên tròn vai. Đoạn giữa hơi dài nhưng vẫn đáng xem.", /* ... >= 12 câu */],
  3: ["Xem được, không xuất sắc. Đi cho biết thì ổn.", /* ... >= 10 câu */],
  2: ["Kịch bản lỏng lẻo, mình hơi tiếc tiền vé.", /* ... >= 8 câu */],
  1: ["Không hợp gu mình, ngồi hết phim khá mệt.", /* ... >= 6 câu */],
};
```

- [ ] **Bước 5: `scripts/seed-data/concessions.mjs`**

`image` là **emoji**, không phải URL — 8 món hiện có đều vậy (`"🍿"`).

```js
export const NEW_CONCESSIONS = [
  { name: "Combo Nhóm 4 Người", category: "combo", price: 219000, description: "4 nước ngọt lớn + 2 bắp lớn", image: "🍿" },
  { name: "Bắp Caramel (Lớn)", category: "popcorn", price: 59000, description: "Bắp rang caramel giòn", image: "🍿" },
  { name: "Trà Đào Cam Sả", category: "drink", price: 39000, description: "Ly 500ml", image: "🥤" },
  { name: "Pepsi (Vừa)", category: "drink", price: 28000, description: "Ly 32oz", image: "🥤" },
  { name: "Xúc Xích Nướng", category: "snack", price: 42000, description: "Xúc xích Đức nướng kèm tương", image: "🌭" },
  { name: "Nachos Phô Mai", category: "snack", price: 55000, description: "Bánh ngô giòn kèm sốt phô mai", image: "🧀" },
];
```

- [ ] **Bước 6: Viết phép kiểm hình dạng và chạy**

Create `scripts/seed-data/shape.test.mjs`:

```js
// Chay bang: node scripts/seed-data/shape.test.mjs
// Khong dung Vitest: hai project cua Vitest chi quet src/**  va server/**.
import assert from "node:assert/strict";
import { MOVIE_POOL } from "./movies.mjs";
import { NEW_CITIES, NEW_CINEMAS, NEW_ROOMS } from "./venues.mjs";
import { NEW_USERS, PASSWORD_HASH, COMMENTS } from "./people.mjs";
import { NEW_CONCESSIONS } from "./concessions.mjs";
import db from "../../db.json" with { type: "json" };

const GENRES = ["Action", "Sci-Fi", "Horror", "Drama", "Comedy", "Crime", "Animation", "Romance"];

assert.ok(MOVIE_POOL.length >= 60, `pool phim qua nho: ${MOVIE_POOL.length}`);
const oldTitles = new Set(db.movies.map((m) => m.title));
for (const m of MOVIE_POOL) {
  assert.ok(!oldTitles.has(m.title), `trung phim da co: ${m.title}`);
  assert.ok(GENRES.includes(m.genre), `the loai la: ${m.genre} (${m.title})`);
  assert.ok(m.duration > 60 && m.duration < 240, `thoi luong la: ${m.title}`);
  assert.ok(m.rating >= 5 && m.rating <= 10, `diem la: ${m.title}`);
  for (const k of ["poster", "backdrop"]) {
    assert.match(m[k], /^https:\/\/image\.tmdb\.org\/t\/p\//, `${k} sai dang: ${m.title}`);
  }
}
assert.equal(new Set(MOVIE_POOL.map((m) => m.title)).size, MOVIE_POOL.length, "pool co phim trung ten");

assert.equal(NEW_CITIES.length, 2);
assert.equal(NEW_CINEMAS.length, 7);
assert.equal(NEW_ROOMS.length, 14);
const cityNames = new Set([...db.cities.map((c) => c.name), ...NEW_CITIES.map((c) => c.name)]);
for (const c of NEW_CINEMAS) assert.ok(cityNames.has(c.cityName), `thanh pho la: ${c.cityName}`);
const cinemaNames = new Set(NEW_CINEMAS.map((c) => c.name));
for (const r of NEW_ROOMS) {
  assert.ok(cinemaNames.has(r.cinemaName), `rap la: ${r.cinemaName}`);
  assert.ok(["2D", "3D", "IMAX"].includes(r.type), `loai phong la: ${r.type}`);
}
assert.ok(NEW_ROOMS.filter((r) => (r.coupleRows || []).length).length >= 6, "qua it phong co ghe doi");

assert.equal(NEW_USERS.length, 26);
assert.match(PASSWORD_HASH, /^\$2[aby]\$\d{2}\$/, "PASSWORD_HASH chua duoc dan");
const oldEmails = new Set(db.users.map((u) => u.email));
const emails = new Set();
for (const u of NEW_USERS) {
  assert.ok(!oldEmails.has(u.email), `trung email da co: ${u.email}`);
  assert.ok(!emails.has(u.email), `trung email trong pool: ${u.email}`);
  emails.add(u.email);
}
for (const star of [1, 2, 3, 4, 5]) {
  assert.ok(COMMENTS[star]?.length >= 6, `qua it binh luan ${star} sao`);
}
assert.equal(NEW_CONCESSIONS.length, 6);

console.log("✅ Hinh dang du lieu bien tap hop le.");
```

Chạy: `node scripts/seed-data/shape.test.mjs`
Kỳ vọng: in `✅ Hinh dang du lieu bien tap hop le.` và thoát 0. Mọi assert đỏ đều nêu đích danh phần tử sai — sửa rồi chạy lại tới khi xanh.

- [ ] **Bước 7: Lint + format + commit**

```bash
npx prettier --write scripts/seed-data
npx eslint scripts/seed-data --max-warnings 0
git add scripts/seed-data
git commit -F - <<'EOF'
feat(seed): du lieu bien tap — pool phim, rap, phong, nguoi, bap nuoc

Tach du lieu can DAU OC NGUOI (ten rap, dia chi, mo ta phim, giong van binh
luan) ra khoi du lieu thuan to hop (suat chieu, don, danh gia). Phan nay go tay
va doc duoc; phan kia de generator sinh.

Pool phim co y du LON (~70) chu khong dung 24: duong dan anh TMDB la chuoi bam,
khong suy ra duoc tu ten phim, nen mot ti le nhat dinh se 404. Pool lon thi may
rui bi hap thu boi kich thuoc pool thay vi lam thieu phim.

14 phong moi co it nhat 6 phong CO GHE DOI. Hien tai chi 2 phong co, ca hai deu
thuoc rap 1, nen tinh nang ghe doi vo hinh o 4/5 rap.

PASSWORD_HASH la hang so go cung chu khong hash luc sinh: bcrypt tu sinh salt
ngau nhien nen hash trong generator se lam diff db.json nhay lung tung du du
lieu khong doi.

shape.test.mjs chay bang node chu khong phai Vitest — hai project cua Vitest chi
quet src/** va server/**.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Kiểm chứng ảnh trước khi tin

**Files:**
- Create: `scripts/verify-images.mjs`
- Create (sinh ra): `scripts/seed-data/images.verified.json`
- Modify: `package.json` (thêm script `seed:verify-images`)

**Interfaces:**
- Consumes: `MOVIE_POOL` từ Task 2
- Produces: `images.verified.json` = `{ generatedAt: string, movies: { title, description, duration, genre, rating, poster, backdrop|null }[] }` — chỉ chứa phim có **poster 200**; `backdrop` là `null` nếu ảnh nền 404.

- [ ] **Bước 1: Viết `scripts/verify-images.mjs`**

```js
/**
 * curl tung URL anh trong MOVIE_POOL, giu lai phim dung duoc.
 *
 * VI SAO CAN: duong dan TMDB la chuoi bam (/or06FN3Dka5tukK1e9sl16pB3iy.jpg),
 * khong suy ra duoc tu ten phim. Khong co API key nen pool la do soan tay va
 * MOT TI LE SE SAI. Buoc nay bat cai sai truoc khi no vao db.json.
 *
 * GIOI HAN PHAI BIET: 200 chi chung minh "co mot anh o duong dan do", KHONG
 * chung minh do la anh dung phim. Chot chan cuoi la ImageField trong
 * /admin/movies — no hien thumbnail that de nguoi liec mat duyet.
 *
 * Chay: npm run seed:verify-images
 */
import { writeFileSync } from "node:fs";
import { MOVIE_POOL } from "./seed-data/movies.mjs";

const CONCURRENCY = 8;
const TIMEOUT_MS = 15000;

async function check(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    // Khong doc body: chi can status + kieu noi dung.
    res.body?.cancel();
    const type = res.headers.get("content-type") || "";
    return { ok: res.status === 200 && type.startsWith("image/"), status: res.status, type };
  } catch (e) {
    return { ok: false, status: 0, type: e.name === "AbortError" ? "timeout" : "loi mang" };
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

const results = await mapLimit(MOVIE_POOL, CONCURRENCY, async (m) => ({
  movie: m,
  poster: await check(m.poster),
  backdrop: await check(m.backdrop),
}));

const kept = [];
let posterFail = 0;
let backdropOnlyFail = 0;

console.log("\nket qua kiem anh:\n");
for (const r of results) {
  const t = r.movie.title.padEnd(38).slice(0, 38);
  if (!r.poster.ok) {
    posterFail++;
    console.log(`  ✗ ${t} poster ${r.poster.status} ${r.poster.type} -> LOAI`);
    continue;
  }
  if (!r.backdrop.ok) {
    backdropOnlyFail++;
    console.log(`  ~ ${t} poster OK, backdrop ${r.backdrop.status} -> giu, backdrop=null`);
    kept.push({ ...r.movie, backdrop: null });
  } else {
    console.log(`  ✓ ${t} du ca hai`);
    kept.push({ ...r.movie });
  }
}

console.log(
  `\ntong ${MOVIE_POOL.length} · dung duoc ${kept.length} (du ca hai ${kept.length - backdropOnlyFail}, thieu backdrop ${backdropOnlyFail}) · loai ${posterFail}`,
);

if (kept.length < 24) {
  console.error(`\n❌ Chi con ${kept.length} phim dung duoc, can it nhat 24. Bo sung MOVIE_POOL roi chay lai.`);
  process.exitCode = 1;
} else {
  writeFileSync(
    new URL("./seed-data/images.verified.json", import.meta.url),
    JSON.stringify({ generatedAt: new Date().toISOString(), movies: kept.slice(0, 24) }, null, 2) + "\n",
  );
  console.log(`\n✅ Da ghi 24 phim vao scripts/seed-data/images.verified.json`);
}
```

- [ ] **Bước 2: Thêm script vào `package.json`**

Trong khối `"scripts"`, thêm ngay sau `"backfill:backdrops"`:

```json
"seed:verify-images": "node scripts/verify-images.mjs",
```

- [ ] **Bước 3: Chạy và đọc kết quả**

Chạy: `npm run seed:verify-images`
Kỳ vọng: bảng kết quả từng phim, và một trong hai kết cục:
- `✅ Da ghi 24 phim...` → sang bước 4
- `❌ Chi con N phim dung duoc` → **bổ sung `MOVIE_POOL` thêm ứng viên rồi chạy lại**. Đây là vòng lặp bình thường của cách làm này, không phải lỗi.

- [ ] **Bước 4: Duyệt mắt danh sách cuối**

Chạy: `node -e "const j=require('./scripts/seed-data/images.verified.json'); j.movies.forEach((m,i)=>console.log(String(i+1).padStart(2), m.genre.padEnd(10), m.rating, m.backdrop?'bd':'--', m.title))"`
Kỳ vọng: 24 dòng, thể loại trải rộng (không phải 20/24 là `Action`). Nếu lệch thể loại, chỉnh thứ tự `MOVIE_POOL` rồi chạy lại bước 3.

- [ ] **Bước 5: Commit**

```bash
npx prettier --write scripts/verify-images.mjs scripts/seed-data/images.verified.json package.json
npx eslint scripts --max-warnings 0
git add scripts/verify-images.mjs scripts/seed-data/images.verified.json package.json
git commit -F - <<'EOF'
feat(seed): kiem chung anh truoc khi tin

Duong dan anh TMDB la chuoi bam, khong suy ra duoc tu ten phim, va may nay khong
co API key — nen pool anh la do soan tay va mot ti le CHAC CHAN sai. Script nay
curl tung URL, loai phim nao poster 404, va ha cap phim nao chi hong backdrop
thanh backdrop=null (hero tu roi ve poster-lam-mo, xau hon nhung khong bao gio
vo).

Noi thang gioi han: 200 chi chung minh CO MOT ANH o duong dan do, khong chung
minh do la anh DUNG PHIM. Chot chan cuoi van la ImageField trong /admin/movies.

Tach thanh buoc rieng thay vi kiem trong generator: buoc nay phu thuoc mang va
cham (~140 request), tach ra thi generator chay offline va lap lai ra ket qua y
het — mot hom TMDB cham cung khong lam hong viec sinh du lieu.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Generator — khung + suất chiếu

**Files:**
- Create: `scripts/gen-seed-data.mjs`
- Modify: `package.json` (thêm `seed:generate`)

**Interfaces:**
- Consumes: `makeRng` (Task 1), `seed-pricing.mjs` (Task 1), `venues.mjs` (Task 2), `images.verified.json` (Task 3)
- Produces (nội bộ, các task sau dùng tiếp trong cùng file):
  - `nextId(rows): number` — `max(id)+1`, trả `1` nếu mảng rỗng
  - `out` — đối tượng `db.json` đang được bồi thêm
  - `allRooms`, `allShowtimes` — mảng đã gộp cũ + mới, dùng cho Task 5-7

- [ ] **Bước 1: Viết khung generator + phần suất chiếu**

```js
/**
 * Sinh du lieu co hoc roi NOI vao db.json. Khong bao gio sua/xoa dong da co.
 *
 * Chay: npm run seed:generate
 */
import { readFileSync, writeFileSync } from "node:fs";
import { makeRng } from "./lib/rng.mjs";
import { ROOM_TYPE_PRICE, flatSeats } from "./lib/seed-pricing.mjs";
import { NEW_CITIES, NEW_CINEMAS, NEW_ROOMS } from "./seed-data/venues.mjs";

const DB_PATH = new URL("../db.json", import.meta.url);
const db = JSON.parse(readFileSync(DB_PATH, "utf8"));
const verified = JSON.parse(
  readFileSync(new URL("./seed-data/images.verified.json", import.meta.url), "utf8"),
);

// Seed co dinh: chay lai ra ket qua y het.
const rng = makeRng(20260805);

const nextId = (rows) => (rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1);

// --- 1. Thanh pho, rap, phong, phim, bap nuoc (bien tap -> chi can cap id) ---
const cityIdByName = new Map(db.cities.map((c) => [c.name, c.id]));
for (const c of NEW_CITIES) {
  const id = nextId(db.cities);
  db.cities.push({ id, name: c.name });
  cityIdByName.set(c.name, id);
}

const cinemaIdByName = new Map(db.cinemas.map((c) => [c.name, c.id]));
for (const c of NEW_CINEMAS) {
  const id = nextId(db.cinemas);
  db.cinemas.push({ id, name: c.name, address: c.address, cityId: cityIdByName.get(c.cityName) });
  cinemaIdByName.set(c.name, id);
}

for (const r of NEW_ROOMS) {
  db.rooms.push({
    id: nextId(db.rooms),
    name: r.name,
    type: r.type,
    rows: r.rows,
    cols: r.cols,
    vipRows: r.vipRows ?? [],
    coupleRows: r.coupleRows ?? [],
    aisleAfterCols: r.aisleAfterCols ?? [],
    cinemaId: cinemaIdByName.get(r.cinemaName),
  });
}

for (const m of verified.movies) {
  db.movies.push({
    id: nextId(db.movies),
    title: m.title,
    poster: m.poster,
    backdrop: m.backdrop,
    description: m.description,
    duration: m.duration,
    genre: m.genre,
    rating: m.rating,
  });
}

// --- 2. Suat chieu ---
// NGAY CUNG phai giu dung 7 ngay nay: planShift neo theo ngay SOM NHAT de day no
// ve hom nay-2. Roi ra ngoai la lech toan bo cua so lich chieu.
const DAYS = ["2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17", "2026-07-18", "2026-07-19", "2026-07-20"];
const SLOTS = ["09:30", "12:15", "15:00", "18:00", "21:00"];

// 11 suat cu da o 21:00. Bo qua cap (phong, gio) da ton tai, neu khong mot phong
// chieu hai phim cung luc.
const taken = new Set(db.showtimes.map((s) => `${s.roomId}|${s.time}`));
const movieIds = db.movies.map((m) => m.id);
let cursor = 0;

for (const room of db.rooms) {
  // Moi phong lech mot buoc khac nhau -> cung mot gio, cac phong chieu phim khac nhau.
  cursor += 3;
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      const time = `${day}T${slot}:00`;
      const key = `${room.id}|${time}`;
      if (taken.has(key)) continue;
      taken.add(key);
      const seats = flatSeats(room).map((s) => s.seatNumber);
      const soldCount = rng.int(Math.floor(seats.length * 0.05), Math.floor(seats.length * 0.15));
      db.showtimes.push({
        id: nextId(db.showtimes),
        movieId: movieIds[cursor++ % movieIds.length],
        roomId: room.id,
        time,
        price: ROOM_TYPE_PRICE[room.type],
        bookedSeats: rng.sample(seats, soldCount).sort(),
      });
    }
  }
}

writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + "\n");
console.log(
  `phim ${db.movies.length} · tp ${db.cities.length} · rap ${db.cinemas.length} · phong ${db.rooms.length} · suat ${db.showtimes.length}`,
);
```

- [ ] **Bước 2: Thêm script vào `package.json`**

```json
"seed:generate": "node scripts/gen-seed-data.mjs",
```

- [ ] **Bước 3: Chạy thử trên bản sao, KHÔNG ghi đè db.json thật**

```bash
cp db.json db.json.bak
npm run seed:generate
```
Kỳ vọng in: `phim 40 · tp 5 · rap 12 · phong 24 · suat` với số suất trong khoảng **820-840**.

- [ ] **Bước 4: Kiểm bất biến của suất chiếu**

```bash
node -e "
const d=require('./db.json');
const days=[...new Set(d.showtimes.map(s=>s.time.slice(0,10)))].sort();
console.log('ngay:', days.join(' '));
const dup=new Set(), clash=[];
for(const s of d.showtimes){const k=s.roomId+'|'+s.time; if(dup.has(k)) clash.push(k); dup.add(k);}
console.log('phong trung gio:', clash.length);
const withSt=new Set(d.showtimes.map(s=>s.movieId));
console.log('phim khong co suat nao:', d.movies.filter(m=>!withSt.has(m.id)).map(m=>m.id).join(',')||'khong co');
const first16=JSON.stringify(d.movies.slice(0,16));
console.log('16 phim cu con nguyen:', first16===JSON.stringify(require('./db.json.bak').movies));
"
```
Kỳ vọng: đúng 7 ngày `2026-07-14 … 2026-07-20`; `phong trung gio: 0`; `phim khong co suat nao: khong co`; `16 phim cu con nguyen: true`.

- [ ] **Bước 5: Commit** (chưa xoá `db.json.bak`, Task 5-7 còn dùng)

```bash
npx prettier --write scripts/gen-seed-data.mjs package.json db.json
git add scripts/gen-seed-data.mjs package.json db.json
git commit -F - <<'EOF'
feat(seed): generator — khung va suat chieu

24 phong x 7 ngay x 5 khung gio. Hai cho de sai da chan san:

Ngay cung GIU DUNG 2026-07-14..07-20. planShift neo theo ngay som nhat cua
fixture de day no ve hom nay-2; them suat ngoai khoang do la neo lai cho khac va
lech toan bo cua so lich chieu.

Bo qua cap (phong, gio) DA TON TAI. 11 suat cu von da o 21:00, khong chan thi
mot phong chieu hai phim cung luc.

Moi phong lech mot buoc con tro khac nhau nen cung mot gio cac phong chieu phim
khac nhau, va moi phim deu co suat o nhieu rap — de bo chon tp -> rap -> ngay
khong bao gio rong, von la than phien goc.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Generator — người dùng

**Files:**
- Modify: `scripts/gen-seed-data.mjs` (thêm mục 3, trước `writeFileSync`)

**Interfaces:**
- Consumes: `NEW_USERS`, `PASSWORD_HASH` (Task 2)
- Produces: `db.users` dài 30; các task sau dùng `db.users` để gán đơn và đánh giá

- [ ] **Bước 1: Chèn mục 3 vào `gen-seed-data.mjs`**, ngay trước `writeFileSync`:

```js
// --- 3. Nguoi dung ---
for (const u of NEW_USERS) {
  db.users.push({
    id: nextId(db.users),
    fullName: u.fullName,
    email: u.email,
    password: PASSWORD_HASH,
    role: "user",
  });
}
```

Và bổ sung vào dòng import ở đầu file:

```js
import { COMMENTS, NEW_USERS, PASSWORD_HASH } from "./seed-data/people.mjs";
```

(`COMMENTS` chưa dùng ở task này nhưng Task 7 cần — khai báo luôn để khỏi sửa import hai lần. Nếu ESLint báo biến không dùng thì để lại tới Task 7.)

- [ ] **Bước 2: Chạy lại từ bản sạch**

```bash
cp db.json.bak db.json && npm run seed:generate
node -e "const d=require('./db.json'); console.log('users', d.users.length); console.log('admin con nguyen:', d.users.find(u=>u.email==='admin@cinema.vn')?.role);"
```
Kỳ vọng: `users 30`, `admin con nguyen: admin`.

- [ ] **Bước 3: Kiểm mật khẩu hash dùng được thật**

```bash
node -e "
const b=require('bcryptjs'), d=require('./db.json');
const u=d.users.find(x=>x.id===30);
console.log(u.email, '| 123456 ->', b.compareSync('123456', u.password));
"
```
Kỳ vọng: `... | 123456 -> true`. Nếu `false` thì `PASSWORD_HASH` bị dán thiếu ký tự — dán lại từ Task 2 bước 3.

- [ ] **Bước 4: Commit**

```bash
npx prettier --write scripts/gen-seed-data.mjs db.json
git add scripts/gen-seed-data.mjs db.json
git commit -F - <<'EOF'
feat(seed): generator — 26 nguoi dung moi

Khong phai de cho dong. @@unique([movieId,userId]) dat tran CUNG o so user: 4
user nghia la toi da 4 danh gia moi phim, du co sinh bao nhieu review di nua.
Muon ~5 danh gia/phim thi bat buoc phai co them nguoi.

Tat ca dung chung mot hash cua mat khau "123456" — bcrypt nhung salt ngay trong
chuoi hash nen van xac thuc binh thuong, va dung hang so thi diff db.json on
dinh giua cac lan chay.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Generator — đơn đặt vé

Cột tiền phải tính bằng **đúng** công thức, vì bảng `/admin/bookings` và biểu đồ doanh thu cộng thẳng từ đây.

**Files:**
- Modify: `scripts/gen-seed-data.mjs` (thêm mục 4)

**Interfaces:**
- Consumes: `flatSeats`, `priceOf`, `seatType`, `SERVICE_FEE` (Task 1)
- Produces: `db.bookings` (~153); Task 7 đọc để tính cờ `verified`

- [ ] **Bước 1: Chèn mục 4 vào `gen-seed-data.mjs`**, trước `writeFileSync`:

```js
// --- 4. Don dat ve ---
// createdAt rai 30 ngay TRUOC cua so chieu -> bieu do doanh thu admin co duong
// cong that thay vi ba cot. Cung mot offset se duoc seed.ts dich cho ca bang.
const BOOK_DAYS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 5, 14) + i * 86400000); // 2026-06-14 + i
  return d.toISOString().slice(0, 10);
});

const roomById = new Map(db.rooms.map((r) => [r.id, r]));
const cinemaIdOfRoom = (roomId) => roomById.get(roomId).cinemaId;
const seatsUsed = new Map(); // showtimeId -> Set ghe da ban
for (const s of db.showtimes) seatsUsed.set(s.id, new Set(s.bookedSeats));
for (const b of db.bookings) {
  const set = seatsUsed.get(b.showtimeId) ?? new Set();
  b.seats.forEach((x) => set.add(x));
  seatsUsed.set(b.showtimeId, set);
}

const buyers = db.users.filter((u) => u.role !== "admin");
const TARGET_BOOKINGS = 150;

for (let n = 0; n < TARGET_BOOKINGS; n++) {
  const st = rng.pick(db.showtimes);
  const room = roomById.get(st.roomId);
  const used = seatsUsed.get(st.id);
  const free = flatSeats(room).filter((s) => !used.has(s.seatNumber));
  if (free.length < 4) continue;

  const chosen = rng.sample(free, rng.int(1, 4));
  chosen.forEach((s) => used.add(s.seatNumber));

  const seatTypes = { standard: 0, vip: 0, couple: 0 };
  let seatTotal = 0;
  for (const s of chosen) {
    seatTypes[seatType(s)]++;
    seatTotal += priceOf(s, st.price);
  }

  // 0-2 mon bap nuoc, moi mon 1-2 phan.
  const fnb = {};
  let fnbTotal = 0;
  for (const c of rng.sample(db.concessions, rng.int(0, 2))) {
    const qty = rng.int(1, 2);
    fnb[c.id] = qty;
    fnbTotal += c.price * qty;
  }

  const user = rng.pick(buyers);
  db.bookings.push({
    id: nextId(db.bookings),
    movieId: st.movieId,
    showtimeId: st.id,
    cinemaId: cinemaIdOfRoom(st.roomId),
    roomId: st.roomId,
    seats: chosen.map((s) => s.seatNumber).sort(),
    seatTypes,
    concessions: Object.keys(fnb).length ? fnb : undefined,
    paymentMethod: rng.chance(0.45) ? "card" : "counter",
    userId: user.id,
    userName: user.fullName,
    seatTotal,
    fnbTotal,
    serviceFee: SERVICE_FEE,
    totalPrice: seatTotal + fnbTotal + SERVICE_FEE,
    createdAt: `${rng.pick(BOOK_DAYS)}T${String(rng.int(8, 22)).padStart(2, "0")}:${rng.pick(["05", "17", "30", "42", "58"])}:00`,
  });
}
```

Bổ sung import ở đầu file:

```js
import { ROOM_TYPE_PRICE, SERVICE_FEE, flatSeats, priceOf, seatType } from "./lib/seed-pricing.mjs";
```

- [ ] **Bước 2: Chạy lại từ bản sạch**

```bash
cp db.json.bak db.json && npm run seed:generate
node -e "const d=require('./db.json'); console.log('bookings', d.bookings.length);"
```
Kỳ vọng: `bookings` trong khoảng **145-153**.

- [ ] **Bước 3: Kiểm tiền cộng đúng và không bán trùng ghế**

```bash
node -e "
const d=require('./db.json');
let bad=0;
for(const b of d.bookings.slice(3)){
  const t=(b.seatTotal||0)+(b.fnbTotal||0)+(b.serviceFee||0);
  if(t!==b.totalPrice){bad++; console.log('lech tien don', b.id, t, '!=', b.totalPrice);}
}
console.log('don lech tien:', bad);
const perSt={};
for(const b of d.bookings){ (perSt[b.showtimeId] ||= []).push(...b.seats); }
let dup=0;
for(const [id,seats] of Object.entries(perSt)){
  const st=d.showtimes.find(s=>s.id===+id);
  const all=[...seats, ...st.bookedSeats];
  if(new Set(all).size!==all.length){dup++; console.log('ghe trung o suat', id);}
}
console.log('suat ban trung ghe:', dup);
const vip=d.bookings.find(b=>b.seatTypes.vip>0);
console.log('vi du don co VIP:', vip && JSON.stringify({seats:vip.seats,seatTypes:vip.seatTypes,seatTotal:vip.seatTotal,total:vip.totalPrice}));
"
```
Kỳ vọng: `don lech tien: 0` · `suat ban trung ghe: 0` · dòng ví dụ có VIP với `seatTotal` khớp (ví dụ phòng 2D 75k, 1 VIP = `round(75000×1.3/1000)×1000` = **98000**).

- [ ] **Bước 4: Commit**

```bash
npx prettier --write scripts/gen-seed-data.mjs db.json
git add scripts/gen-seed-data.mjs db.json
git commit -F - <<'EOF'
feat(seed): generator — ~150 don dat ve

createdAt rai 30 ngay TRUOC cua so chieu de bieu do doanh thu admin co duong
cong that. Truoc do 3 don deu cung mot ngay nen bieu do gan nhu phang, nhin nhu
app chua chay bao gio.

Tien tinh bang dung cong thuc cua lib/pricing.ts qua ban port da khoa o Task 1:
VIP x1.3, ghe doi x1.6, lam tron nghin, SERVICE_FEE 15k PHANG moi don (kiem lai
tu don cu: 75000 + 15000 = 90000). Go tay cho nay la sai chac chan, ma sai thi
bang admin cong ra so vo ly ma khong ai doi chieu.

Ghe lay tu so do phong that va TRU ghe da ban — gom ca showtime.bookedSeats lan
ghe cua don khac cung suat — nen khong bao gio ban trung mot ghe hai lan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Generator — đánh giá

**Files:**
- Modify: `scripts/gen-seed-data.mjs` (thêm mục 5)

**Interfaces:**
- Consumes: `COMMENTS` (Task 2), `db.bookings` (Task 6)
- Produces: `db.reviews` (~200)

- [ ] **Bước 1: Chèn mục 5**, trước `writeFileSync`:

```js
// --- 5. Danh gia ---
// Ba rang buoc:
//  1. @@unique([movieId,userId]) — mot user chi danh gia mot phim mot lan.
//  2. KHONG duoc sinh (movieId 7, userId 1): e2e/reviews.spec.ts chon dung cap
//     do vi no trong, de tranh 409. Sinh vao la test do.
//  3. verified chi true khi user do THAT SU co don phim do, dat TRUOC ngay
//     danh gia — dung nghia cua badge "Da xem".
const pairs = new Set(db.reviews.map((r) => `${r.movieId}|${r.userId}`));
pairs.add("7|1"); // chot cung cho e2e/reviews.spec.ts

const bookedByUserMovie = new Map(); // "userId|movieId" -> ngay dat som nhat
for (const b of db.bookings) {
  const k = `${b.userId}|${b.movieId}`;
  const day = b.createdAt.slice(0, 10);
  if (!bookedByUserMovie.has(k) || day < bookedByUserMovie.get(k)) {
    bookedByUserMovie.set(k, day);
  }
}

const REVIEW_DAYS = Array.from({ length: 28 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 5, 16) + i * 86400000); // 2026-06-16 + i
  return d.toISOString().slice(0, 10);
});
const STARS = [5, 5, 5, 5, 4, 4, 4, 3, 3, 2, 1]; // lech ve 4-5 cho that

for (const movie of db.movies) {
  const want = rng.int(3, 8);
  for (const user of rng.sample(buyers, want)) {
    const key = `${movie.id}|${user.id}`;
    if (pairs.has(key)) continue;
    pairs.add(key);

    const rating = rng.pick(STARS);
    const day = rng.pick(REVIEW_DAYS);
    const bought = bookedByUserMovie.get(`${user.id}|${movie.id}`);
    db.reviews.push({
      id: nextId(db.reviews),
      movieId: movie.id,
      userId: user.id,
      userName: user.fullName,
      rating,
      comment: rng.pick(COMMENTS[rating]),
      verified: Boolean(bought && bought <= day),
      createdAt: `${day}T${String(rng.int(8, 22)).padStart(2, "0")}:${rng.pick(["04", "19", "27", "45", "51"])}:00.000Z`,
    });
  }
}
```

- [ ] **Bước 2: Chạy lại từ bản sạch**

```bash
cp db.json.bak db.json && npm run seed:generate
node -e "const d=require('./db.json'); console.log('reviews', d.reviews.length);"
```
Kỳ vọng: `reviews` trong khoảng **180-220**.

- [ ] **Bước 3: Kiểm ba ràng buộc**

```bash
node -e "
const d=require('./db.json');
const seen=new Set(); let dup=0;
for(const r of d.reviews){const k=r.movieId+'|'+r.userId; if(seen.has(k))dup++; seen.add(k);}
console.log('cap (phim,user) trung:', dup);
console.log('co review phim7-user1:', d.reviews.some(r=>r.movieId===7&&r.userId===1));
const noRev=d.movies.filter(m=>!d.reviews.some(r=>r.movieId===m.id));
console.log('phim khong co danh gia:', noRev.length);
console.log('so review verified:', d.reviews.filter(r=>r.verified).length);
const names=new Map(d.users.map(u=>[u.id,u.fullName]));
console.log('userName lech fullName:', d.reviews.filter(r=>names.get(r.userId)!==r.userName).length);
"
```
Kỳ vọng: `cap (phim,user) trung: 0` · `co review phim7-user1: false` · `phim khong co danh gia: 0` · `so review verified` > 0 · `userName lech fullName: 0`.

- [ ] **Bước 4: Commit**

```bash
npx prettier --write scripts/gen-seed-data.mjs db.json
git add scripts/gen-seed-data.mjs db.json
git commit -F - <<'EOF'
feat(seed): generator — ~200 danh gia

Truoc do 10/16 phim khong co danh gia nao, nen phan review o trang chi tiet phim
trong tron voi phan lon catalogue.

Ba rang buoc deu duoc chan bang code chu khong bang y thuc:

@@unique([movieId,userId]) — giu mot Set cap da dung, gom ca 9 review cu.

CHOT CUNG khong sinh (phim 7, user 1): e2e/reviews.spec.ts chon dung cap do VI
NO TRONG, de tranh 409 khi test tu dang review. Sinh vao la test do ma nguyen
nhan nhin rat giong loi ung dung.

verified chi true khi user THAT SU co don phim do va dat TRUOC ngay danh gia —
dung nghia badge "Da xem". Bat chuoc dung cach gateway tinh co nay luc tao.

Giong van binh luan chia theo so sao: 5 sao ma viet "tam duoc" thi nhin la biet
may sinh.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Nạp vào DB dev + sửa `seed.ts` mang đủ cột tiền

`seed.ts` hiện **làm rơi** `seatTotal`/`fnbTotal`/`serviceFee`/`paymentMethod`: `booking.createMany` chỉ map `totalPrice`. Sinh đúng công thức mà seed không mang qua thì cột vẫn `null` trong DB.

**Files:**
- Modify: `server/prisma/seed.ts:96-112`

**Interfaces:**
- Consumes: `db.json` sau Task 7
- Produces: DB dev đã nạp đủ

- [ ] **Bước 1: Kiểm chứng lỗi rơi cột trước khi sửa**

```bash
npx prettier --check db.json && npm run prisma:seed
npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.booking.findFirst({where:{seatTotal:{not:null}}}).then(r=>{console.log('don co seatTotal:', r?r.id:'KHONG CO'); return p.\$disconnect();});"
```
Kỳ vọng: `don co seatTotal: KHONG CO` — đây chính là lỗi cần sửa.

- [ ] **Bước 2: Sửa `server/prisma/seed.ts`**

Trong `prisma.booking.createMany`, thêm 4 dòng sau `userName: b.userName,`:

```ts
      seatTotal: (b as { seatTotal?: number }).seatTotal ?? null,
      fnbTotal: (b as { fnbTotal?: number }).fnbTotal ?? null,
      serviceFee: (b as { serviceFee?: number }).serviceFee ?? null,
      paymentMethod: (b as { paymentMethod?: string }).paymentMethod ?? null,
```

- [ ] **Bước 3: Nạp lại và kiểm**

```bash
npm run prisma:seed
```
Kỳ vọng: bảng đếm in ra `Movie 40 · City 5 · Cinema 12 · Room 24 · User 30 · Concession 14`, `Showtime` ~830, `Booking` ~150, `Review` ~200; rồi `📅 Đã dịch mốc thời gian ...` và `✅ Seed khớp db.json`.

```bash
npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); (async()=>{const r=await p.booking.findFirst({where:{seatTotal:{not:null}}}); console.log('don co seatTotal:', r?\`#\${r.id} seat=\${r.seatTotal} fnb=\${r.fnbTotal} fee=\${r.serviceFee} tong=\${r.totalPrice}\`:'KHONG CO'); await p.\$disconnect();})();"
```
Kỳ vọng: in một đơn với `seat + fnb + fee = tong`.

- [ ] **Bước 4: Kiểm cửa sổ lịch chiếu vẫn đúng 7 ngày quanh hôm nay**

```bash
npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); (async()=>{const s=await p.showtime.findMany({select:{time:true}}); const d=[...new Set(s.map(x=>x.time.slice(0,10)))].sort(); console.log('so ngay',d.length,'|',d[0],'->',d[d.length-1],'| hom nay',new Date().toISOString().slice(0,10)); await p.\$disconnect();})();"
```
Kỳ vọng: `so ngay 7`, ngày đầu = **hôm nay − 2**, ngày cuối = **hôm nay + 4**. Sai là ngày cứng đã lệch khỏi `2026-07-14..20` — quay lại Task 4.

- [ ] **Bước 5: Xoá bản sao tạm và commit**

```bash
rm -f db.json.bak
npx prettier --write server/prisma/seed.ts
git add server/prisma/seed.ts
git commit -F - <<'EOF'
fix(seed): mang du cot tien cua don khi nap

booking.createMany chi map totalPrice, lam ROI seatTotal/fnbTotal/serviceFee/
paymentMethod. Truoc day khong ai thay vi 3 don fixture cu von khong co may cot
do; gio generator tinh dung cong thuc roi ma seed van vut di thi cong toi do la
cong vo ich, va bang /admin/bookings hien o trong.

Phat hien bang cach hoi DB truoc khi sua: don dau tien co seatTotal khac null la
KHONG CO.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 9: Script bồi thêm cho production

**Files:**
- Create: `server/prisma/backfill-seed-data.ts`
- Modify: `package.json` (thêm `backfill:seed-data`)

**Interfaces:**
- Consumes: `db.json`
- Produces: lệnh `npm run backfill:seed-data [-- --apply]`

Khác `seed.ts` ở ba điểm sống còn: **không xoá gì**, **không ép id** (prod có thể đã có phim admin thêm chiếm id 17+), và **khớp theo khoá tự nhiên** để chạy hai lần không nhân đôi.

- [ ] **Bước 1: Viết `server/prisma/backfill-seed-data.ts`**

```ts
/**
 * Chen du lieu moi tu db.json vao mot DB DANG CHAY, khong xoa gi.
 *
 * KHONG phai seed. `prisma:seed` goi clearAll() chay DELETE FROM tung bang —
 * chay tren production la mat het phim admin da them va mat het ve khach da dat.
 *
 * Ba khac biet cot loi so voi seed.ts:
 *  1. Chi INSERT. Khong DELETE, khong UPDATE.
 *  2. KHONG ep id. Prod co the da co phim admin them chiem id 17+; ep id la
 *     dung ngay. De Postgres tu cap roi anh xa lai FK theo id that vua nhan.
 *  3. Khop theo KHOA TU NHIEN (ten phim / ten+dia chi rap / email user) nen
 *     chay hai lan khong nhan doi.
 *
 * Chay: npm run backfill:seed-data           (chi in du dinh)
 *       npm run backfill:seed-data -- --apply (thuc su ghi)
 */
import { Prisma, PrismaClient } from "@prisma/client";
import db from "../../db.json";
import { addDays, dayOf, offsetDaysFor } from "../src/schedule/date-shift";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const TODAY = new Date().toISOString().slice(0, 10);
const EARLIEST = db.showtimes.map((s) => dayOf(s.time)).sort()[0] ?? TODAY;
const OFFSET = offsetDaysFor(EARLIEST, TODAY);
const shift = (iso: string): string => addDays(iso, OFFSET);

const key = {
  city: (name: string) => name.trim().toLowerCase(),
  movie: (title: string) => title.trim().toLowerCase(),
  cinema: (name: string, address: string) =>
    `${name.trim().toLowerCase()}|${address.trim().toLowerCase()}`,
  room: (cinemaId: number, name: string) => `${cinemaId}|${name.trim().toLowerCase()}`,
  user: (email: string) => email.trim().toLowerCase(),
};

async function main() {
  // --- doc trang thai hien co cua DB dich ---
  const [cities, movies, cinemas, users, concessions] = await Promise.all([
    prisma.city.findMany(),
    prisma.movie.findMany(),
    prisma.cinema.findMany(),
    prisma.user.findMany(),
    prisma.concession.findMany(),
  ]);

  const cityId = new Map(cities.map((c) => [key.city(c.name), c.id]));
  const movieId = new Map(movies.map((m) => [key.movie(m.title), m.id]));
  const cinemaId = new Map(cinemas.map((c) => [key.cinema(c.name, c.address), c.id]));
  const userId = new Map(users.map((u) => [key.user(u.email), u.id]));
  const concessionNames = new Set(concessions.map((c) => c.name.trim().toLowerCase()));

  const plan = {
    cities: db.cities.filter((c) => !cityId.has(key.city(c.name))),
    movies: db.movies.filter((m) => !movieId.has(key.movie(m.title))),
    users: db.users.filter((u) => !userId.has(key.user(u.email))),
    concessions: db.concessions.filter((c) => !concessionNames.has(c.name.trim().toLowerCase())),
    cinemas: db.cinemas.filter((c) => !cinemaId.has(key.cinema(c.name, c.address))),
  };

  console.log("\nDu dinh chen:");
  console.log(`  City       ${plan.cities.length}`);
  console.log(`  Movie      ${plan.movies.length}`);
  console.log(`  User       ${plan.users.length}`);
  console.log(`  Concession ${plan.concessions.length}`);
  console.log(`  Cinema     ${plan.cinemas.length}`);
  console.log(`  Room / Showtime / Booking / Review: tinh sau khi co id that`);

  if (!APPLY) {
    console.log("\n(chua ghi gi — chay lai kem `-- --apply` neu danh sach tren dung)");
    return;
  }

  // --- 1. Bang khong phu thuoc ai ---
  for (const c of plan.cities) {
    const row = await prisma.city.create({ data: { name: c.name } });
    cityId.set(key.city(c.name), row.id);
  }
  for (const m of plan.movies) {
    const row = await prisma.movie.create({
      data: {
        title: m.title,
        poster: m.poster,
        backdrop: (m as { backdrop?: string | null }).backdrop ?? null,
        description: m.description,
        duration: m.duration,
        genre: m.genre,
        rating: m.rating,
      },
    });
    movieId.set(key.movie(m.title), row.id);
  }
  for (const u of plan.users) {
    const row = await prisma.user.create({
      data: {
        fullName: u.fullName,
        email: u.email,
        password: u.password,
        role: (u as { role?: string }).role ?? "user",
      },
    });
    userId.set(key.user(u.email), row.id);
  }
  for (const c of plan.concessions) {
    await prisma.concession.create({
      data: {
        name: c.name,
        category: c.category,
        price: c.price,
        description: c.description,
        image: c.image,
      },
    });
  }

  // --- 2. Cinema -> Room (can id that cua City / Cinema) ---
  const seedCityName = new Map(db.cities.map((c) => [c.id, c.name]));
  for (const c of plan.cinemas) {
    const row = await prisma.cinema.create({
      data: {
        name: c.name,
        address: c.address,
        cityId: cityId.get(key.city(seedCityName.get(c.cityId) ?? ""))!,
      },
    });
    cinemaId.set(key.cinema(c.name, c.address), row.id);
  }

  const rooms = await prisma.room.findMany();
  const roomId = new Map(rooms.map((r) => [key.room(r.cinemaId, r.name), r.id]));
  const seedCinema = new Map(db.cinemas.map((c) => [c.id, c]));
  const seedRoomToReal = new Map<number, number>();

  for (const r of db.rooms) {
    const sc = seedCinema.get(r.cinemaId)!;
    const realCinema = cinemaId.get(key.cinema(sc.name, sc.address));
    if (!realCinema) continue;
    const existing = roomId.get(key.room(realCinema, r.name));
    if (existing) {
      seedRoomToReal.set(r.id, existing);
      continue;
    }
    const row = await prisma.room.create({
      data: {
        name: r.name,
        type: r.type,
        rows: r.rows,
        cols: r.cols,
        vipRows: r.vipRows ?? [],
        coupleRows: (r as { coupleRows?: string[] }).coupleRows ?? [],
        aisleAfterCols: (r as { aisleAfterCols?: number[] }).aisleAfterCols ?? [],
        cinemaId: realCinema,
      },
    });
    seedRoomToReal.set(r.id, row.id);
    roomId.set(key.room(realCinema, r.name), row.id);
  }

  // --- 3. Showtime: khoa tu nhien = (roomId that, time da dich) ---
  const seedMovieTitle = new Map(db.movies.map((m) => [m.id, m.title]));
  const existingSt = new Set(
    (await prisma.showtime.findMany({ select: { roomId: true, time: true } })).map(
      (s) => `${s.roomId}|${s.time}`,
    ),
  );
  const stRows: Prisma.ShowtimeCreateManyInput[] = [];
  for (const s of db.showtimes) {
    const realRoom = seedRoomToReal.get(s.roomId);
    const realMovie = movieId.get(key.movie(seedMovieTitle.get(s.movieId) ?? ""));
    if (!realRoom || !realMovie) continue;
    const time = shift(s.time);
    if (existingSt.has(`${realRoom}|${time}`)) continue;
    existingSt.add(`${realRoom}|${time}`);
    stRows.push({
      movieId: realMovie,
      roomId: realRoom,
      time,
      price: s.price,
      bookedSeats: s.bookedSeats ?? [],
    });
  }
  if (stRows.length) await prisma.showtime.createMany({ data: stRows });

  console.log(`\n✅ Da chen: ${plan.cities.length} City · ${plan.movies.length} Movie · ${plan.users.length} User · ${plan.concessions.length} Concession · ${plan.cinemas.length} Cinema · ${seedRoomToReal.size} Room (anh xa) · ${stRows.length} Showtime`);
  console.log("Booking va Review co y KHONG chen: don va danh gia cua nguoi that moi co y nghia tren prod.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Bước 2: Thêm script**

```json
"backfill:seed-data": "tsx server/prisma/backfill-seed-data.ts",
```

- [ ] **Bước 3: Chạy dry-run trên DB dev (đã đầy) — phải báo 0**

```bash
npm run backfill:seed-data
```
Kỳ vọng: mọi dòng `Du dinh chen` đều **0** — DB dev vừa seed nên không còn gì để chèn. Đây là phép thử tính **luỹ đẳng**: nếu ra số khác 0, khoá tự nhiên đang sai và chạy trên prod sẽ nhân đôi dữ liệu.

- [ ] **Bước 4: Thử trên DB rỗng mô phỏng prod cũ**

```bash
npx tsx -e "
import {PrismaClient} from '@prisma/client';
const p=new PrismaClient();
(async()=>{
  await p.review.deleteMany(); await p.booking.deleteMany();
  await p.showtime.deleteMany({where:{roomId:{gt:10}}});
  await p.room.deleteMany({where:{id:{gt:10}}});
  await p.cinema.deleteMany({where:{id:{gt:5}}});
  await p.movie.deleteMany({where:{id:{gt:16}}});
  await p.user.deleteMany({where:{id:{gt:4}}});
  await p.city.deleteMany({where:{id:{gt:3}}});
  await p.concession.deleteMany({where:{id:{gt:8}}});
  console.log('da dua DB dev ve trang thai giong prod cu');
  await p.\$disconnect();
})();"
npm run backfill:seed-data
```
Kỳ vọng: `Movie 24 · City 2 · User 26 · Concession 6 · Cinema 7`.

```bash
npm run backfill:seed-data -- --apply
npm run backfill:seed-data
```
Kỳ vọng: lần `--apply` in `✅ Da chen: ...`; lần chạy lại ngay sau đó in **toàn 0** (luỹ đẳng). Rồi `npm run prisma:seed` để đưa DB dev về đủ.

- [ ] **Bước 5: Commit**

```bash
npx prettier --write server/prisma/backfill-seed-data.ts package.json
npm run typecheck
git add server/prisma/backfill-seed-data.ts package.json
git commit -F - <<'EOF'
feat(seed): script boi them du lieu cho production

prisma:seed goi clearAll() chay DELETE FROM tung bang — chay tren prod la mat het
ve khach va phim admin tu them. Script nay chi INSERT.

Ba khac biet cot loi so voi seed.ts:

Khong ep id. Prod co the da co phim admin them chiem id 17+, ep id la dung ngay.
De Postgres tu cap roi anh xa lai FK theo id THAT vua nhan — day la ly do phai
di tuan tu City -> Cinema -> Room -> Showtime chu khong createMany mot phat.

Khop theo KHOA TU NHIEN (ten phim / ten+dia chi rap / email user / (phong,gio))
nen chay hai lan khong nhan doi. Da kiem tinh luy dang bang cach chay --apply roi
chay lai ngay: lan hai bao 0.

Booking va Review co y KHONG chen len prod: don hang va danh gia chi co y nghia
khi la cua nguoi that. Prod day catalogue la du.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 10: Sáu cổng CI, kiểm mắt, tài liệu

**Files:**
- Modify: `CLAUDE.md` (mục Commands + mục `db.json`)

- [ ] **Bước 1: Chạy đủ sáu cổng**

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:cov
```
Kỳ vọng: typecheck sạch · lint **0 cảnh báo** · format sạch · test **525** (522 cũ + 3 test mới ở Task 1) và **coverage vẫn trên ngưỡng** (statements/lines 90, branches 87, functions 84).

- [ ] **Bước 2: e2e — cổng dễ vỡ nhất**

```bash
npm run e2e
```
Kỳ vọng: **39/39 xanh**. Nếu `reviews.spec.ts` đỏ với 409 → có review (phim 7, user 1) lọt lưới, quay lại Task 7 bước 3. Nếu `booking.spec.ts` đỏ ở `.time-k-btn` → rạp cuối cùng không có suất sắp tới; kiểm bằng:

```bash
node -e "const d=require('./db.json'); const last=d.cinemas[d.cinemas.length-1]; const rooms=d.rooms.filter(r=>r.cinemaId===last.id).map(r=>r.id); console.log(last.name, '| suat:', d.showtimes.filter(s=>rooms.includes(s.roomId)).length);"
```

- [ ] **Bước 3: Kiểm mắt — thứ cổng CI không nhìn được**

```bash
npm run build && npm run dev
```
Mở `http://localhost:3000` và xác nhận **bằng mắt**:
- Trang chủ: lưới phim dài, dải "tối nay" nhiều suất
- `/movies`: lọc theo thể loại ra kết quả ở **nhiều** thể loại, không chỉ Action
- `/movie/<id>` bất kỳ: có phần đánh giá, có sao, có badge "Đã xem"
- Chọn thành phố → rạp → ngày: **luôn có suất**, thử cả Hải Phòng và Cần Thơ
- `/admin`: biểu đồ doanh thu có **đường cong**, bảng đơn hàng nhiều trang
- `/admin/movies`: cột đánh dấu phim thiếu ảnh nền — kiểm thumbnail có đúng phim không

- [ ] **Bước 4: Cập nhật `CLAUDE.md`**

Trong khối ```` ```bash ```` mục `## Commands`, ngay sau dòng `backfill:backdrops`:

```
npm run seed:verify-images     # curl kiểm ảnh TMDB trong MOVIE_POOL -> images.verified.json
npm run seed:generate          # sinh suất chiếu/đơn/đánh giá rồi NỐI vào db.json (chỉ thêm)
npm run backfill:seed-data     # dry run: chèn catalogue mới vào DB đang chạy (prod-safe)
npm run backfill:seed-data -- --apply
```

Trong đoạn `- **db.json**`, thêm vào cuối:

```
Dữ liệu được sinh bởi `scripts/gen-seed-data.mjs` (PRNG seed cố định ⇒ chạy lại ra kết quả y hệt); dữ liệu biên tập nằm ở `scripts/seed-data/*.mjs`. Luật giá được **port** sang `scripts/lib/seed-pricing.mjs` (scripts không import được path-alias `"types"`) và khoá vào bản gốc bằng `src/lib/seedPricing.test.ts`.
```

- [ ] **Bước 5: Commit + push**

```bash
npx prettier --write CLAUDE.md
npm run format:check
git add CLAUDE.md
git commit -F - <<'EOF'
docs(claude): ghi lai bo lenh sinh du lieu

Ba lenh moi va mot cai bay: luat gia bi PORT sang scripts/lib/seed-pricing.mjs
vi scripts/ khong phan giai duoc path-alias "types". Ai sua gia ma chi sua mot
ben thi src/lib/seedPricing.test.ts do — ghi vao day de khong ai phai tim ra
dieu do bang cach lam hong.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
git push origin main
```

- [ ] **Bước 6: Bàn giao lệnh chạy production cho người dùng**

In ra cho người dùng đúng hai lệnh sau, kèm cảnh báo đọc kỹ dry-run trước:

```bash
# 1. Xem trước, KHÔNG ghi gì:
DATABASE_URL="<chuoi tu Render>" DIRECT_URL="<chuoi tu Render>" npm run backfill:seed-data

# 2. Nếu số liệu trên đúng, mới ghi:
DATABASE_URL="<chuoi tu Render>" DIRECT_URL="<chuoi tu Render>" npm run backfill:seed-data -- --apply
```

Sau khi họ chạy: mở `https://cinema-full-a9xt.onrender.com` **bằng trình duyệt** (không phải `curl`) — bản live từng treo splash 4 ngày trong khi API trả 200 khoẻ mạnh.

---

## Tự soát kế hoạch

**Phủ spec:** quy mô (Task 2,4,5,6,7) · hai đường ra (Task 8 dev, Task 9 prod) · ảnh verify (Task 3) · lai biên tập/cơ học (Task 2 vs 4-7) · 4 ràng buộc bắt buộc (ngày cứng Task 4 bước 4; phim 7 Task 7 bước 3; không đụng dòng cũ Task 4 bước 4; giá đúng Task 1 + Task 6 bước 3) · kiểm chứng (Task 10). Không còn mục nào của spec chưa có task.

**Phát sinh ngoài spec, đã thêm task:** `seed.ts` làm rơi cột tiền của booking (Task 8) — không sửa thì Task 6 thành công cốc.

**Nhất quán tên gọi:** `makeRng`/`flatSeats`/`priceOf`/`seatType`/`SERVICE_FEE`/`ROOM_TYPE_PRICE` dùng thống nhất từ Task 1 đến Task 7. `MOVIE_POOL`→`images.verified.json`→`verified.movies` khớp giữa Task 2, 3, 4. `seedRoomToReal` chỉ tồn tại trong Task 9.
