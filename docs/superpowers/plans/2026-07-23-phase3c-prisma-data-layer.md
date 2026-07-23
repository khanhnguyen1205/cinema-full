# GĐ3c — Swap data layer json-server → Prisma — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay tầng dữ liệu của gateway (`server/src`) từ **proxy json-server** sang **truy vấn Prisma trên Postgres (Neon dev)**, gỡ hẳn json-server khỏi dự án — mà **hợp đồng HTTP `/api/*` + `/auth/*` không đổi một ký tự**, nên frontend (`src/**`) KHÔNG sửa dòng nào.

**Architecture:** Hiện có đúng 3 "seam" chạm json-server: `api/forward.ts` (proxy REST tổng quát), `api/occupied.ts` (đọc bookings + showtime), `auth/users.ts` (CRUD user). Ta thay lần lượt: thêm `db/prisma.ts` (singleton) + `api/collections.ts` (metadata thuần, test được không cần DB) + `api/repo.ts` (dịch REST kiểu-json-server sang Prisma, thay `forward.ts` với chữ ký gần y hệt để diff ở `gateway.ts` cực nhỏ). `holds.ts` là in-memory nên **không đụng**. `gateway.ts` giữ NGUYÊN toàn bộ luật phân quyền.

**Tech Stack:** Prisma 6.19.3 + `@prisma/client` (ĐÃ ghim, KHÔNG nâng 7.x), Postgres (Neon nhánh `dev` cho local, service container cho CI), Express 5 + TypeScript, `tsx` chạy dev.

## Global Constraints

- **Node 22** (local `v22.11.0`; CI node 22). **TypeScript ~5.7** strict.
- **Giữ 6 cổng CI xanh, lint 0 warning** ở MỌI commit: `typecheck` · `lint` · `format:check` · `test:run` · `e2e` · `build`. Một warning = fail CI.
- **HỢP ĐỒNG HTTP BẤT BIẾN** — đây là ràng buộc vàng của GĐ3. Mọi path/query/body/shape/status code phải khớp hành vi json-server hiện tại (xem §"Hợp đồng phải giữ" bên dưới). `id` luôn là **number** trong JSON trả về.
- **KHÔNG sửa file nào trong `src/`** (frontend). Nếu thấy "cần sửa frontend" → là dấu hiệu đã phá hợp đồng, phải sửa server thay vì sửa client.
- **Express 5**: handler trả `void` → dùng mẫu `res.x(); return;`, KHÔNG `return res.x()`. Route riêng (`/api/occupied-seats`, `/api/holds`) phải khai báo TRƯỚC catch-all `app.use("/api", …)`.
- **Bí mật KHÔNG commit:** `DATABASE_URL`/`DIRECT_URL`/`JWT_SECRET` chỉ ở `.env` (gitignored) + env CI/Render. `.env.example` chỉ placeholder.
- **Copy tiếng Việt** cho mọi thông báo lỗi người-đọc (giữ đúng chuỗi cũ khi thông báo đã tồn tại).
- **Server chạy `tsx` KHÔNG watch** → sau mỗi lần sửa `server/**` phải **restart tay** :4000 mới thấy thay đổi (kill listener rồi `npm run auth`). Holds in-memory reset theo.
- Mỗi Task = **1 commit**, push thẳng `main` (repo cá nhân, không PR).

## Hợp đồng phải giữ (rà từ `src/services/api.ts` + `src/services/auth.ts`)

