# GĐ3a — Prisma + schema + seed + Neon dev — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng nền dữ liệu thật — thêm Prisma, viết `schema.prisma` ánh xạ toàn bộ `db.json`, tạo migration + seed nạp dữ liệu vào **Neon Postgres (nhánh dev)** — mà **runtime app CHƯA đổi** (json-server vẫn phục vụ `/api`).

**Architecture:** Lát additive/không phá vỡ. Ta chỉ thêm Prisma cạnh hệ hiện tại. `db.json` đổi vai trò thành **dữ liệu seed** (chưa gỡ — json-server còn đọc nó tới lát 3c). Không endpoint nào đổi, không service client nào đổi. Verify bằng seed tự-đếm-dòng khớp `db.json`, không thêm test phụ thuộc DB vào cổng CI.

**Tech Stack:** Prisma 6 + `@prisma/client`, PostgreSQL (Neon serverless), `tsx` để chạy seed TypeScript.

## Global Constraints

- **Node 22** (`v22.11.0` local; CI node 22).
- **Giữ 6 cổng CI xanh, lint 0 warning**: `typecheck` · `lint` · `format:check` · `test:run` · `e2e` · `build`. Một warning = fail CI.
- **TypeScript ~5.7** (đã ghim); strict.
- **HỢP ĐỒNG HTTP BẤT BIẾN:** lát này KHÔNG đụng endpoint/service — nhưng schema phải chuẩn bị để lát sau trả đúng shape. `id` **kiểu Int** (khớp id số client dùng). **Giữ NGUYÊN id** từ `db.json` khi seed (FK + link client dựa vào).
- **`time` và `createdAt` lưu dạng `String`** (ISO) — KHÔNG dùng `DateTime` (Prisma serialize DateTime khác định dạng json-server → rủi ro vỡ client). Đây là quyết định fidelity.
- **Bí mật KHÔNG commit:** `DATABASE_URL`/`DIRECT_URL` chỉ trong `.env` (đã gitignored) + env Render. `.env.example` chỉ placeholder.
- **Copy tiếng Việt** cho log/thông báo người-đọc nếu có.
- **Không gỡ json-server / DATA_URL trong lát này** (để 3c).

## File Structure

- `server/prisma/schema.prisma` — **create**: generator + datasource (postgresql, `url`+`directUrl`) + 8 model (User/City/Cinema/Room/Movie/Showtime/Booking/Concession).
- `server/prisma/seed.ts` — **create**: đọc `db.json`, xoá sạch (reverse FK) rồi insert (đúng thứ tự FK, giữ id), reset sequence Postgres, tự-đếm khớp kỳ vọng.
- `server/prisma/migrations/**` — **create** (do `prisma migrate dev` sinh; commit).
- `server/tsconfig.json` — **create**: typecheck riêng cho code server TS (mới có `seed.ts`).
- `package.json` — **modify**: thêm deps + scripts Prisma + `postinstall` + block `prisma.seed` + mở rộng `typecheck`.
- `eslint.config.mjs` — **modify**: thêm block lint `server/**/*.ts`.
- `.env.example` — **modify**: thêm `DATABASE_URL`/`DIRECT_URL` (placeholder); GIỮ `DATA_URL`.
- `.gitignore` — **modify** (nếu cần): đảm bảo `.env` đã bị bỏ (đã có), không thêm gì trừ khi thiếu.

---

## PREREQUISITE (chặn Task 2 — người dùng thực hiện, có hướng dẫn)

Task 1 chạy được **không cần DB**. Task 2 cần Neon. Hướng dẫn tạo Neon (miễn phí):

1. Vào https://neon.tech → đăng ký (GitHub/Google) → **Create project** (tên vd `cinema-full`, region gần VN vd Singapore).
2. Project mặc định có 1 nhánh `production`/`main`. **Create branch** tên `dev` (Branches → New branch từ main).
3. Ở nhánh **dev**, mở **Connection Details**, lấy 2 chuỗi:
   - **Pooled connection** (có `-pooler` trong host) → dùng cho `DATABASE_URL`.
   - **Direct connection** (không `-pooler`) → dùng cho `DIRECT_URL`.
   - Cả hai có sẵn `?sslmode=require`.
