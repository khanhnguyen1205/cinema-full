# Tự làm mới cửa sổ lịch chiếu — kế hoạch thực thi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server Express tự dịch `Showtime.time` về quanh hôm nay khi cửa sổ lịch chiếu sắp trôi hết vào quá khứ, không xoá dữ liệu người dùng.

**Architecture:** Một hàm thuần `planShift()` quyết định *có dịch không và dịch bao nhiêu ngày*; một module `refresh.ts` chạm Prisma đọc–ghi; `index.ts` gọi lúc khởi động và lặp mỗi 6 giờ. Phép tính ngày (`date-shift.ts`) chuyển từ `server/prisma/` vào `server/src/schedule/` để cả seed lẫn server dùng chung một nguồn.

**Tech Stack:** TypeScript · Express 5 · Prisma 6.19.3 / PostgreSQL · Vitest 3 (project `server`, môi trường node)

Spec: `docs/superpowers/specs/2026-08-02-showtime-window-refresh-design.md`

## Global Constraints

- **Không thêm cổng CI** — vẫn đúng sáu cổng: `typecheck` · `lint` (0 warning) · `format:check` · `test:cov` · `e2e` · `build` (+ job `docker`).
- **`server/tsconfig.build.json` đặt `rootDir: "src"`** ⇒ mã trong `server/src/` **không được** import bất cứ thứ gì ngoài `server/src/`. Chiều ngược lại thì được: `server/prisma/seed.ts` chạy bằng `tsx`, không nằm trong bản build.
- **File server có unit test thì KHÔNG được import `server/src/env.ts`** — `env.ts` throw khi thiếu `DATABASE_URL`, mà job CI `checks` không có database.
- **Chỉ được ghi cột `Showtime.time`.** `Booking.createdAt` và `Review.createdAt` là thời điểm có thật của người thật — không đụng.
- **Mốc thời gian trong DB là chuỗi `YYYY-MM-DDTHH:mm:ss` không mang múi giờ**, hiểu theo giờ địa phương. "Hôm nay" phải lấy theo giờ địa phương (`getFullYear/getMonth/getDate`), **không** dùng `toISOString()` — ở VN (UTC+7) sẽ lệch một ngày trước 07:00 sáng.
- **Prettier**: mọi file `.ts` mới phải sạch `npm run format:check` (printWidth 80, double-quote, trailing comma all).
- **Bình luận và log bằng tiếng Việt**, đúng nếp các file server hiện có.
- Server chạy bằng `tsx` **không watch** ⇒ sửa `server/**` phải **khởi động lại tay** (kill listener :4000 rồi `npm run auth`).
- Trên Windows, server đang chạy **khoá file Prisma client** ⇒ kill :4000 trước khi `npm install`/`prisma generate`.

---

### Task 1: Chuyển `date-shift` vào `server/src/schedule/`

Thuần cơ học, không đổi hành vi. Làm riêng một task để lần commit sau chỉ còn logic mới.

**Files:**

- Move: `server/prisma/date-shift.ts` → `server/src/schedule/date-shift.ts`
- Move: `server/prisma/date-shift.test.ts` → `server/src/schedule/date-shift.test.ts`
- Modify: `server/prisma/seed.ts:3` (đường dẫn import)

**Interfaces:**

- Consumes: không có (task đầu).
- Produces: `server/src/schedule/date-shift.ts` xuất `PAST_DAYS: number`, `dayOf(iso: string): string`, `addDays(iso: string, days: number): string`, `offsetDaysFor(earliestDay: string, today: string): number` — y nguyên chữ ký cũ.

- [ ] **Step 1: Di chuyển hai file bằng `git mv` (giữ lịch sử)**

```bash
mkdir -p server/src/schedule
git mv server/prisma/date-shift.ts server/src/schedule/date-shift.ts
git mv server/prisma/date-shift.test.ts server/src/schedule/date-shift.test.ts
```

- [ ] **Step 2: Sửa import trong `seed.ts`**

Ở `server/prisma/seed.ts` dòng 3, đổi:

```ts
import { addDays, dayOf, offsetDaysFor } from "./date-shift";
```

thành:

```ts
import { addDays, dayOf, offsetDaysFor } from "../src/schedule/date-shift";
```