Đây là **toàn bộ** bề mặt json-server mà client dùng — không có gì khác:

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/{movies,showtimes,cities,cinemas,rooms,concessions,bookings}` | trả **mảng**, thứ tự **theo id tăng dần** (json-server trả theo thứ tự trong db.json = id tăng) |
| GET | `/api/{coll}/{id}` | trả **object**; không thấy → **404** |
| GET | `/api/showtimes?movieId=5` · `?roomId=3` · `/api/cinemas?cityId=1` · `/api/rooms?cinemaId=2` | lọc bằng nhau, giá trị query là **chuỗi** → phải ép Int |
| POST | `/api/{coll}` | tạo mới, trả object kèm `id` mới, status **201** |
| PATCH | `/api/{coll}/{id}` | cập nhật một phần, trả object đầy đủ sau khi sửa |
| DELETE | `/api/{coll}/{id}` | json-server trả **`{}` + 200** |
| GET | `/api/occupied-seats?showtimeId=` | `{ showtimeId: number, seats: string[] }` |
| POST/DELETE | `/api/holds` | in-memory, **không đổi** |
| POST/GET | `/auth/*` | không đổi (chỉ ruột `users.ts` đổi) |

Body POST `/api/bookings` mà `BookingWizard.tsx:203-224` gửi: `movieId, showtimeId, cinemaId, roomId, seats, seatTypes, concessions, paymentMethod, userId, userName, seatTotal, fnbTotal, serviceFee, totalPrice, createdAt`.
Body PATCH `/api/bookings/{id}` mà `AdminBookings.tsx:122-127` gửi: `seats, seatTypes, seatTotal, totalPrice`.

## File Structure

- `server/prisma/schema.prisma` — **modify**: thêm 4 trường Booking (`paymentMethod`, `seatTotal`, `fnbTotal`, `serviceFee`) mà json-server vẫn nhận nhưng schema 3a bỏ sót.
- `server/prisma/migrations/<ts>_booking_extra_fields/` — **create** (CLI sinh).
- `server/src/db/prisma.ts` — **create**: singleton `PrismaClient`. Một trách nhiệm: sở hữu kết nối.
- `server/src/api/collections.ts` — **create**: metadata thuần (danh sách collection, trường lọc được + kiểu, trường ghi được, trường Json) + 2 hàm thuần `parseFilters` / `pickWritable`. **Không import Prisma** → unit test chạy không cần DB.
- `server/src/api/collections.test.ts` — **create**: test cho 2 hàm thuần trên.
- `server/src/api/repo.ts` — **create**: `handleRest(req, res, rest, extraFilters?)` — bản thay thế của `forward()`, dịch REST-kiểu-json-server sang Prisma.
- `server/src/api/forward.ts` — **delete** (Task 4).
- `server/src/api/gateway.ts` — **modify**: đổi `forward(...)` → `handleRest(...)`. Luật phân quyền giữ nguyên 100%.
- `server/src/api/occupied.ts` — **modify**: 2 lệnh `fetch` → 2 truy vấn Prisma.
- `server/src/auth/users.ts` — **modify**: 4 hàm fetch → Prisma (giữ NGUYÊN chữ ký).
- `server/src/env.ts` — **modify**: bỏ `DATA_URL`, thêm guard `DATABASE_URL`.
- `.github/workflows/ci.yml` — **modify**: job `e2e` thêm Postgres service container + `migrate deploy` + `seed`.
- `package.json` — **modify**: bỏ dep `json-server`, bỏ script `api` + `hash-passwords`, `dev` còn auth+web.
- `.claude/start-dev.ps1` — **modify**: không khởi động :9999.
- `.env` / `.env.example` — **modify**: bỏ `DATA_URL`.
- `server/hash-passwords.js` — **delete**: chỉ chạy được qua json-server; `db.json` đã là bcrypt và giờ chỉ còn vai trò seed.
- `eslint.config.mjs` — **modify**: bỏ block `server/**/*.js` (hết file .js trong server).

**KHÔNG đụng:** `server/src/api/holds.ts`, `server/src/auth/{routes,tokens,cookies,middleware,helpers}.ts`, `server/src/app.ts`, `server/src/index.ts`, toàn bộ `src/**`, `db.json` (giữ làm nguồn seed).

---

## Task 1: Bổ sung 4 trường Booking còn thiếu trong schema

**Vì sao:** json-server không có schema nên lưu mọi field client gửi. Prisma sẽ **ném lỗi** với field lạ. `ETicket.tsx:84` đọc `booking.paymentMethod`; `AdminOverview.tsx:27,53` đọc `seatTotal`/`fnbTotal` để dựng biểu đồ doanh thu; `AdminBookings.tsx:117,125` đọc/ghi `seatTotal`+`fnbTotal`. Thiếu 4 cột này = đặt vé vỡ và doanh thu sai. Lát này **additive**, runtime chưa đổi.

**Files:**
- Modify: `server/prisma/schema.prisma` (model `Booking`)
- Create: `server/prisma/migrations/<timestamp>_booking_extra_fields/migration.sql` (CLI sinh)

**Interfaces:**
- Produces: các cột `paymentMethod String?`, `seatTotal Int?`, `fnbTotal Int?`, `serviceFee Int?` trên bảng `Booking` — Task 4 (`collections.ts` whitelist + `repo.ts`) dựa vào.

- [ ] **Step 1: Sửa model `Booking` trong `server/prisma/schema.prisma`**

Thay khối `model Booking { … }` thành:

```prisma
model Booking {
  id            Int      @id @default(autoincrement())
  movieId       Int
  showtimeId    Int
  cinemaId      Int
  roomId        Int
  seats         String[]
  seatTypes     Json
  concessions   Json?
  paymentMethod String?
  userId        Int
  userName      String
  seatTotal     Int?
  fnbTotal      Int?
  serviceFee    Int?
  totalPrice    Int
  createdAt     String
}
```

Tất cả **optional** (`?`) vì 3 booking seed trong `db.json` không có chúng.

- [ ] **Step 2: Tạo migration**

Run:
```bash
npm run prisma:migrate -- --name booking_extra_fields
```
Expected: sinh `server/prisma/migrations/<ts>_booking_extra_fields/migration.sql` chứa `ALTER TABLE "Booking" ADD COLUMN …` cho 4 cột, in "Your database is now in sync with your schema.", rồi tự chạy `prisma generate`.

- [ ] **Step 3: Kiểm cột đã lên DB và seed vẫn chạy**

Run:
```bash
npm run prisma:seed
```
Expected: bảng đếm y như cũ (City 3 · Movie 16 · User 4 · Concession 8 · Cinema 5 · Room 10 · Showtime 52 · Booking 3) + dòng "✅ Seed khớp db.json".

Run:
```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.booking.findUnique({where:{id:1}}).then(b=>console.log(b.paymentMethod,b.seatTotal,b.fnbTotal,b.serviceFee)).finally(()=>p.\$disconnect())"
```
Expected: `null null null null` (cột tồn tại, chưa có giá trị) — KHÔNG được lỗi "column does not exist".

- [ ] **Step 4: 6 cổng**

Run:
```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build
npm run e2e
```
Expected: tất cả PASS (app vẫn chạy json-server, chưa đổi gì về runtime).

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git status   # xac nhan .env KHONG duoc stage
git commit -m "feat(GD3c/1): them 4 truong Booking con thieu (paymentMethod/seatTotal/fnbTotal/serviceFee)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

---

## Task 2: `db/prisma.ts` + `api/collections.ts` (metadata thuần, có test) — chưa đấu dây

Tạo hai mảnh nền: singleton Prisma, và bảng metadata mô tả từng collection. Metadata tách riêng để **unit test chạy không cần DB** (cổng `test:run` trong CI không có Postgres ở lát này).

**Files:**
- Create: `server/src/db/prisma.ts`
- Create: `server/src/api/collections.ts`
- Create: `server/src/api/collections.test.ts`

**Interfaces:**
- Produces (Task 4 dùng):
  - `prisma: PrismaClient` (từ `server/src/db/prisma.ts`)
  - `type CollectionName = "movies"|"showtimes"|"cinemas"|"cities"|"rooms"|"concessions"|"bookings"|"users"`
  - `isCollection(name: string): name is CollectionName`
  - `parseFilters(c: CollectionName, query: Record<string, unknown>): Record<string, string | number>`
  - `pickWritable(c: CollectionName, body: Record<string, unknown>): Record<string, unknown>`
  - `COLLECTIONS: Record<CollectionName, { filterable: Record<string, "int"|"string">; writable: string[]; json: string[] }>`

- [ ] **Step 1: Viết test trước (`server/src/api/collections.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import { isCollection, parseFilters, pickWritable } from "./collections";

describe("isCollection", () => {
  it("nhận đúng tên collection hợp lệ", () => {
    expect(isCollection("movies")).toBe(true);
    expect(isCollection("bookings")).toBe(true);
  });
  it("từ chối tên lạ", () => {
    expect(isCollection("hackers")).toBe(false);
    expect(isCollection("")).toBe(false);
  });
});

describe("parseFilters", () => {
  it("ép query string sang Int cho trường kiểu int", () => {
    expect(parseFilters("showtimes", { movieId: "5" })).toEqual({ movieId: 5 });
    expect(parseFilters("rooms", { cinemaId: "2" })).toEqual({ cinemaId: 2 });
  });
  it("bỏ qua tham số không lọc được", () => {
    expect(parseFilters("movies", { _sort: "title", junk: "1" })).toEqual({});
  });
  it("bỏ qua giá trị int không hợp lệ", () => {
    expect(parseFilters("showtimes", { movieId: "abc" })).toEqual({});
  });
  it("giữ nguyên trường kiểu chuỗi", () => {
    expect(parseFilters("users", { email: "a@b.vn" })).toEqual({
      email: "a@b.vn",
    });
  });
  it("nhận cả số (gateway truyền userId dạng number)", () => {
    expect(parseFilters("bookings", { userId: 3 })).toEqual({ userId: 3 });
  });
});

describe("pickWritable", () => {
  it("chỉ giữ trường thuộc schema, bỏ id và rác", () => {
    expect(
      pickWritable("bookings", {
        id: 9,
        seats: ["A1"],
        totalPrice: 1000,
        junk: true,
      }),
    ).toEqual({ seats: ["A1"], totalPrice: 1000 });
  });
  it("giữ nguyên mảng và object lồng", () => {
    expect(
      pickWritable("rooms", {
        vipRows: ["E", "F"],
        aisleAfterCols: [6],
        name: "P1",
      }),
    ).toEqual({ vipRows: ["E", "F"], aisleAfterCols: [6], name: "P1" });
  });
  it("bỏ trường undefined nhưng giữ trường null", () => {
    expect(
      pickWritable("bookings", { userName: undefined, concessions: null }),
    ).toEqual({ concessions: null });
  });
  it("bỏ 4 trường mở rộng của booking không bị lọc nhầm", () => {
    expect(
      pickWritable("bookings", {
        paymentMethod: "momo",
        seatTotal: 1,
        fnbTotal: 2,
        serviceFee: 3,
      }),
    ).toEqual({
      paymentMethod: "momo",
      seatTotal: 1,
      fnbTotal: 2,
      serviceFee: 3,
    });
  });
});
```

- [ ] **Step 2: Chạy test cho nó FAIL**

Run: `npx vitest run server/src/api/collections.test.ts`
Expected: FAIL — `Failed to resolve import "./collections"` (file chưa tồn tại).

- [ ] **Step 3: Viết `server/src/api/collections.ts`**

```ts
// Metadata mô tả từng collection REST — THUẦN (không import Prisma) để test không cần DB.
// Danh sách trường bám đúng server/prisma/schema.prisma.
export type CollectionName =
  | "movies"
  | "showtimes"
  | "cinemas"
  | "cities"
  | "rooms"
  | "concessions"
  | "bookings"
  | "users";

type FilterType = "int" | "string";

type CollectionSpec = {
  filterable: Record<string, FilterType>; // query ?field= được phép lọc
  writable: string[]; // trường được nhận từ body (chặn ghi id / rác)
  json: string[]; // trường Json (null cần Prisma.DbNull)
};

export const COLLECTIONS: Record<CollectionName, CollectionSpec> = {
  movies: {
    filterable: { id: "int" },
    writable: [
      "title",
      "poster",
      "description",
      "duration",
      "genre",
      "rating",
    ],
    json: [],
  },
  showtimes: {
    filterable: { id: "int", movieId: "int", roomId: "int" },
    writable: ["time", "price", "bookedSeats", "movieId", "roomId"],
    json: [],
  },
  cinemas: {
    filterable: { id: "int", cityId: "int" },
    writable: ["name", "address", "cityId"],
    json: [],
  },
  cities: {
    filterable: { id: "int" },
    writable: ["name"],
    json: [],
  },
  rooms: {
    filterable: { id: "int", cinemaId: "int" },
    writable: [
      "name",
      "type",
      "rows",
      "cols",
      "vipRows",
      "coupleRows",
      "aisleAfterCols",
      "cinemaId",
    ],
    json: [],
  },
  concessions: {
    filterable: { id: "int" },
    writable: ["name", "category", "price", "description", "image"],
    json: [],
  },
  bookings: {
    filterable: { id: "int", userId: "int", showtimeId: "int" },
    writable: [
      "movieId",
      "showtimeId",
      "cinemaId",
      "roomId",
      "seats",
      "seatTypes",
      "concessions",
      "paymentMethod",
      "userId",
      "userName",
      "seatTotal",
      "fnbTotal",
      "serviceFee",
      "totalPrice",
      "createdAt",
    ],
    json: ["seatTypes", "concessions"],
  },
  users: {
    filterable: { id: "int", email: "string", role: "string" },
    writable: ["fullName", "email", "password", "role"],
    json: [],
  },
};

export function isCollection(name: string): name is CollectionName {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, name);
}

// ?movieId=5 (chuỗi) -> { movieId: 5 }. Bỏ qua tham số lạ hoặc số không hợp lệ.
export function parseFilters(
  c: CollectionName,
  query: Record<string, unknown>,
): Record<string, string | number> {
  const spec = COLLECTIONS[c];
  const where: Record<string, string | number> = {};
  for (const [key, raw] of Object.entries(query)) {
    const type = spec.filterable[key];
    if (!type || raw == null) continue;
    if (type === "int") {
      const n = Number(raw);
      if (Number.isFinite(n)) where[key] = n;
    } else {
      where[key] = String(raw);
    }
  }
  return where;
}

// Chỉ nhận trường có trong schema (chặn ghi đè id và field rác json-server từng nuốt).
export function pickWritable(
  c: CollectionName,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const spec = COLLECTIONS[c];
  const data: Record<string, unknown> = {};
  for (const key of spec.writable) {
    if (key in body && body[key] !== undefined) data[key] = body[key];
  }
  return data;
}
```

- [ ] **Step 4: Chạy test cho PASS**

Run: `npx vitest run server/src/api/collections.test.ts`
Expected: PASS — 11 test (2 isCollection + 5 parseFilters + 4 pickWritable).

- [ ] **Step 5: Viết `server/src/db/prisma.ts`**

```ts
import { PrismaClient } from "@prisma/client";

// Một client dùng chung cho cả tiến trình (mở pool riêng cho mỗi instance là lãng phí).
export const prisma = new PrismaClient();
```

- [ ] **Step 6: 6 cổng** (chưa nơi nào import `prisma.ts` → runtime vẫn y nguyên)

Run:
```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build
npm run e2e
```
Expected: PASS. `test:run` giờ nhiều hơn 11 test so với trước (69 → 80).

> Nếu `lint` báo `prisma.ts` "unused export" — không có rule đó trong cấu hình hiện tại, bỏ qua. Nếu `typecheck` báo không tìm thấy `@prisma/client`, chạy `npm run prisma:generate` rồi thử lại.

- [ ] **Step 7: Commit**

```bash
npm run format
git add server/src/db/prisma.ts server/src/api/collections.ts server/src/api/collections.test.ts
git commit -m "feat(GD3c/2): prisma singleton + metadata collection (11 test) — chua dau day

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

---

## Task 3: CI có Postgres riêng cho job e2e (làm TRƯỚC khi flip)

**Vì sao phải làm trước:** job `e2e` chạy `npm run dev`; ngay khi Task 4 flip sang Prisma, server sẽ cần `DATABASE_URL` — không có thì crash và **CI đỏ tại chính commit flip**. Đặt hạ tầng DB vào CI trước, khi app còn chạy json-server: bước migrate/seed lúc này là "no-op vô hại", nhưng chứng minh container + migration + seed chạy được trên CI. (Spec xếp việc này ở 3e; kéo lên đây vì kỷ luật "mọi commit 6 cổng xanh".)

**Files:**
- Modify: `.github/workflows/ci.yml` (chỉ job `e2e`)

**Interfaces:**
- Produces: job `e2e` có sẵn env `DATABASE_URL`/`DIRECT_URL` trỏ Postgres container + DB đã migrate & seed — Task 4 dựa vào.

- [ ] **Step 1: Sửa job `e2e` trong `.github/workflows/ci.yml`**

Thay toàn bộ khối `e2e:` (từ dòng `  e2e:` tới hết file) bằng:

```yaml
  e2e:
    name: Playwright smoke
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: cinema_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/cinema_test
      DIRECT_URL: postgresql://postgres:postgres@localhost:5432/cinema_test
      JWT_SECRET: ci-e2e-secret-not-a-real-one
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Áp migration lên Postgres của CI
        run: npx prisma migrate deploy --schema server/prisma/schema.prisma
      - name: Nạp dữ liệu seed
        run: npm run prisma:seed
      - name: Cài Chromium cho Playwright
        run: npx playwright install --with-deps chromium
      # webServer trong playwright.config tự bật các server qua `npm run dev`
      # (CI=true nên reuseExistingServer=false). Trace được lưu khi có retry.
      - run: npm run e2e
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

Ghi chú:
- `DIRECT_URL` phải có vì `schema.prisma` khai `directUrl = env("DIRECT_URL")` — thiếu là Prisma CLI lỗi.
- Đặt `JWT_SECRET` để bỏ cảnh báo secret mặc định (và để `NODE_ENV=production` sau này không throw).
- Job `checks` **không đổi**: `npm ci` → `postinstall` `prisma generate` không cần DB (đã kiểm ở 3a).

- [ ] **Step 2: `format:check` phải sạch (Prettier quét cả YAML)**

Run:
```bash
npm run format
npm run format:check
```
Expected: "All matched files use Prettier code style!". YAML workflow bị Prettier format lại là bình thường — commit luôn bản đã format.

- [ ] **Step 3: 6 cổng local**

Run:
```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build
npm run e2e
```
Expected: PASS (local vẫn json-server + Neon dev, không ảnh hưởng).

- [ ] **Step 4: Commit + push + xác minh CI**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(GD3c/3): Postgres service container + migrate/seed cho job e2e

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

Sau ~3', kiểm run mới nhất (không có `gh` CLI):
```bash
curl -s "https://api.github.com/repos/khanhnguyen1205/cinema-full/actions/runs?per_page=1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d).workflow_runs[0];console.log(r.head_commit.message.split('\n')[0],'|',r.status,'|',r.conclusion)})"
```
Expected: `... | completed | success`. **Đây là cổng bắt buộc trước khi sang Task 4** — nếu container/migrate/seed lỗi trên CI, sửa ở đây, đừng mang sang commit flip.

---

## Task 4: FLIP — gateway/occupied/users chạy trên Prisma

Lát trọng tâm. Sau task này server **không còn gọi json-server**, nhưng json-server vẫn được `npm run dev` khởi động (gỡ ở Task 5) nên nếu có sự cố vẫn dễ so sánh.

**Files:**
- Create: `server/src/api/repo.ts`
- Delete: `server/src/api/forward.ts`
- Modify: `server/src/api/gateway.ts` (chỉ đổi lời gọi `forward` → `handleRest`)
- Modify: `server/src/api/occupied.ts`
- Modify: `server/src/auth/users.ts`
- Modify: `server/src/env.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `isCollection`/`parseFilters`/`pickWritable`/`COLLECTIONS` (Task 2), cột Booking mới (Task 1).
- Produces: `handleRest(req: Request, res: Response, rest: string, extraFilters?: Record<string, string | number>): Promise<void>` — cùng vai trò `forward()` cũ, cùng thứ tự tham số, nên `gateway.ts` chỉ đổi tên hàm.

- [ ] **Step 1: Viết `server/src/api/repo.ts`**

```ts
import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../db/prisma";
import {
  COLLECTIONS,
  isCollection,
  parseFilters,
  pickWritable,
  type CollectionName,
} from "./collections";

// Các delegate Prisma khác kiểu nhau; ta chỉ dùng đúng 5 phương thức với hình dạng
// tham số giống nhau nên gom về một giao diện chung.
type AnyDelegate = {
  findMany(args: { where?: object; orderBy?: object }): Promise<unknown[]>;
  findUnique(args: { where: { id: number } }): Promise<unknown | null>;
  create(args: { data: object }): Promise<unknown>;
  update(args: { where: { id: number }; data: object }): Promise<unknown>;
  delete(args: { where: { id: number } }): Promise<unknown>;
};

function delegate(c: CollectionName): AnyDelegate {
  const map = {
    movies: prisma.movie,
    showtimes: prisma.showtime,
    cinemas: prisma.cinema,
    cities: prisma.city,
    rooms: prisma.room,
    concessions: prisma.concession,
    bookings: prisma.booking,
    users: prisma.user,
  };
  return map[c] as unknown as AnyDelegate;
}

// Prisma đòi Prisma.DbNull cho cột Json khi muốn lưu null (null trần bị từ chối).
function normalizeJson(
  c: CollectionName,
  data: Record<string, unknown>,
): Record<string, unknown> {
  for (const field of COLLECTIONS[c].json) {
    if (field in data && data[field] === null) data[field] = Prisma.DbNull;
  }
  return data;
}

// Thay thế forward(): dịch REST kiểu json-server sang Prisma, giữ nguyên status code.
export async function handleRest(
  req: Request,
  res: Response,
  rest: string,
  extraFilters?: Record<string, string | number>,
): Promise<void> {
  const [name, idPart, ...deeper] = rest.split("/");
  if (!isCollection(name) || deeper.length > 0) {
    res.status(404).json({});
    return;
  }
  const c: CollectionName = name;
  const id = idPart != null && idPart !== "" ? Number(idPart) : undefined;
  if (idPart != null && idPart !== "" && !Number.isFinite(id)) {
    res.status(404).json({}); // json-server: id không tồn tại -> 404
    return;
  }

  try {
    if (req.method === "GET") {
      if (id != null) {
        const row = await delegate(c).findUnique({ where: { id } });
        if (!row) {
          res.status(404).json({});
          return;
        }
        res.json(row);
        return;
      }
      const where = {
        ...parseFilters(c, req.query as Record<string, unknown>),
        ...(extraFilters ?? {}),
      };
      // json-server trả theo thứ tự trong db.json (= id tăng dần) — giữ y hệt.
      const rows = await delegate(c).findMany({
        where,
        orderBy: { id: "asc" },
      });
      res.json(rows);
      return;
    }

    if (req.method === "POST") {
      const data = normalizeJson(
        c,
        pickWritable(c, (req.body ?? {}) as Record<string, unknown>),
      );
      if (c === "bookings" && data.createdAt == null)
        data.createdAt = new Date().toISOString();
      const row = await delegate(c).create({ data });
      res.status(201).json(row); // json-server trả 201 khi tạo
      return;
    }

    if (req.method === "PATCH" || req.method === "PUT") {
      if (id == null) {
        res.status(404).json({});
        return;
      }
      const data = normalizeJson(
        c,
        pickWritable(c, (req.body ?? {}) as Record<string, unknown>),
      );
      const row = await delegate(c).update({ where: { id }, data });
      res.json(row);
      return;
    }

    if (req.method === "DELETE") {
      if (id == null) {
        res.status(404).json({});
        return;
      }
      await delegate(c).delete({ where: { id } });
      res.json({}); // json-server trả {} + 200
      return;
    }

    res.status(405).json({ error: "Phương thức không được hỗ trợ." });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        res.status(404).json({}); // update/delete bản ghi không tồn tại
        return;
      }
      if (e.code === "P2003") {
        res.status(409).json({ error: "Dữ liệu đang được tham chiếu." });
        return;
      }
      if (e.code === "P2002") {
        res.status(409).json({ error: "Dữ liệu đã tồn tại." });
        return;
      }
    }
    console.error("[api]", e);
    res.status(502).json({ error: "Lỗi cổng dữ liệu." });
  }
}
```

- [ ] **Step 2: Đổi `gateway.ts` sang `handleRest` (5 chỗ + 1 import)**

Trong `server/src/api/gateway.ts`:
- Dòng 2: `import { forward } from "./forward";` → `import { handleRest } from "./repo";`
- Mọi lời gọi `await forward(req, res, rest);` → `await handleRest(req, res, rest);` (có 5 chỗ: users, bookings-admin-read, bookings-POST, bookings-PATCH/DELETE, catalog×2 — thay tất cả).
- Dòng scoping booking: `await forward(req, res, rest, { userId: user.id });` → `await handleRest(req, res, rest, { userId: user.id });`

**KHÔNG đổi gì khác trong file này** — toàn bộ luật phân quyền, thông báo lỗi, `releaseHolds` giữ nguyên.

Kiểm nhanh không sót:
```bash
grep -rn "forward" server/src/
```
Expected: không còn kết quả nào (ngoài file `forward.ts` sắp xoá).

- [ ] **Step 3: Xoá `server/src/api/forward.ts`**

```bash
rm server/src/api/forward.ts
```

- [ ] **Step 4: Viết lại `server/src/api/occupied.ts`**

```ts
import { Router } from "express";
import { getUserFromReq } from "../auth/middleware";
import { heldByOthers } from "./holds";
import { prisma } from "../db/prisma";

export const occupiedRouter: Router = Router();

// Ghế đã đặt của 1 suất: đã bán (booking + showtime.bookedSeats) + ghế người khác đang giữ.
// Chỉ trả số ghế, KHÔNG kèm thông tin cá nhân của đơn.
occupiedRouter.get("/", async (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Vui lòng đăng nhập." });
    return;
  }
  const raw = req.query.showtimeId as string | undefined;
  if (!raw) {
    res.status(400).json({ error: "Thiếu showtimeId." });
    return;
  }
  const showtimeId = Number(raw);
  if (!Number.isFinite(showtimeId)) {
    res.status(400).json({ error: "Thiếu showtimeId." });
    return;
  }
  try {
    const [showtime, bookings] = await Promise.all([
      prisma.showtime.findUnique({
        where: { id: showtimeId },
        select: { bookedSeats: true },
      }),
      prisma.booking.findMany({
        where: { showtimeId },
        select: { seats: true },
      }),
    ]);
    const set = new Set<string>(showtime?.bookedSeats ?? []);
    bookings.forEach((b) => b.seats.forEach((s) => set.add(s)));
    heldByOthers(raw, user.id).forEach((s) => set.add(s)); // ghế người khác đang giữ
    res.json({ showtimeId, seats: [...set] });
  } catch {
    res.status(502).json({ error: "Lỗi cổng dữ liệu." });
  }
});
```

> Lưu ý `heldByOthers(raw, …)`: kho hold dùng **khoá chuỗi** theo đúng giá trị client gửi ở `POST /api/holds` — giữ `raw` (chưa ép số) để không lệch khoá. Không đổi `holds.ts`.

- [ ] **Step 5: Viết lại `server/src/auth/users.ts` (giữ NGUYÊN 4 chữ ký)**

```ts
import { prisma } from "../db/prisma";
import type { DbUser } from "../types";

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(
  id: number | string,
): Promise<DbUser | null> {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  return prisma.user.findUnique({ where: { id: n } });
}

export async function createUser(data: {
  fullName: string;
  email: string;
  password: string;
  role: string;
}): Promise<DbUser> {
  return prisma.user.create({ data });
}

export async function updateUserPassword(
  id: number,
  password: string,
): Promise<void> {
  await prisma.user.update({ where: { id }, data: { password } });
}
```

> Nếu `typecheck` báo `DbUser` không khớp kiểu `User` của Prisma, mở `server/src/types.ts` xem `DbUser` — nó phải là `{ id: number; fullName: string; email: string; password: string; role?: string }`. Prisma `User.role` là `string` (không optional) nên gán được vào `role?: string`. KHÔNG sửa `types.ts` trừ khi thật sự vênh.

- [ ] **Step 6: Sửa `server/src/env.ts` — bỏ `DATA_URL`, thêm guard DB**

Xoá dòng `export const DATA_URL = …` và thêm ngay dưới `PORT`:

```ts
export const DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) {
  throw new Error(
    "[server] Thiếu DATABASE_URL — đặt chuỗi kết nối Postgres trong .env (xem .env.example).",
  );
}
```

Kiểm không còn ai dùng:
```bash
grep -rn "DATA_URL" server/ src/ --include=*.ts --include=*.tsx
```
Expected: chỉ còn dòng `DATABASE_URL` vừa thêm (chuỗi `DATA_URL` là con của `DATABASE_URL` nên grep sẽ khớp — đọc kỹ, phải không còn `DATA_URL` đứng riêng).

- [ ] **Step 7: Restart server + smoke bằng curl (bằng chứng hợp đồng không đổi)**

Kill listener :4000 rồi chạy lại:
```bash
netstat -ano | grep ":4000" | head -1     # lay PID
taskkill //PID <PID> //F
npm run auth &                            # hoac chay o cua so rieng
```

Chạy loạt curl (dùng cookie jar để giữ phiên):
```bash
cd /tmp && rm -f c.txt
curl -s -o /dev/null -w "movies=%{http_code}\n" http://localhost:4000/api/movies
curl -s http://localhost:4000/api/movies/1 | head -c 120; echo
curl -s "http://localhost:4000/api/showtimes?movieId=1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d);console.log('showtimes movieId=1 ->',a.length,'ban ghi, id dau:',a[0]&&a[0].id)})"
curl -s -o /dev/null -w "movie-404=%{http_code}\n" http://localhost:4000/api/movies/9999
curl -s -o /dev/null -w "bookings-chua-dangnhap=%{http_code}\n" http://localhost:4000/api/bookings
curl -s -c c.txt -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" -d '{"email":"admin@cinema.vn","password":"admin123"}' | head -c 120; echo
curl -s -b c.txt http://localhost:4000/auth/me | head -c 120; echo
curl -s -b c.txt "http://localhost:4000/api/occupied-seats?showtimeId=1" ; echo
curl -s -b c.txt -o /dev/null -w "users-admin=%{http_code}\n" http://localhost:4000/api/users
curl -s -b c.txt http://localhost:4000/api/bookings | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('bookings(admin) ->',JSON.parse(d).length))"
curl -s -o /dev/null -w "login-sai=%{http_code}\n" -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" -d '{"email":"admin@cinema.vn","password":"sai"}'
```

Expected:
- `movies=200`; `/api/movies/1` trả object có `"id":1`
- `showtimes movieId=1 -> ` số bản ghi > 0, id đầu nhỏ nhất (thứ tự tăng dần)
- `movie-404=404` · `bookings-chua-dangnhap=401` · `users-admin=200` · `login-sai=401`
- `/auth/login` trả `{"id":2,"fullName":…,"role":"admin"}` (KHÔNG có `password`)
- `occupied-seats` trả `{"showtimeId":1,"seats":["A3","E5","E6", …]}` (gồm cả ghế từ booking id 1 nếu cùng suất)
- `bookings(admin) -> 3`

- [ ] **Step 8: Kiểm ghi — tạo/sửa/xoá 1 phim test qua API (admin)**

```bash
cd /tmp
curl -s -b c.txt -X POST http://localhost:4000/api/movies -H "Content-Type: application/json" -d '{"title":"ZZZ Test","poster":"x","description":"y","duration":90,"genre":"Test","rating":7}' -w "\nstatus=%{http_code}\n"
```
Expected: trả object có `id` mới (17 nếu DB vừa seed) + `status=201`.

```bash
curl -s -b c.txt -X PATCH http://localhost:4000/api/movies/17 -H "Content-Type: application/json" -d '{"title":"ZZZ Test 2"}' | head -c 120; echo
curl -s -b c.txt -X DELETE http://localhost:4000/api/movies/17 -w "\ndelete=%{http_code}\n"
curl -s -o /dev/null -w "sau-khi-xoa=%{http_code}\n" http://localhost:4000/api/movies/17
```
Expected: PATCH trả object `"title":"ZZZ Test 2"` (đủ mọi trường); `delete=200` với body `{}`; `sau-khi-xoa=404`.

> Dọn sạch: nếu id khác 17, thay đúng id vừa tạo. Kết thúc phải **không còn** phim test trong DB.

- [ ] **Step 9: Verify UI thật (người dùng review qua điện thoại)**

Mở lại web (`http://localhost:3000`) — nếu trắng trang thì kill :3000, `rm -rf node_modules/.vite`, `npm start`. Kiểm bằng mắt/screenshot: Home có phim, `/movies` lọc được, `/cinema/:id` có giờ chiếu, đăng nhập admin → `/admin/bookings` thấy 3 đơn.

- [ ] **Step 10: 6 cổng**

Run:
```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build
npm run e2e
```
Expected: PASS, 11 e2e xanh. Nếu e2e login fail hàng loạt → xem rate-limit: kill :4000 + `npm run auth` để reset bộ đếm (10 login SAI/IP/15').

- [ ] **Step 11: Commit + push + xác minh CI**

```bash
npm run format
git add server/src package.json
git status
git commit -m "feat(GD3c/4): FLIP data layer sang Prisma (gateway/occupied/users) — xoa forward.ts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```
Rồi kiểm CI như Task 3 Step 4. Expected: `completed | success` — **đây là lần đầu CI chạy app thật trên Postgres**.

---

## Task 5: Gỡ json-server khỏi dự án

**Files:**
- Modify: `package.json` (bỏ dep `json-server`, script `api`, script `hash-passwords`, sửa `dev`)
- Modify: `.claude/start-dev.ps1`
- Modify: `.env`, `.env.example`
- Modify: `eslint.config.mjs`
- Delete: `server/hash-passwords.js`

- [ ] **Step 1: `package.json`**

- Xoá dòng script `"api": "json-server --watch db.json --port 9999",`
- Xoá dòng script `"hash-passwords": "node server/hash-passwords.js",`
- Sửa `dev`:
```json
"dev": "concurrently -n auth,web -c magenta,cyan \"npm:auth\" \"npm:start\"",
```
- Xoá `"json-server": "^0.17.4"` khỏi `devDependencies`.

Rồi:
```bash
npm install
```
Expected: `package-lock.json` cập nhật, json-server bị gỡ khỏi `node_modules`.

- [ ] **Step 2: Xoá `server/hash-passwords.js`**

```bash
rm server/hash-passwords.js
```
Lý do: script này băm mật khẩu **qua json-server**; `db.json` giờ chỉ còn vai trò nguồn seed và đã lưu bcrypt hash sẵn. Đăng nhập vẫn tự nâng cấp plaintext → bcrypt (`auth/routes.ts:67-77`).

- [ ] **Step 3: `eslint.config.mjs` — bỏ block `server/**/*.js`**

Xoá nguyên khối config có `files: ["server/**/*.js"]` (không còn file .js nào trong `server/`). Giữ nguyên block `server/**/*.ts`.

- [ ] **Step 4: `.claude/start-dev.ps1` — không khởi động :9999**

Xoá khối:
```powershell
# JSON Server (port 9999) - serves db.json as the mock REST API
$jsonUp = Test-Port 9999
if (-not $jsonUp) {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$root`"; npx json-server --watch db.json --port 9999" -WindowStyle Minimized
}
```
và 2 dòng in trạng thái JSON Server:
```powershell
if ($jsonUp) { Write-Output '  JSON Server: http://localhost:9999  (already running)' }
else         { Write-Output '  JSON Server: http://localhost:9999  (starting, wait ~5s)' }
```
Đổi dòng comment của Auth server thành: `# Auth + API server (port 4000) - Express TS (tsx) + Prisma/Postgres`.

- [ ] **Step 5: `.env` và `.env.example` — bỏ `DATA_URL`**

Trong cả hai file, xoá dòng `DATA_URL=http://localhost:9999` (và dòng comment kèm theo nếu có). `.env.example` giữ placeholder `DATABASE_URL`/`DIRECT_URL` như cũ.

- [ ] **Step 6: Quét sạch mọi tham chiếu còn sót**

```bash
grep -rn "json-server\|9999\|DATA_URL" --include=*.ts --include=*.tsx --include=*.mjs --include=*.json --include=*.ps1 --include=*.yml . | grep -v node_modules | grep -v package-lock.json
```
Expected: **0 dòng** (ngoài `docs/` và `CLAUDE.md`/`README.md` — tài liệu viết lại ở lát 3f).

- [ ] **Step 7: Khởi động lại toàn bộ môi trường dev sạch**

```bash
# kill :9999, :4000, :3000 neu con
netstat -ano | grep -E ":(9999|4000|3000)"
# taskkill //PID <PID> //F cho tung PID
npm run dev
```
Expected: chỉ còn **2** tiến trình (auth + web); log không nhắc json-server; mở `http://localhost:3000` chạy bình thường.

- [ ] **Step 8: 6 cổng**

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build
npm run e2e
```
Expected: PASS. `npm run e2e` giờ khởi động webServer bằng `npm run dev` (2 server) — vẫn 11 smoke xanh.

- [ ] **Step 9: Commit + push + xác minh CI**

```bash
npm run format
git add package.json package-lock.json eslint.config.mjs .claude/start-dev.ps1 .env.example
git rm server/hash-passwords.js
git status   # .env KHONG duoc stage
git commit -m "chore(GD3c/5): go json-server (dep/script/hook/env) — app chay hoan toan tren Postgres

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```
Kiểm CI như Task 3 Step 4. Expected: `completed | success`.

---

## Self-Review (đã rà)

**1. Spec coverage (spec §6 dòng 3c ↔ task):**
- "Swap data layer json-server → Prisma trong các service (auth + catalog + bookings + holds/occupied)" → Task 4 (auth `users.ts`, catalog+bookings qua `repo.ts`, `occupied.ts`). `holds` là in-memory, spec §3.4 giữ nguyên → không đụng, đã ghi rõ. ✅
- "Gỡ json-server, sửa `dev` script + hook + `.env`" (spec §5.1, §5.2) → Task 5. ✅
- "App chạy đầy đủ trên Neon dev; smoke xanh; 0 tham chiếu json-server" → Task 4 Step 7-10, Task 5 Step 6-8. ✅
- Spec §7 "fidelity hợp đồng API — rà `src/services/*.ts` liệt kê mọi endpoint trước khi viết route" → mục "Hợp đồng phải giữ" ở đầu plan (đã rà xong). ✅
- Spec §7 "mảng/Json round-trip" → Task 4 Step 7 (`occupied-seats` trả `bookedSeats`) + Step 8 (POST/PATCH movie) + e2e đặt vé ở 3e. ✅
- **Ngoài spec, phát sinh khi rà code (bổ sung có chủ ý):** Task 1 (4 cột Booking thiếu — không có thì `POST /api/bookings` ném lỗi Prisma) và Task 3 (Postgres cho CI — nếu để tới 3e thì CI đỏ ngay tại commit flip). Cả hai là *điều kiện cần* để giữ kỷ luật "mọi commit 6 cổng xanh".

**2. Placeholder scan:** không có TBD/TODO; mọi step có lệnh + kỳ vọng cụ thể; mọi file mới có mã đầy đủ. ✅

**3. Type consistency:** `handleRest(req,res,rest,extraFilters?)` (Task 4) khớp cách gọi trong `gateway.ts`; `parseFilters`/`pickWritable`/`isCollection`/`COLLECTIONS` (Task 2) khớp chỗ dùng ở `repo.ts`; `COLLECTIONS[c].json` dùng ở `normalizeJson`; 4 chữ ký `users.ts` giữ y nguyên bản cũ nên `auth/routes.ts` không phải sửa; `prisma` export từ `db/prisma.ts` dùng ở `repo.ts`/`occupied.ts`/`users.ts`. ✅

**Điểm cần chú ý khi thực thi:**
- **Thứ tự Task 3 trước Task 4 là bắt buộc** (CI phải có DB trước khi app cần DB).
- Sau MỌI thay đổi `server/**` phải restart :4000 tay — không có watch.
- `heldByOthers` dùng khoá **chuỗi** showtimeId; giữ nguyên `raw`, đừng truyền số vào.
- `prisma.user.findUnique({where:{email}})` chỉ chạy được vì `email` có `@unique` trong schema — có sẵn từ 3a.
- Nếu `test:run` bỗng cần DB → nghĩa là đã lỡ import `db/prisma.ts` vào file test; metadata phải nằm ở `collections.ts` (không import Prisma).