4. Dán vào `.env` (tạo từ `.env.example` nếu chưa có), ví dụ:
   ```
   DATABASE_URL="postgresql://<user>:<pass>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require"
   DIRECT_URL="postgresql://<user>:<pass>@<host>.<region>.aws.neon.tech/<db>?sslmode=require"
   ```
5. Báo lại để chạy `migrate dev` + `seed`.

> **Lưu ý Neon + `migrate dev`:** Prisma cần "shadow database" tạm khi tạo migration. Với `DIRECT_URL` (unpooled) role Neon thường tự tạo được shadow DB → chạy thẳng. Nếu báo lỗi shadow database, tạo thêm 1 nhánh Neon `shadow` và thêm `shadowDatabaseUrl = env("SHADOW_DATABASE_URL")` vào datasource + `SHADOW_DATABASE_URL` (direct của nhánh shadow) vào `.env`.

---

## Task 1: Prisma scaffolding + full schema

Thêm Prisma và viết toàn bộ schema. Deliverable độc lập: `prisma validate` + `prisma generate` chạy sạch (không cần DB). Reviewer duyệt được riêng phần mô hình dữ liệu.

**Files:**
- Create: `server/prisma/schema.prisma`
- Modify: `package.json` (deps, scripts, `postinstall`, `prisma.seed`)
- Modify: `.env.example`

**Interfaces:**
- Produces: model Prisma `User, City, Cinema, Room, Movie, Showtime, Booking, Concession` với đúng trường/kiểu dưới đây (Task 2 seed dựa vào tên trường này). Client Prisma sinh tại `@prisma/client`.

- [ ] **Step 1: Cài dependencies**

```bash
npm install @prisma/client
npm install -D prisma tsx
```
Kỳ vọng: `package.json` có `@prisma/client` (dependencies) + `prisma`, `tsx` (devDependencies). Prisma 6.x.

- [ ] **Step 2: Tạo `server/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id       Int    @id @default(autoincrement())
  fullName String
  email    String @unique
  password String
  role     String @default("user")
}

model City {
  id      Int      @id @default(autoincrement())
  name    String
  cinemas Cinema[]
}

model Cinema {
  id      Int    @id @default(autoincrement())
  name    String
  address String
  cityId  Int
  city    City   @relation(fields: [cityId], references: [id])
  rooms   Room[]
}

model Room {
  id             Int        @id @default(autoincrement())
  name           String
  type           String
  rows           Int
  cols           Int
  vipRows        String[]
  coupleRows     String[]
  aisleAfterCols Int[]
  cinemaId       Int
  cinema         Cinema     @relation(fields: [cinemaId], references: [id])
  showtimes      Showtime[]
}

model Movie {
  id          Int        @id @default(autoincrement())
  title       String
  poster      String
  description String
  duration    Int
  genre       String
  rating      Float
  showtimes   Showtime[]
}

model Showtime {
  id          Int      @id @default(autoincrement())
  time        String
  price       Int
  bookedSeats String[]
  movieId     Int
  movie       Movie    @relation(fields: [movieId], references: [id])
  roomId      Int
  room        Room     @relation(fields: [roomId], references: [id])
}

model Booking {
  id          Int      @id @default(autoincrement())
  movieId     Int
  showtimeId  Int
  cinemaId    Int
  roomId      Int
  seats       String[]
  seatTypes   Json
  concessions Json?
  userId      Int
  userName    String
  totalPrice  Int
  createdAt   String
}

model Concession {
  id          Int    @id @default(autoincrement())
  name        String
  category    String
  price       Int
  description String
  image       String
}
```