- [ ] **Step 3: Chạy test đã chuyển — phải xanh y như cũ**

Run: `npx vitest run server/src/schedule/date-shift.test.ts`
Expected: PASS, 9 test (`dayOf` 1 · `addDays` 5 · `offsetDaysFor` 3)

- [ ] **Step 4: Typecheck cả hai tsconfig**

Run: `npm run typecheck`
Expected: exit 0, không lỗi. (Đây là phép kiểm quan trọng nhất của task: nếu để `date-shift.ts` ở `server/prisma/` mà import từ `server/src/`, `tsc -p server/tsconfig.build.json` sẽ báo TS6059 "not under rootDir".)

- [ ] **Step 5: Chạy seed thật trên DB dev — chứng minh đường dẫn mới chạy được lúc runtime, không chỉ lúc typecheck**

Run: `npm run prisma:seed`
Expected: bảng đếm `City 3 · Movie 16 · User 4 · Concession 8 · Cinema 5 · Room 10 · Showtime 52 · Booking 3 · Review 9` + dòng `📅 Đã dịch mốc thời gian ... ✅ Seed khớp db.json`

- [ ] **Step 6: Commit**

```bash
git add server/src/schedule/date-shift.ts server/src/schedule/date-shift.test.ts server/prisma/seed.ts
git commit -m "refactor(server): chuyen date-shift vao src/schedule de server dung chung voi seed"
```

---

### Task 2: `planShift()` — luật quyết định (thuần, TDD)

**Files:**

- Modify: `server/src/schedule/date-shift.ts` (thêm `AHEAD_DAYS_MIN`, `dayDiff` nội bộ, `planShift`)
- Test: `server/src/schedule/date-shift.test.ts` (thêm khối `describe("planShift")`)

**Interfaces:**

- Consumes: `dayOf`, `offsetDaysFor`, `PAST_DAYS` từ chính file này (Task 1).
- Produces: `AHEAD_DAYS_MIN: number` (= 2) và `planShift(times: string[], today: string): number | null` — trả **số ngày cần dịch**, hoặc **`null` nghĩa là đang khoẻ / không quyết được, đừng đụng vào**. Task 3 gọi đúng hàm này.

- [ ] **Step 1: Viết test đỏ**

Thêm vào cuối `server/src/schedule/date-shift.test.ts`, và sửa dòng import đầu file thành:

```ts
import {
  addDays,
  AHEAD_DAYS_MIN,
  dayOf,
  offsetDaysFor,
  PAST_DAYS,
  planShift,
} from "./date-shift";
```

```ts
describe("planShift", () => {
  // Cửa sổ khoẻ mà seed tạo ra: [hôm nay-2, hôm nay+4].
  const healthy = (today: string): string[] =>
    [-2, -1, 0, 1, 2, 3, 4].map((d) => addDays(`${today}T18:00:00`, d));

  it("không có suất nào thì đứng im (DB chưa seed, không phải việc của nó)", () => {
    expect(planShift([], "2026-08-02")).toBeNull();
  });

  it("cửa sổ vừa seed xong thì không đụng vào", () => {
    expect(planShift(healthy("2026-08-02"), "2026-08-02")).toBeNull();
  });

  it("biên: còn đúng 2 ngày phía trước thì vẫn chưa dịch", () => {
    const times = ["2026-08-01T10:00:00", "2026-08-04T21:00:00"];
    expect(planShift(times, "2026-08-02")).toBeNull();
  });

  it("còn 1 ngày phía trước thì dịch", () => {
    // Cửa sổ đã trôi: sớm nhất 28/07, muộn nhất 03/08, hôm nay 02/08.
    const times = ["2026-07-28T10:00:00", "2026-08-03T21:00:00"];
    expect(planShift(times, "2026-08-02")).toBe(3);
  });

  it("dịch xong thì ngày sớm nhất đúng bằng hôm nay trừ PAST_DAYS", () => {
    const times = ["2026-07-20T10:00:00", "2026-07-26T21:00:00"];
    const off = planShift(times, "2026-08-02");
    expect(off).not.toBeNull();
    // hôm nay 02/08, PAST_DAYS = 2 ⇒ sớm nhất phải thành 31/07.
    expect(PAST_DAYS).toBe(2);
    expect(dayOf(addDays(times[0], off as number))).toBe("2026-07-31");
  });

  it("giữ nguyên khoảng cách giữa các suất và giờ chiếu trong ngày", () => {
    const times = ["2026-07-20T10:00:00", "2026-07-26T21:00:00"];
    const off = planShift(times, "2026-08-02") as number;
    const a = addDays(times[0], off);
    const b = addDays(times[1], off);
    expect(offsetDaysFor(dayOf(a), dayOf(b)) + PAST_DAYS).toBe(6);
    expect(a.endsWith("T10:00:00")).toBe(true);
    expect(b.endsWith("T21:00:00")).toBe(true);
  });

  it("dịch 0 ngày cũng coi như không có việc gì", () => {
    // Mọi suất dồn vào đúng (hôm nay - PAST_DAYS): phía trước 0 ngày nên lọt cửa
    // điều kiện, nhưng offset tính ra bằng 0 nên không có gì để làm.
    expect(planShift(["2026-07-31T10:00:00"], "2026-08-02")).toBeNull();
  });

  it("chuỗi hỏng thì bỏ qua, không ném lỗi", () => {
    expect(planShift(["hôm nay", ""], "2026-08-02")).toBeNull();
  });

  it("ngưỡng phơi ra ngoài để chỗ khác đọc được", () => {
    expect(AHEAD_DAYS_MIN).toBe(2);
  });
});
```

- [ ] **Step 2: Chạy để chắc chắn nó ĐỎ**

Run: `npx vitest run server/src/schedule/date-shift.test.ts`
Expected: FAIL — `planShift is not a function` / `AHEAD_DAYS_MIN` undefined

- [ ] **Step 3: Cài đặt tối thiểu**

Thêm vào `server/src/schedule/date-shift.ts`, ngay dưới `offsetDaysFor` — và **sửa `offsetDaysFor` dùng lại `dayDiff`** để phép trừ ngày chỉ có một bản:

```ts
// Cửa sổ phải luôn còn ít nhất chừng này ngày phía trước, nếu không thì dịch.
// Cửa sổ khoẻ có ngày muộn nhất = hôm nay + 4, nên thực tế cứ ~3 ngày dịch một lần.
export const AHEAD_DAYS_MIN = 2;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Số ngày lịch từ `from` đến `to`. NaN nếu một trong hai không phải ngày.
const dayDiff = (from: string, to: string): number =>
  (Date.parse(`${dayOf(to)}T00:00:00Z`) -
    Date.parse(`${dayOf(from)}T00:00:00Z`)) /
  86_400_000;

// Cần dịch bao nhiêu ngày để cửa sổ về lại [today - PAST_DAYS, ...]?
// null = đang khoẻ, hoặc không đủ dữ kiện để quyết — cả hai đều nghĩa là ĐỪNG ĐỤNG VÀO.
export function planShift(times: string[], today: string): number | null {
  const days = times.map(dayOf).filter((d) => DAY_RE.test(d));
  if (days.length === 0) return null;
  days.sort();

  // So theo NGÀY LỊCH, không theo giờ: suất 23:00 tối mai vẫn là "1 ngày phía trước",
  // đúng như người dùng nhìn vào dải chọn ngày.
  const ahead = dayDiff(today, days[days.length - 1]);
  if (!Number.isFinite(ahead) || ahead >= AHEAD_DAYS_MIN) return null;

  const offset = offsetDaysFor(days[0], today);
  return Number.isFinite(offset) && offset !== 0 ? offset : null;
}
```

và đổi thân `offsetDaysFor` thành:

```ts
export function offsetDaysFor(earliestDay: string, today: string): number {
  return Math.round(dayDiff(earliestDay, today)) - PAST_DAYS;
}
```

**Lưu ý thứ tự khai báo:** `dayDiff` là `const` nên phải nằm **trên** `offsetDaysFor` trong file, nếu không sẽ lỗi "used before its declaration" lúc chạy.

- [ ] **Step 4: Chạy test — phải XANH**

Run: `npx vitest run server/src/schedule/date-shift.test.ts`
Expected: PASS, 18 test (9 cũ + 9 mới)