Ghi chú thiết kế (đã cân nhắc):
- **Booking KHÔNG có quan hệ FK** — giữ dạng "snapshot" phi ràng buộc như json-server (admin xoá movie/room/showtime sẽ không vỡ vì FK; scoping "vé của tôi" chỉ cần `where userId`). `movieId/cinemaId/roomId/userName` là scalar denormalized đúng như seed.
- **Quan hệ FK chỉ trong chuỗi catalog** City→Cinema→Room→Showtime→Movie (integrity thật; seed insert đúng thứ tự).
- `vipRows/coupleRows` là **chữ hàng** (`String[]`), `aisleAfterCols` là **số** (`Int[]`). Phòng thiếu couple/aisle → seed truyền `[]`.
- `concessions Json?` (nullable) vì booking seed cũ không có trường này; app POST có.

- [ ] **Step 3: Thêm scripts + postinstall + prisma.seed vào `package.json`**

Thêm vào khối `"scripts"`:
```json
"postinstall": "prisma generate",
"prisma:generate": "prisma generate",
"prisma:migrate": "prisma migrate dev",
"prisma:deploy": "prisma migrate deploy",
"prisma:seed": "prisma db seed",
"prisma:studio": "prisma studio"
```
Sửa `typecheck` để phủ cả server TS:
```json
"typecheck": "tsc --noEmit && tsc -p server/tsconfig.json"
```
Thêm khối top-level (ngang hàng `scripts`) để `prisma db seed` biết chạy gì — Prisma đọc `schema.prisma` mặc định ở `prisma/`, nên trỏ rõ đường dẫn qua flag trong từng script không tiện; thay vào đó thêm:
```json
"prisma": {
  "seed": "tsx server/prisma/seed.ts",
  "schema": "server/prisma/schema.prisma"
}
```

> **Lưu ý:** vì schema nằm ở `server/prisma/` (không phải `prisma/` gốc), mọi lệnh CLI cần `--schema server/prisma/schema.prisma`. Đặt trong scripts như trên. Với `prisma generate` ở `postinstall`, thêm flag: `"postinstall": "prisma generate --schema server/prisma/schema.prisma"` và tương tự các script khác:
```json
"postinstall": "prisma generate --schema server/prisma/schema.prisma",
"prisma:generate": "prisma generate --schema server/prisma/schema.prisma",
"prisma:migrate": "prisma migrate dev --schema server/prisma/schema.prisma",
"prisma:deploy": "prisma migrate deploy --schema server/prisma/schema.prisma",
"prisma:seed": "prisma db seed",
"prisma:studio": "prisma studio --schema server/prisma/schema.prisma"
```
(`prisma db seed` không nhận `--schema`; nó dùng `prisma.schema` trong package.json ở trên.)

- [ ] **Step 4: Cập nhật `.env.example`** (thêm 2 dòng, GIỮ phần cũ gồm `DATA_URL`)

Thêm khối:
```
# === Database (Prisma → Neon Postgres) ===
# Pooled connection (host có "-pooler"). Runtime dùng cái này.
DATABASE_URL="postgresql://user:password@host-pooler.region.aws.neon.tech/dbname?sslmode=require"
# Direct connection (không "-pooler"). Dùng cho migrate/shadow DB.
DIRECT_URL="postgresql://user:password@host.region.aws.neon.tech/dbname?sslmode=require"
```

- [ ] **Step 5: Validate + generate (không cần DB)**

Run:
```bash
npx prisma validate --schema server/prisma/schema.prisma
npx prisma generate --schema server/prisma/schema.prisma
```
Expected: `validate` in "The schema at server/prisma/schema.prisma is valid 🚀"; `generate` in "Generated Prisma Client".

- [ ] **Step 6: Kiểm 5 cổng không-DB còn xanh**

Run:
```bash
npm run typecheck   # LƯU Ý: sẽ fail vì server/tsconfig.json chưa có — xem chú thích
npm run lint
npm run format:check
npm run test:run
npm run build
```
Expected: `lint`/`format:check`/`test:run`/`build` PASS. **`typecheck` sẽ lỗi** vì `server/tsconfig.json` chưa tồn tại (tạo ở Task 2). Do đó **ở Task 1, tạm chưa sửa `typecheck`** — hoãn thay đổi dòng `typecheck` (Step 3) sang Task 2, và Task 1 chỉ thêm các script prisma + postinstall + prisma.seed. Xác nhận: Task 1 commit với `typecheck` **nguyên bản cũ** (`tsc --noEmit`), 6 cổng xanh.