- [ ] **Step 5: Lint + format**

Run: `npm run lint && npm run format:check`
Expected: exit 0, **0 warning** (warning cũng làm CI đỏ)

- [ ] **Step 6: Commit**

```bash
git add server/src/schedule/date-shift.ts server/src/schedule/date-shift.test.ts
git commit -m "feat(schedule): planShift quyet dinh khi nao phai dich cua so lich chieu"
```

---

### Task 3: `refresh.ts` + gắn vào vòng đời server

**Files:**

- Create: `server/src/schedule/refresh.ts`
- Modify: `server/src/index.ts`

**Interfaces:**

- Consumes: `planShift`, `addDays`, `dayOf` từ `./date-shift` (Task 2); `prisma` từ `../db/prisma`.
- Produces: `refreshShowtimes(): Promise<number | null>` (trả số ngày đã dịch, `null` nếu không làm gì) và `startShowtimeRefresh(): void` (chạy ngay + đặt nhịp 6 giờ). `index.ts` chỉ gọi `startShowtimeRefresh`.

**Không viết unit test cho file này** — nó import Prisma singleton, theo nếp repo (`gateway.ts`) thì file chạm Prisma/env không đặt test; phần đáng sai đã nằm ở `planShift`. Phép kiểm của task này là **thực nghiệm trên DB dev** ở Step 4-6.

- [ ] **Step 1: Viết `server/src/schedule/refresh.ts`**

```ts
import { prisma } from "../db/prisma";
import { addDays, dayOf, planShift } from "./date-shift";

// db.json giữ ngày cứng và seed chỉ dịch MỘT LẦN, nên vài ngày sau khi seed thì mọi
// suất chiếu đều thành quá khứ: trang chủ quảng cáo phim không đặt được, "Sắp tới" rỗng.
// Module này dịch lại cửa sổ ngay trong server — chỉ cột Showtime.time, KHÔNG đụng
// Booking/Review (đó là thời điểm có thật của người thật).

const EVERY_MS = 6 * 60 * 60 * 1000;

// Hai lượt chồng nhau (khởi động + nhịp lặp) sẽ dịch hai lần. Cờ này chặn.
let running = false;

// Giờ ĐỊA PHƯƠNG: chuỗi trong DB không mang múi giờ. toISOString() (UTC) sẽ ra ngày
// hôm trước với mọi lần chạy trước 07:00 ở VN.
const todayKey = (d: Date = new Date()): string => {
  const p2 = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

export async function refreshShowtimes(): Promise<number | null> {
  if (running) return null;
  running = true;
  try {
    const rows = await prisma.showtime.findMany({
      select: { id: true, time: true },
    });
    const offset = planShift(
      rows.map((r) => r.time),
      todayKey(),
    );
    if (offset === null) return null;

    // Một transaction: hoặc cả bộ dịch, hoặc không dòng nào — không để lịch chiếu
    // rơi vào trạng thái nửa cũ nửa mới.
    await prisma.$transaction(
      rows.map((r) =>
        prisma.showtime.update({
          where: { id: r.id },
          data: { time: addDays(r.time, offset) },
        }),
      ),
    );

    const days = rows.map((r) => dayOf(addDays(r.time, offset))).sort();
    console.log(
      `🔄 Đã dịch lịch chiếu ${offset > 0 ? "+" : ""}${offset} ngày: ${days[0]} → ${days[days.length - 1]}`,
    );
    return offset;
  } catch (e) {
    // Không bao giờ ném: DB chậm hay mất mạng không được phép làm sập server.
    console.error(
      "Không làm mới được lịch chiếu:",
      e instanceof Error ? e.message : e,
    );
    return null;
  } finally {
    running = false;
  }
}

export function startShowtimeRefresh(): void {
  void refreshShowtimes();
  // unref: bộ hẹn giờ không giữ tiến trình sống, tránh treo lúc tắt.
  setInterval(() => void refreshShowtimes(), EVERY_MS).unref();
}
```

- [ ] **Step 2: Gắn vào `server/src/index.ts`**

Thêm import và gọi trong callback của `listen` — **`index.ts` chứ không phải `app.ts`**: `app.ts` bị test supertest import, để ở đó thì mỗi lần chạy unit test là một lần bộ hẹn giờ nổ.

```ts
import { app } from "./app";
import { PORT, DATABASE_URL, WEB_ORIGIN } from "./env";
import { startShowtimeRefresh } from "./schedule/refresh";

// Che thông tin đăng nhập của chuỗi kết nối khi in ra log.
const dbLabel = DATABASE_URL.replace(/\/\/[^@]*@/, "//***:***@");

app.listen(PORT, () => {
  console.log(
    `Auth + API server chạy tại http://localhost:${PORT} (db: ${dbLabel}, web: ${WEB_ORIGIN})`,
  );
  startShowtimeRefresh();
});
```

- [ ] **Step 3: Typecheck + lint + format**

Run: `npm run typecheck && npm run lint && npm run format:check`
Expected: exit 0, 0 warning

- [ ] **Step 4: Đẩy DB dev vào quá khứ để tạo đúng tình huống hỏng**

Tạo `push-past.mjs` ở **gốc repo** (phải nằm trong project mới resolve được `node_modules`):

```js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.showtime.findMany({ select: { id: true, time: true } });
const shift = (iso, days) => {
  const [d, t] = iso.split("T");
  const [y, m, dd] = d.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, dd) + days * 86400000);
  const p2 = (n) => String(n).padStart(2, "0");
  return `${x.getUTCFullYear()}-${p2(x.getUTCMonth() + 1)}-${p2(x.getUTCDate())}T${t}`;
};
await prisma.$transaction(
  rows.map((r) =>
    prisma.showtime.update({ where: { id: r.id }, data: { time: shift(r.time, -10) } }),
  ),
);
const after = await prisma.showtime.findMany({ select: { time: true } });
console.log("da lui 10 ngay, muon nhat:", after.map((r) => r.time).sort().pop());
await prisma.$disconnect();
```

Run: `node push-past.mjs`
Expected: in ra ngày muộn nhất nằm **trước hôm nay** (cửa sổ đã chết)

- [ ] **Step 5: Khởi động lại server và xem nó tự chữa**

```bash
netstat -ano | grep :4000        # tìm PID đang nghe
taskkill //PID <pid> //F
npm run auth
```

Expected: trong log khởi động có dòng `🔄 Đã dịch lịch chiếu +N ngày: <ngày đầu> → <ngày cuối>`, với ngày đầu = hôm nay − 2.

- [ ] **Step 6: Xác nhận qua API, và xác nhận lần chạy thứ hai KHÔNG dịch nữa**

```bash
curl -s "http://localhost:4000/api/showtimes" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);const t=a.map(x=>x.time).sort();const n=new Date();const p2=v=>String(v).padStart(2,'0');const k=`${n.getFullYear()}-${p2(n.getMonth()+1)}-${p2(n.getDate())}T${p2(n.getHours())}:${p2(n.getMinutes())}`;console.log('muon nhat:',t[t.length-1],'| con dat duoc:',t.filter(x=>x>=k).length)})"
```

Expected: `còn đặt được` > 0 (khoảng 30).

Rồi khởi động lại server lần nữa (kill :4000, `npm run auth`): lần này **không** được có dòng `🔄` nào — cửa sổ đã khoẻ thì `planShift` trả `null`. Đây là phép kiểm tính bình ổn: chạy nhiều lần không dịch chồng.

- [ ] **Step 7: Xoá script tạm**

```bash
rm push-past.mjs
```

Bắt buộc — `format:check` quét cả file `.mjs` ở gốc repo.

- [ ] **Step 8: Commit**

```bash
git add server/src/schedule/refresh.ts server/src/index.ts
git commit -m "feat(schedule): server tu dich lich chieu khi cua so sap troi het vao qua khu"
```

---

### Task 4: Cập nhật CLAUDE.md và chạy trọn bộ cổng

**Files:**

- Modify: `CLAUDE.md` (mục Architecture, khối `server/src/`; và mục `db.json`)

**Interfaces:**

- Consumes: hành vi đã có từ Task 1-3.
- Produces: không có mã mới.

- [ ] **Step 1: Thêm mô tả module mới vào `CLAUDE.md`**

Trong mục **Architecture**, khối gạch đầu dòng `**server/src/**`, thêm một mục ngay trước `**static.ts**`:

```markdown
  - **`schedule/*`** — keeps the seeded 7-day showtime window from rotting. `date-shift.ts` is **pure** (no Prisma/env, so its unit tests run in CI without a database) and is the single source for all date math: `server/prisma/seed.ts` imports it too — the import only works in that direction, because `server/tsconfig.build.json` sets `rootDir: server/src` while `seed.ts` runs under `tsx` and is never compiled. `planShift(times, today)` returns the number of days to shift, or **`null` meaning leave it alone** — null when there are no showtimes, when the latest one is still `AHEAD_DAYS_MIN` (2) calendar days out, or when the computed offset is 0. `refresh.ts` reads every showtime, asks `planShift`, and rewrites `Showtime.time` in one `$transaction`; it **never throws** (a slow database must not take the server down) and a module-level `running` flag stops the boot run and the interval from overlapping. It is started from **`index.ts`, not `app.ts`** — `app.ts` is imported by the supertest unit tests, so mounting the timer there would fire it on every test run. **Only `Showtime.time` is touched**: `Booking.createdAt`/`Review.createdAt` are real timestamps of real people, so seeded bookings drift into looking bought-after-the-screening, which is a cosmetic wart on fixture data and deliberately not fixed.
```

Trong mục **`db.json`**, sau câu giải thích `date-shift.ts`, thêm:

```markdown
Re-seeding is no longer the only cure: the server re-centres the window itself on boot and every 6h (see `schedule/*`), so a live deployment stops going empty a few days after a seed — but that mechanism only *shifts* existing rows, it never creates them, so the first seed is still manual.
```

- [ ] **Step 2: Chạy trọn bộ cổng**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:cov && npm run build`
Expected: tất cả exit 0. `test:cov` phải in bảng coverage và **không** báo vượt ngưỡng (statements/lines 90, branches 87, functions 84) — phần thêm gần như toàn mã thuần có test nên số phải nhích lên, không tụt.

- [ ] **Step 3: Chạy e2e**

Run: `npm run e2e`
Expected: 20/20 xanh (test Stripe tự chạy vì máy dev có khoá). Cơ chế mới không đổi gì với e2e — DB dev vừa được chữa nên cửa sổ khoẻ, `planShift` trả `null`, không dịch giữa lúc test chạy.

- [ ] **Step 4: Commit + push**

```bash
git add CLAUDE.md
git commit -m "docs: ghi lai co che tu lam moi cua so lich chieu"
git push
```

- [ ] **Step 5: Xác minh trên bản live sau khi Render deploy xong**

Render tự deploy khi `main` đổi. Chờ ~3 phút rồi:

```bash
curl -s "https://cinema-full-a9xt.onrender.com/api/showtimes" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);const t=a.map(x=>x.time).sort();console.log('so suat:',a.length,'| muon nhat:',t[t.length-1])})"
```

Expected: 52 suất, ngày muộn nhất ≥ hôm nay + 2.

**Và mở bằng trình duyệt thật** — `curl` 200 không chứng minh trang chạy (bài học GĐ3f): trang chủ phải có `.movie-k`, `/movie/1` phải có `.time-k-btn`, bấm vào thì `.book-k__cta` enabled.

---

## Ghi chú cho người thực thi

- **Bẫy lớn nhất của kế hoạch này là Task 1.** Nếu bỏ qua bước chuyển file mà cứ viết `refresh.ts` import `../../prisma/date-shift`, thì `npm run typecheck` xanh (tsconfig gốc gồm cả hai thư mục) nhưng **`npm run build` đỏ** ở `tsc -p server/tsconfig.build.json` với TS6059 — và có khi phát hiện muộn tận CI.
- **Không** thay `planShift` bằng phép ngày viết trong SQL (`to_char(time::timestamp + interval ...)`). Cả repo chỉ có đúng một bản phép dịch ngày, đã có test; thêm bản thứ hai là thêm chỗ để lệch.
- Nếu `npm run auth` báo `EPERM` lúc cài đặt lại, đó là server cũ đang khoá Prisma client trên Windows — kill :4000 trước.