> **Sửa thứ tự (chốt):** Ở Task 1 KHÔNG đổi dòng `"typecheck"`. Việc mở rộng `typecheck` sang server dời sang Task 2 (cùng lúc tạo `server/tsconfig.json`). Step 3 của Task 1 chỉ thêm: `postinstall`, `prisma:*`, block `prisma`.

- [ ] **Step 7: Format lại + commit**

```bash
npm run format
git add server/prisma/schema.prisma package.json package-lock.json .env.example
git commit -m "feat(GD3a/1): them Prisma + schema.prisma anh xa toan bo db.json

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: commit tạo. `format:check` phải sạch trước commit (schema.prisma prettier bỏ qua vì không có parser — OK).

---

## Task 2: Seed script + migrate lên Neon dev + verify + wiring typecheck/lint

Tạo bảng trên Neon (migration đầu), viết seed nạp `db.json` giữ nguyên id + reset sequence + tự-đếm khớp, và đưa server TS vào cổng `typecheck`/`lint`. Deliverable: `npm run prisma:seed` in bảng đếm khớp kỳ vọng; 6 cổng xanh.

**Cần PREREQUISITE (Neon URL) đã xong.**

**Files:**
- Create: `server/tsconfig.json`
- Create: `server/prisma/seed.ts`
- Create: `server/prisma/migrations/**` (sinh bởi CLI)
- Modify: `eslint.config.mjs` (block `server/**/*.ts`)
- Modify: `package.json` (mở rộng `typecheck`)

**Interfaces:**
- Consumes: model Prisma từ Task 1 (`prisma.movie.create({ data })`, …) + `db.json` ở gốc repo.
- Produces: hàm seed idempotent (chạy lại được). Không export gì cho lát sau (chạy qua `prisma db seed`).

- [ ] **Step 1: Tạo `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["prisma/**/*.ts", "src/**/*.ts"]
}
```
(`resolveJsonModule` để `seed.ts` import `db.json`; `noEmit` để dùng làm typecheck.)

- [ ] **Step 2: Mở rộng `typecheck` trong `package.json`**

Sửa:
```json
"typecheck": "tsc --noEmit && tsc -p server/tsconfig.json"
```

- [ ] **Step 3: Thêm block ESLint cho server TS** (`eslint.config.mjs`)

Thay block `server/**/*.js` hiện có bằng cách **thêm** một block cho `.ts` (giữ nguyên block `.js` vì auth-server.js còn tồn tại tới 3b):
```js
  // Server TypeScript (Prisma seed + code server o lat sau) — non-type-aware
  {
    files: ["server/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
```
Đặt block này ngay sau block `server/**/*.js`.

- [ ] **Step 4: Viết `server/prisma/seed.ts`**

```ts
import { PrismaClient } from "@prisma/client";
import db from "../../db.json";

const prisma = new PrismaClient();

// Bảng theo thứ tự FK (cha trước con). Reset sequence sau khi insert id thủ công.
const TABLES = [
  "City",
  "Movie",
  "User",
  "Concession",
  "Cinema",
  "Room",
  "Showtime",
  "Booking",
] as const;

async function clearAll() {
  // Xoá ngược thứ tự FK để không vướng ràng buộc.
  for (const t of [...TABLES].reverse()) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${t}";`);
  }
}

async function resetSequences() {
  for (const t of TABLES) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1), (SELECT COUNT(*) > 0 FROM "${t}"));`,
    );
  }
}

async function seed() {
  await clearAll();

  await prisma.city.createMany({ data: db.cities });

  await prisma.movie.createMany({ data: db.movies });

  await prisma.user.createMany({
    data: db.users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      password: u.password,
      role: (u as { role?: string }).role ?? "user",
    })),
  });

  await prisma.concession.createMany({ data: db.concessions });

  await prisma.cinema.createMany({ data: db.cinemas });

  await prisma.room.createMany({
    data: db.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      rows: r.rows,
      cols: r.cols,
      vipRows: r.vipRows ?? [],
      coupleRows: (r as { coupleRows?: string[] }).coupleRows ?? [],
      aisleAfterCols: (r as { aisleAfterCols?: number[] }).aisleAfterCols ?? [],
      cinemaId: r.cinemaId,
    })),
  });

  await prisma.showtime.createMany({ data: db.showtimes });

  await prisma.booking.createMany({
    data: db.bookings.map((b) => ({
      id: b.id,
      movieId: b.movieId,
      showtimeId: b.showtimeId,
      cinemaId: b.cinemaId,
      roomId: b.roomId,
      seats: b.seats,
      seatTypes: b.seatTypes,
      concessions: (b as { concessions?: unknown }).concessions ?? undefined,
      userId: b.userId,
      userName: b.userName,
      totalPrice: b.totalPrice,
      createdAt: b.createdAt,
    })),
  });

  await resetSequences();
}

// Kỳ vọng khớp db.json — dùng làm "kiểm thử" của lát 3a.
const EXPECTED = {
  City: db.cities.length,
  Movie: db.movies.length,
  User: db.users.length,
  Concession: db.concessions.length,
  Cinema: db.cinemas.length,
  Room: db.rooms.length,
  Showtime: db.showtimes.length,
  Booking: db.bookings.length,
};

async function verify() {
  const counts = {
    City: await prisma.city.count(),
    Movie: await prisma.movie.count(),
    User: await prisma.user.count(),
    Concession: await prisma.concession.count(),
    Cinema: await prisma.cinema.count(),
    Room: await prisma.room.count(),
    Showtime: await prisma.showtime.count(),
    Booking: await prisma.booking.count(),
  };
  console.table(counts);
  const mismatch = Object.entries(EXPECTED).filter(
    ([k, v]) => counts[k as keyof typeof counts] !== v,
  );
  if (mismatch.length) {
    throw new Error(
      `Seed đếm KHÔNG khớp db.json: ${mismatch
        .map(([k, v]) => `${k}: có ${counts[k as keyof typeof counts]}, cần ${v}`)
        .join("; ")}`,
    );
  }
  console.log("✅ Seed khớp db.json (id giữ nguyên, sequence đã reset).");
}

seed()
  .then(verify)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 5: Tạo migration đầu tiên trên Neon dev**

Run (sau khi PREREQUISITE xong, `.env` có `DATABASE_URL`+`DIRECT_URL`):
```bash
npm run prisma:migrate -- --name init
```
Expected: Prisma tạo `server/prisma/migrations/<timestamp>_init/migration.sql`, áp lên Neon dev, in "Your database is now in sync with your schema." Nếu lỗi shadow DB → xem chú thích PREREQUISITE (thêm `SHADOW_DATABASE_URL`).

- [ ] **Step 6: Chạy seed — đây là bước "test" của lát**

Run:
```bash
npm run prisma:seed
```
Expected: `console.table` in 8 dòng số, rồi "✅ Seed khớp db.json…". Số kỳ vọng: City 3, Movie 16, User 4, Concession 8, Cinema 5, Room 10, Showtime 52, Booking 3. Nếu ném lỗi "KHÔNG khớp" → sửa seed rồi chạy lại (idempotent — tự xoá trước).

- [ ] **Step 7: Verify round-trip mảng/Json** (kiểm nhanh dữ liệu phức không vỡ)

Run:
```bash
npx prisma studio --schema server/prisma/schema.prisma
```
Hoặc script kiểm 1 dòng:
```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.room.findUnique({where:{id:1}}).then(r=>{console.log(r.vipRows,r.coupleRows,r.aisleAfterCols);return p.showtime.findUnique({where:{id:1}})}).then(s=>{console.log(s.bookedSeats,s.time);return p.booking.findUnique({where:{id:1}})}).then(b=>{console.log(b.seatTypes,b.createdAt)}).finally(()=>p.\$disconnect())"
```
Expected: Room 1 → `[ 'E', 'F' ] [ 'H' ] [ 6 ]`; Showtime 1 → `[ 'A3', 'E5', 'E6' ] 2026-07-15T18:00:00`; Booking 1 → `{ standard: 1, vip: 0 } 2026-07-10T10:00:00`. Xác nhận `String[]`/`Int[]`/`Json`/`String time` round-trip đúng.

- [ ] **Step 8: 6 cổng CI xanh**

Run:
```bash
npm run typecheck   # gio bao gom server/tsconfig.json (seed.ts)
npm run lint        # 0 warning
npm run format:check
npm run test:run
npm run build
npm run e2e         # json-server van chay (chua go) -> smoke cu van xanh
```
Expected: tất cả PASS. Nếu `typecheck` báo lỗi type trong seed (vd `createMany` với id) → sửa map cho khớp kiểu Prisma generated. Nếu `lint` cảnh báo → xử lý (0 warning).

- [ ] **Step 9: Format + commit** (KHÔNG commit `.env`)

```bash
npm run format
git add server/prisma/seed.ts server/prisma/migrations server/tsconfig.json eslint.config.mjs package.json
git status   # xac nhan .env KHONG nam trong danh sach staged
git commit -m "feat(GD3a/2): seed db.json -> Neon dev (giu id, reset sequence) + wiring typecheck/lint server TS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 10: Verify CI xanh trên GitHub**

```bash
git push origin main
```
Sau ~2-3', kiểm run mới nhất qua API (không có `gh` CLI):
`https://api.github.com/repos/khanhnguyen1205/cinema-full/actions/runs`
Expected: run "GD3a/2" `conclusion: success`. **Lưu ý:** CI job `checks` chạy `npm ci` → `postinstall` `prisma generate` (chỉ đọc schema, KHÔNG cần DB) → `typecheck` (gồm seed.ts) phải xanh. `e2e` job vẫn dùng `npm run dev` (json-server còn) → smoke cũ xanh. **CI KHÔNG cần DATABASE_URL** trong lát này (không có bước migrate/seed trong CI — dời sang 3e).

---

## Self-Review (đã rà)

**1. Spec coverage (mục spec ↔ task):**
- Spec §3.2 mô hình Prisma → Task 1 Step 2 (đủ 8 model, kiểu khớp db.json). ✅
- Spec §3.3 seed đọc db.json, thứ tự FK, giữ id → Task 2 Step 4 (+ reset sequence, rủi ro §7 "giữ id"). ✅
- Spec §5.2 env `DATABASE_URL` → Task 1 Step 4 (`.env.example`); PREREQUISITE (user cấp `.env`). ✅
- Spec §5.1 scripts Prisma → Task 1 Step 3. ✅ (Gỡ json-server/DATA_URL để 3c — Global Constraints ghi rõ KHÔNG làm ở đây.)
- Spec §7 rủi ro mảng/Json round-trip → Task 2 Step 7. ✅
- Spec §7 "typecheck phủ server" → Task 2 Step 1-2. (CI mở rộng để 3e; ở 3a typecheck local + CI qua `npm run typecheck` đã tự phủ.) ✅

**2. Placeholder scan:** không có TBD/TODO; mọi step có lệnh + kỳ vọng cụ thể, seed.ts đầy đủ mã. ✅

**3. Type consistency:** tên model/trường ở seed (`prisma.city/movie/user/concession/cinema/room/showtime/booking`, trường `vipRows/coupleRows/aisleAfterCols/bookedSeats/seatTypes/concessions/createdAt`) khớp schema Task 1. `EXPECTED`/`counts` cùng bộ khoá 8 bảng. ✅

**Điểm cần chú ý khi thực thi:**
- Task 1 Step 3 đã **chốt sửa**: KHÔNG đổi `typecheck` ở Task 1 (dời sang Task 2 cùng `server/tsconfig.json`) để tránh cổng đỏ giữa 2 task.
- `prisma db seed` không nhận `--schema` → phải khai `prisma.schema` trong package.json (Task 1 Step 3).
- `createMany` có thể cần `skipDuplicates`? Không — đã `clearAll()` trước nên bảng rỗng.
- Nếu Neon báo lỗi shadow DB ở `migrate dev` → thêm `shadowDatabaseUrl` + nhánh shadow (ghi trong PREREQUISITE).
