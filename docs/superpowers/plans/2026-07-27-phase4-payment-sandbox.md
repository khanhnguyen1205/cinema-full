# Thanh toán sandbox (Stripe) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến phương thức "Thẻ" ở bước ③ của `BookingWizard` thành một lần thanh toán thật trên Stripe test-mode, trong đó **server tự tính lại số tiền từ DB** và **tự xác minh với Stripe** trước khi tạo booking.

**Architecture:** Thêm module `server/src/payments/` (4 file thuần/mỏng + 1 router) mount tại `/api/payments` trước catch-all `/api`. Client dùng Stripe Payment Element ở **deferred mode** (`mode:"payment"`) nên PaymentIntent chỉ sinh ra lúc bấm "Thanh toán", và `confirmPayment({redirect:"if_required"})` giữ người dùng ở nguyên trang ⇒ hold ghế 8 phút không bị phá. Gateway ở nhánh `bookings POST` bắt buộc `paymentRef` khi `paymentMethod === "card"`, tự retrieve intent, so tiền, rồi ghi đè tổng tiền bằng con số của server.

**Tech Stack:** Express 5 + TypeScript + Prisma/Postgres · `stripe` (Node) · `@stripe/stripe-js` + `@stripe/react-stripe-js` · React 18 + TanStack Query v5 · react-i18next · Vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-07-27-phase4-payment-sandbox-design.md`

**Khác spec một chút (có chủ đích):** bảng file trong spec liệt kê 4 file; kế hoạch tách thêm **`amount.ts`** (tra DB → gọi `quote()` thuần) và **`settle.ts`** (xác minh một lần trả tiền) vì cả `POST /intent` lẫn nhánh `bookings POST` của gateway đều cần đúng con số ấy — để chung sẽ phải nhân bản logic ở hai nơi.

## Global Constraints

- **Không import `server/src/env.ts`** từ bất kỳ file server nào có unit test — `env.ts` throw khi thiếu `DATABASE_URL`, còn job CI `checks` không có database. Đọc `process.env` trực tiếp (tiền lệ: `server/src/static.ts`).
- **Thứ tự mount trong `app.ts` là load-bearing:** `/auth` → `/api/occupied-seats` → `/api/holds` → `/api/payments` → `/api` (catch-all) → SPA (`mountStatic` luôn cuối cùng).
- **Hợp đồng HTTP hiện có không được đổi:** POST → 201, DELETE → `{}` + 200, id không có → 404, list `orderBy: { id: "asc" }`.
- **Mọi chuỗi hiển thị phải đi qua `t("area.key")`** và **key phải có ở CẢ HAI** `src/i18n/locales/vi.json` và `en.json` (kể cả aria-label).
- **Giá luôn là VND**, format bằng `formatPrice` từ `i18n/format`.
- **6 cổng phải xanh trước mỗi commit:** `npm run typecheck` · `npm run lint` (**0 warning**, warning cũng là hỏng) · `npm run format:check` · `npm run test:run` · `npm run e2e` · `npm run build`.
- **Mỗi task = 1 commit, push thẳng `main`** (repo cá nhân, không dùng nhánh/PR).
- **Windows:** server `tsx` đang chạy **khoá file Prisma client** ⇒ trước mọi `npm install` / `prisma migrate` phải **kill listener :4000** (`netstat -ano | findstr :4000` → `taskkill //PID <pid> //F`), xong chạy lại `npm run auth`.
- Server chạy `tsx` **không watch** ⇒ mọi sửa đổi trong `server/**` cần **restart tay**.
- Ràng buộc e2e không được phá: placeholder `your@email.com` / `••••••••`, nút **"Đăng nhập"**, nút **"Thanh toán"**.
- Số tiền Stripe dùng **VND (zero-decimal)** ⇒ `amount` là số tiền nguyên, **không nhân 100**.

---

### Task 1: Cột `paymentRef` trên Booking

**Files:**
- Modify: `server/prisma/schema.prisma:71-88` (model `Booking`)
- Create: `server/prisma/migrations/<timestamp>_booking_payment_ref/migration.sql` (do Prisma sinh)
- Modify: `server/src/api/collections.ts:62-82` (`bookings.writable`)
- Modify: `server/src/api/collections.test.ts` (thêm test)
- Modify: `src/types/index.ts` (interface `Booking`)

**Interfaces:**
- Consumes: không có (task đầu tiên)
- Produces: cột DB `Booking.paymentRef String? @unique`; `COLLECTIONS.bookings.writable` chứa `"paymentRef"`; client type `Booking.paymentRef?: string | null`

- [ ] **Step 1: Kill server đang chạy trên :4000**

```bash
netstat -ano | findstr :4000
# lấy PID ở cột cuối rồi:
taskkill //PID <pid> //F
```

Bỏ qua bước này thì `prisma migrate` sẽ fail EPERM vì Windows khoá Prisma client.

- [ ] **Step 2: Thêm cột vào schema**

Trong `server/prisma/schema.prisma`, model `Booking`, thêm dòng cuối cùng (sau `createdAt`):

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
  // Mã PaymentIntent của Stripe ("pi_..."). null với đơn "Tại quầy" và đơn cũ.
  // @unique là chốt chặn: một lần trả tiền chỉ tạo được đúng một đơn.
  paymentRef    String?  @unique
}
```

- [ ] **Step 3: Tạo + áp migration lên Neon dev**

Run: `npm run prisma:migrate -- --name booking_payment_ref`
Expected: in ra `Your database is now in sync with your schema`, sinh thư mục `server/prisma/migrations/<timestamp>_booking_payment_ref/`.

- [ ] **Step 4: Xác nhận dữ liệu cũ còn nguyên**

Run:

```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.booking.findMany({select:{id:true,paymentRef:true}}).then(r=>{console.log(r);return p.\$disconnect()})"
```

Expected: 3 đơn seed, `paymentRef: null` cả 3.

- [ ] **Step 5: Viết test cho whitelist (đỏ trước)**

Thêm vào `server/src/api/collections.test.ts`:

```ts
it("bookings nhận paymentRef qua whitelist", () => {
  const data = pickWritable("bookings", {
    totalPrice: 1000,
    paymentRef: "pi_123",
    id: 999,
  });
  expect(data.paymentRef).toBe("pi_123");
  expect(data.id).toBeUndefined();
});
```

- [ ] **Step 6: Chạy test để thấy nó ĐỎ**

Run: `npx vitest run server/src/api/collections.test.ts`
Expected: FAIL — `expected undefined to be 'pi_123'`.

- [ ] **Step 7: Thêm `paymentRef` vào whitelist**

Trong `server/src/api/collections.ts`, mảng `bookings.writable`, thêm `"paymentRef"` ngay sau `"createdAt"`:

```ts
      "totalPrice",
      "createdAt",
      "paymentRef",
    ],
    json: ["seatTypes", "concessions"],
```

- [ ] **Step 8: Chạy lại test để thấy XANH**

Run: `npx vitest run server/src/api/collections.test.ts`
Expected: PASS.

- [ ] **Step 9: Thêm field vào type client**

Trong `src/types/index.ts`, interface `Booking`, thêm sau `createdAt: string;`:

```ts
  paymentRef?: string | null;
```

- [ ] **Step 10: Chạy 6 cổng**

Run:

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build
```

Expected: tất cả xanh, lint **0 warning**.

- [ ] **Step 11: Khởi động lại server rồi chạy e2e**

Run: `npm run auth` (nền, cửa sổ khác) rồi `npm run e2e`
Expected: 19 test xanh.

- [ ] **Step 12: Commit + push**

```bash
git add server/prisma/schema.prisma server/prisma/migrations server/src/api/collections.ts server/src/api/collections.test.ts src/types/index.ts
git commit -m "feat(GD4-payment): cot Booking.paymentRef (@unique) + migration + whitelist + type"
git push
```

---

### Task 2: `quote.ts` + `verify.ts` (hai đơn vị thuần, TDD)

**Files:**
- Create: `server/src/payments/quote.ts`
- Create: `server/src/payments/quote.test.ts`
- Create: `server/src/payments/verify.ts`
- Create: `server/src/payments/verify.test.ts`

**Interfaces:**
- Consumes: không gì (thuần, không import Prisma/env/stripe)
- Produces:
  - `MAX_SEATS = 8`, `SERVICE_FEE = 15000`
  - `vipPrice(base: number): number`, `couplePrice(base: number): number`, `rowOf(seatNumber: string): string`
  - `type QuoteItem = { price: number; qty: number }`
  - `type QuoteInput = { basePrice: number; seats: string[]; vipRows?: string[]; coupleRows?: string[]; items?: QuoteItem[] }`
  - `type Quote = { seatTotal: number; fnbTotal: number; serviceFee: number; total: number }`
  - `quote(input: QuoteInput): Quote`
  - `type IntentLike = { status?: string | null; amount?: number | null; currency?: string | null; metadata?: Record<string, string> | null }`
  - `type CheckResult = { ok: true } | { ok: false; reason: string }`
  - `checkIntent(intent: IntentLike | null | undefined, expected: { amount: number; userId: number }): CheckResult`

- [ ] **Step 1: Viết test cho `quote` (đỏ trước)**

Tạo `server/src/payments/quote.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { quote, vipPrice, couplePrice, rowOf, SERVICE_FEE } from "./quote";

describe("giá ghế (phải khớp src/lib/pricing.ts)", () => {
  it("VIP = làm tròn 1.000 của base×1.3", () => {
    expect(vipPrice(75000)).toBe(98000); // 97.500 -> 98.000
    expect(vipPrice(95000)).toBe(124000); // 123.500 -> 124.000
  });

  it("đôi = làm tròn 1.000 của base×1.6", () => {
    expect(couplePrice(75000)).toBe(120000);
    expect(couplePrice(95000)).toBe(152000);
  });

  it("rowOf lấy phần chữ cái đầu của mã ghế", () => {
    expect(rowOf("A3")).toBe("A");
    expect(rowOf("h10")).toBe("H");
  });
});

describe("quote", () => {
  const base = 75000;

  it("ghế thường: tiền ghế + phí dịch vụ", () => {
    const q = quote({ basePrice: base, seats: ["A1", "A2"] });
    expect(q.seatTotal).toBe(150000);
    expect(q.fnbTotal).toBe(0);
    expect(q.serviceFee).toBe(SERVICE_FEE);
    expect(q.total).toBe(165000);
  });

  it("hàng VIP tính giá VIP", () => {
    const q = quote({ basePrice: base, seats: ["E1"], vipRows: ["E", "F"] });
    expect(q.seatTotal).toBe(98000);
  });

  it("hàng vừa VIP vừa đôi thì tính giá ĐÔI", () => {
    const q = quote({
      basePrice: base,
      seats: ["H1"],
      vipRows: ["H"],
      coupleRows: ["H"],
    });
    expect(q.seatTotal).toBe(120000);
  });

  it("cộng bắp nước theo price × qty", () => {
    const q = quote({
      basePrice: base,
      seats: ["A1"],
      items: [
        { price: 45000, qty: 2 },
        { price: 30000, qty: 1 },
      ],
    });
    expect(q.fnbTotal).toBe(120000);
    expect(q.total).toBe(75000 + 120000 + SERVICE_FEE);
  });

  it("không có ghế thì KHÔNG tính phí dịch vụ", () => {
    const q = quote({ basePrice: base, seats: [] });
    expect(q.serviceFee).toBe(0);
    expect(q.total).toBe(0);
  });

  it("so hàng không phân biệt hoa/thường", () => {
    const q = quote({ basePrice: base, seats: ["e1"], vipRows: ["E"] });
    expect(q.seatTotal).toBe(98000);
  });
});
```

- [ ] **Step 2: Chạy test để thấy ĐỎ**

Run: `npx vitest run server/src/payments/quote.test.ts`
Expected: FAIL — `Cannot find module './quote'`.

- [ ] **Step 3: Viết `quote.ts`**

Tạo `server/src/payments/quote.ts`:

```ts
// Luật giá NHÂN BẢN từ src/lib/pricing.ts — không import chéo được vì
// server/tsconfig.build.json đặt rootDir: server/src.
// ⚠ Sửa giá ở một bên thì PHẢI sửa bên kia; test số cứng hai phía là chốt chặn.
export const SERVICE_FEE = 15000;
export const MAX_SEATS = 8;

const roundTo1000 = (n: number): number => Math.round(n / 1000) * 1000;

export const vipPrice = (basePrice: number): number =>
  roundTo1000(basePrice * 1.3);
export const couplePrice = (basePrice: number): number =>
  roundTo1000(basePrice * 1.6);

// "H10" -> "H" (mã ghế = chữ hàng + số cột)
export const rowOf = (seatNumber: string): string =>
  (seatNumber.match(/^[A-Za-z]+/)?.[0] ?? "").toUpperCase();

export type QuoteItem = { price: number; qty: number };

export type QuoteInput = {
  basePrice: number;
  seats: string[];
  vipRows?: string[];
  coupleRows?: string[];
  items?: QuoteItem[];
};

export type Quote = {
  seatTotal: number;
  fnbTotal: number;
  serviceFee: number;
  total: number;
};

export function quote(input: QuoteInput): Quote {
  const vip = new Set((input.vipRows ?? []).map((r) => r.toUpperCase()));
  const couple = new Set((input.coupleRows ?? []).map((r) => r.toUpperCase()));

  const seatTotal = input.seats.reduce((sum, seat) => {
    const row = rowOf(seat);
    // Ghế đôi thắng VIP khi một hàng nằm trong cả hai danh sách.
    if (couple.has(row)) return sum + couplePrice(input.basePrice);
    if (vip.has(row)) return sum + vipPrice(input.basePrice);
    return sum + input.basePrice;
  }, 0);

  const fnbTotal = (input.items ?? []).reduce(
    (sum, i) => sum + i.price * i.qty,
    0,
  );
  const serviceFee = input.seats.length > 0 ? SERVICE_FEE : 0;

  return { seatTotal, fnbTotal, serviceFee, total: seatTotal + fnbTotal + serviceFee };
}
```

- [ ] **Step 4: Chạy test để thấy XANH**

Run: `npx vitest run server/src/payments/quote.test.ts`
Expected: PASS (9 test).

- [ ] **Step 5: Viết test cho `checkIntent` (đỏ trước)**

Tạo `server/src/payments/verify.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkIntent } from "./verify";

const good = {
  status: "succeeded",
  amount: 165000,
  currency: "vnd",
  metadata: { userId: "2" },
};

describe("checkIntent", () => {
  it("chấp nhận giao dịch hợp lệ", () => {
    expect(checkIntent(good, { amount: 165000, userId: 2 })).toEqual({
      ok: true,
    });
  });

  it("từ chối khi không có intent", () => {
    const r = checkIntent(null, { amount: 165000, userId: 2 });
    expect(r.ok).toBe(false);
  });

  it("từ chối khi chưa succeeded", () => {
    const r = checkIntent(
      { ...good, status: "requires_payment_method" },
      { amount: 165000, userId: 2 },
    );
    expect(r.ok).toBe(false);
  });

  it("từ chối khi lệch số tiền", () => {
    const r = checkIntent({ ...good, amount: 1000 }, { amount: 165000, userId: 2 });
    expect(r.ok).toBe(false);
  });

  it("từ chối khi lệch đơn vị tiền tệ", () => {
    const r = checkIntent({ ...good, currency: "usd" }, { amount: 165000, userId: 2 });
    expect(r.ok).toBe(false);
  });

  it("từ chối khi giao dịch thuộc user khác", () => {
    const r = checkIntent(good, { amount: 165000, userId: 3 });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 6: Chạy test để thấy ĐỎ**

Run: `npx vitest run server/src/payments/verify.test.ts`
Expected: FAIL — `Cannot find module './verify'`.

- [ ] **Step 7: Viết `verify.ts`**

Tạo `server/src/payments/verify.ts`:

```ts
// Thuần: không gọi mạng, không import Prisma/env — nhận sẵn object intent để test được.
export type IntentLike = {
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
};

export type CheckResult = { ok: true } | { ok: false; reason: string };

export function checkIntent(
  intent: IntentLike | null | undefined,
  expected: { amount: number; userId: number },
): CheckResult {
  if (!intent) return { ok: false, reason: "Không tìm thấy giao dịch thanh toán." };
  if (intent.status !== "succeeded")
    return { ok: false, reason: "Giao dịch thanh toán chưa hoàn tất." };
  if (intent.amount !== expected.amount)
    return { ok: false, reason: "Số tiền thanh toán không khớp đơn hàng." };
  if ((intent.currency ?? "").toLowerCase() !== "vnd")
    return { ok: false, reason: "Đơn vị tiền tệ không hợp lệ." };
  if (Number(intent.metadata?.userId) !== expected.userId)
    return { ok: false, reason: "Giao dịch không thuộc về tài khoản này." };
  return { ok: true };
}
```

- [ ] **Step 8: Chạy test để thấy XANH**

Run: `npx vitest run server/src/payments/verify.test.ts`
Expected: PASS (6 test).

- [ ] **Step 9: Chạy 6 cổng**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build && npm run e2e`
Expected: tất cả xanh. Nếu `format:check` phàn nàn thì chạy `npm run format` rồi kiểm lại.

- [ ] **Step 10: Commit + push**

```bash
git add server/src/payments
git commit -m "feat(GD4-payment): quote.ts + verify.ts thuan (tinh tien server-side + xac minh intent) + 15 test"
git push
```

---

### Task 3: Stripe client + router `/api/payments`

**Files:**
- Create: `server/src/payments/stripe.ts`
- Create: `server/src/payments/amount.ts`
- Create: `server/src/payments/routes.ts`
- Modify: `server/src/app.ts:1-28`
- Modify: `.env.example`
- Modify: `.env` (KHÔNG commit — file này đã gitignore)

**Interfaces:**
- Consumes: `quote()`, `MAX_SEATS` từ `./quote`
- Produces:
  - `isStripeEnabled(): boolean`, `publishableKey(): string`, `getStripe(): Stripe`
  - `type OrderInput = { showtimeId: number; seats: string[]; concessions: { id: number; qty: number }[] }`
  - `type AmountResult = { ok: true; quote: Quote } | { ok: false; status: number; error: string; conflicts?: string[] }`
  - `amountFor(order: OrderInput, userId: number): Promise<AmountResult>`
  - `paymentsRouter` (Express Router) — `GET /config`, `POST /intent`

**⚠ Trước task này người dùng phải đã dán `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` vào `.env`.** Nếu chưa có, vẫn làm được Step 1–9 và verify nhánh `enabled:false`; chỉ Step 10 cần key thật.

- [ ] **Step 1: Kill :4000 rồi cài dep server**

```bash
netstat -ano | findstr :4000   # rồi taskkill //PID <pid> //F
npm install stripe
```

- [ ] **Step 2: Viết `stripe.ts`**

Tạo `server/src/payments/stripe.ts`:

```ts
import Stripe from "stripe";

// KHÔNG import ./env: env.ts throw khi thiếu DATABASE_URL, mà nhánh payments
// có unit test chạy trong job CI `checks` (không có database).
let client: Stripe | null = null;

export const publishableKey = (): string =>
  process.env.STRIPE_PUBLISHABLE_KEY || "";

// Thiếu key => tính năng tắt êm, server vẫn khởi động bình thường.
export const isStripeEnabled = (): boolean =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);

// Khởi tạo lười: chỉ dựng client khi thật sự có người gọi Stripe.
export function getStripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  return client;
}
```

- [ ] **Step 3: Viết `amount.ts` (nguồn duy nhất tính tiền từ DB)**

Tạo `server/src/payments/amount.ts`:

```ts
// Tra DB rồi gọi quote() thuần. Có Prisma => KHÔNG viết unit test cho file này
// (job CI `checks` không có database).
import { prisma } from "../db/prisma";
import { heldByOthers } from "../api/holds";
import { quote, MAX_SEATS, type Quote } from "./quote";

export type OrderInput = {
  showtimeId: number;
  seats: string[];
  concessions: { id: number; qty: number }[];
};

export type AmountResult =
  | { ok: true; quote: Quote }
  | { ok: false; status: number; error: string; conflicts?: string[] };

export async function amountFor(
  order: OrderInput,
  userId: number,
): Promise<AmountResult> {
  const { showtimeId, seats } = order;
  if (!Number.isFinite(showtimeId) || seats.length === 0)
    return { ok: false, status: 400, error: "Thiếu suất chiếu hoặc ghế." };
  if (seats.length > MAX_SEATS)
    return { ok: false, status: 400, error: `Tối đa ${MAX_SEATS} ghế mỗi lần đặt.` };

  const showtime = await prisma.showtime.findUnique({ where: { id: showtimeId } });
  if (!showtime) return { ok: false, status: 404, error: "Không tìm thấy suất chiếu." };
  const room = await prisma.room.findUnique({ where: { id: showtime.roomId } });
  if (!room) return { ok: false, status: 404, error: "Không tìm thấy phòng chiếu." };

  // Ghế đã bán + ghế người KHÁC đang giữ (cùng nguồn với /api/occupied-seats).
  const bookings = await prisma.booking.findMany({
    where: { showtimeId },
    select: { seats: true },
  });
  const taken = new Set<string>(showtime.bookedSeats);
  bookings.forEach((b) => b.seats.forEach((s) => taken.add(s)));
  heldByOthers(showtimeId, userId).forEach((s) => taken.add(s));
  const conflicts = seats.filter((s) => taken.has(s));
  if (conflicts.length)
    return {
      ok: false,
      status: 409,
      error: "Ghế vừa bị người khác giữ.",
      conflicts,
    };

  // Giá bắp nước LẤY TỪ DB, không tin số client gửi (client chỉ gửi id + qty).
  const ids = order.concessions
    .map((c) => Number(c.id))
    .filter((n) => Number.isFinite(n));
  const rows = ids.length
    ? await prisma.concession.findMany({ where: { id: { in: ids } } })
    : [];
  const priceById = new Map(rows.map((r) => [r.id, r.price]));
  const items = order.concessions
    .map((c) => ({
      price: priceById.get(Number(c.id)) ?? 0,
      qty: Math.max(0, Math.floor(Number(c.qty) || 0)),
    }))
    .filter((i) => i.price > 0 && i.qty > 0);

  return {
    ok: true,
    quote: quote({
      basePrice: showtime.price,
      seats,
      vipRows: room.vipRows,
      coupleRows: room.coupleRows,
      items,
    }),
  };
}
```

- [ ] **Step 4: Viết `routes.ts`**

Tạo `server/src/payments/routes.ts`:

```ts
import { Router } from "express";
import { getUserFromReq } from "../auth/middleware";
import { amountFor } from "./amount";
import { getStripe, isStripeEnabled, publishableKey } from "./stripe";

export const paymentsRouter: Router = Router();

// Công khai: client cần biết có bật thanh toán thẻ không + publishable key.
// KHÔNG bao giờ trả secret key.
paymentsRouter.get("/config", (_req, res) => {
  if (!isStripeEnabled()) {
    res.json({ enabled: false });
    return;
  }
  res.json({ enabled: true, publishableKey: publishableKey() });
});

// Tạo PaymentIntent. Server TỰ TÍNH số tiền từ DB — không đọc số tiền của client.
paymentsRouter.post("/intent", async (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Vui lòng đăng nhập." });
    return;
  }
  if (!isStripeEnabled()) {
    res.status(503).json({ error: "Chưa cấu hình thanh toán thẻ." });
    return;
  }

  const body = req.body ?? {};
  const showtimeId = Number(body.showtimeId);
  const seats: string[] = Array.isArray(body.seats) ? body.seats.map(String) : [];
  const concessions = Array.isArray(body.concessions) ? body.concessions : [];

  const result = await amountFor({ showtimeId, seats, concessions }, user.id);
  if (!result.ok) {
    res.status(result.status).json({
      error: result.error,
      ...(result.conflicts ? { conflicts: result.conflicts } : {}),
    });
    return;
  }

  try {
    const intent = await getStripe().paymentIntents.create({
      amount: result.quote.total, // VND là zero-decimal: không nhân 100
      currency: "vnd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: String(user.id),
        showtimeId: String(showtimeId),
        seats: seats.join(","),
      },
    });
    res.json({ clientSecret: intent.client_secret, amount: intent.amount });
  } catch (e) {
    console.error("[payments]", e);
    res.status(502).json({ error: "Không tạo được phiên thanh toán." });
  }
});
```

- [ ] **Step 5: Mount router đúng thứ tự**

Trong `server/src/app.ts`, thêm import sau dòng `import { gatewayRouter } ...`:

```ts
import { paymentsRouter } from "./payments/routes";
```

rồi chèn **trước** catch-all `/api`:

```ts
app.use("/api/occupied-seats", occupiedRouter);
app.use("/api/holds", holdsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api", gatewayRouter);
```

- [ ] **Step 6: Thêm biến vào `.env.example`**

Thêm vào cuối `.env.example`:

```
# Thanh toán sandbox (Stripe test-mode) — thiếu thì tính năng thẻ tự tắt
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

- [ ] **Step 7: Khởi động lại server**

Run: `npm run auth` (nền)
Expected: log khởi động bình thường, không throw.

- [ ] **Step 8: Verify nhánh CHƯA có key (nếu `.env` chưa có key)**

Run: `curl -s http://localhost:4000/api/payments/config`
Expected: `{"enabled":false}`

- [ ] **Step 9: Verify `/intent` chặn người chưa đăng nhập**

Run:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/payments/intent \
  -H "Content-Type: application/json" -d '{"showtimeId":1,"seats":["A1"],"concessions":[]}'
```

Expected: `401`

- [ ] **Step 10: Verify có key thật (cần `.env` đã có key + restart server)**

```bash
rm -f c.txt
curl -s -c c.txt -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@cinema.vn","password":"123456"}' > /dev/null
curl -s http://localhost:4000/api/payments/config
curl -s -b c.txt -X POST http://localhost:4000/api/payments/intent \
  -H "Content-Type: application/json" \
  -d '{"showtimeId":1,"seats":["A1"],"concessions":[]}'
rm -f c.txt
```

Expected: config có `"enabled":true` + `pk_test_…`; intent trả `{"clientSecret":"pi_..._secret_...","amount":90000}` (75.000 ghế thường + 15.000 phí — con số cụ thể tuỳ suất 1).
**Nếu Stripe từ chối `currency: "vnd"`** → dừng lại, báo người dùng, áp phương án dự phòng ở mục "Rủi ro đã biết" của spec (đổi sang `usd` với tỷ giá cố định trong `quote.ts`).

- [ ] **Step 11: Verify ghế đã bán bị chặn TRƯỚC khi charge**

```bash
rm -f c.txt
curl -s -c c.txt -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@cinema.vn","password":"123456"}' > /dev/null
curl -s -b c.txt -X POST http://localhost:4000/api/payments/intent \
  -H "Content-Type: application/json" \
  -d '{"showtimeId":1,"seats":["A3"],"concessions":[]}'
rm -f c.txt
```

Expected: `409` với `{"error":"Ghế vừa bị người khác giữ.","conflicts":["A3"]}` (A3 nằm trong `bookedSeats` của suất 1 theo seed).
**Nhớ `rm -f c.txt`** — cookie jar chứa token phiên, tuyệt đối không để lọt vào commit.

- [ ] **Step 12: Chạy 6 cổng + commit**

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build && npm run e2e
git add server/src/payments server/src/app.ts .env.example package.json package-lock.json
git commit -m "feat(GD4-payment): stripe.ts + amount.ts + router /api/payments (config + intent)"
git push
```

---

### Task 4: Gateway bắt buộc thanh toán khi `paymentMethod === "card"`

**Files:**
- Create: `server/src/payments/settle.ts`
- Modify: `server/src/api/gateway.ts:59-69` (nhánh `bookings` POST)

**Interfaces:**
- Consumes: `amountFor()` từ `./amount`, `checkIntent()` từ `./verify`, `getStripe()`/`isStripeEnabled()` từ `./stripe`
- Produces:
  - `type SettleResult = { ok: true; existing: BookingRow } | { ok: true; existing: null; totals: { seatTotal: number; fnbTotal: number; serviceFee: number; totalPrice: number } } | { ok: false; status: number; error: string; conflicts?: string[] }`
  - `settleCardPayment(body: Record<string, unknown>, userId: number): Promise<SettleResult>`

- [ ] **Step 1: Viết `settle.ts`**

Tạo `server/src/payments/settle.ts`:

```ts
import { prisma } from "../db/prisma";
import { amountFor } from "./amount";
import { checkIntent } from "./verify";
import { getStripe, isStripeEnabled } from "./stripe";

type BookingRow = Awaited<ReturnType<typeof prisma.booking.findFirst>>;

export type SettleResult =
  | { ok: true; existing: NonNullable<BookingRow> }
  | {
      ok: true;
      existing: null;
      totals: {
        seatTotal: number;
        fnbTotal: number;
        serviceFee: number;
        totalPrice: number;
      };
    }
  | { ok: false; status: number; error: string; conflicts?: string[] };

// Kiểm tra một lần trả tiền qua thẻ trước khi cho phép tạo booking.
export async function settleCardPayment(
  body: Record<string, unknown>,
  userId: number,
): Promise<SettleResult> {
  if (!isStripeEnabled())
    return { ok: false, status: 503, error: "Chưa cấu hình thanh toán thẻ." };

  const paymentRef = typeof body.paymentRef === "string" ? body.paymentRef : "";
  if (!paymentRef.startsWith("pi_"))
    return { ok: false, status: 402, error: "Thiếu mã giao dịch thanh toán." };

  // Idempotency: cùng một lần trả tiền chỉ ứng với đúng một đơn.
  const existing = await prisma.booking.findUnique({ where: { paymentRef } });
  if (existing) {
    if (existing.userId !== userId)
      return { ok: false, status: 403, error: "Không có quyền." };
    return { ok: true, existing };
  }

  const order = {
    showtimeId: Number(body.showtimeId),
    seats: Array.isArray(body.seats) ? (body.seats as unknown[]).map(String) : [],
    concessions: Array.isArray(body.concessions)
      ? (body.concessions as { id: number; qty: number }[])
      : [],
  };
  const amount = await amountFor(order, userId);
  if (!amount.ok)
    return {
      ok: false,
      status: amount.status,
      error: amount.error,
      conflicts: amount.conflicts,
    };

  let intent;
  try {
    intent = await getStripe().paymentIntents.retrieve(paymentRef);
  } catch {
    return { ok: false, status: 402, error: "Không tìm thấy giao dịch thanh toán." };
  }

  const check = checkIntent(intent, { amount: amount.quote.total, userId });
  if (!check.ok) return { ok: false, status: 402, error: check.reason };

  return {
    ok: true,
    existing: null,
    totals: {
      seatTotal: amount.quote.seatTotal,
      fnbTotal: amount.quote.fnbTotal,
      serviceFee: amount.quote.serviceFee,
      totalPrice: amount.quote.total,
    },
  };
}
```

- [ ] **Step 2: Sửa nhánh `bookings` POST trong gateway**

Trong `server/src/api/gateway.ts`, thêm import:

```ts
import { settleCardPayment } from "../payments/settle";
```

rồi thay nguyên khối `if (req.method === "POST") { ... }` của nhánh `bookings` (dòng 59–69) bằng:

```ts
      if (req.method === "POST") {
        if (!user) {
          deny(401, "Vui lòng đăng nhập.");
          return;
        }
        const body = { ...(req.body ?? {}) } as Record<string, unknown>;
        body.userId = user.id; // ép userId = chính mình
        const stId = body.showtimeId;

        if (body.paymentMethod === "card") {
          const paid = await settleCardPayment(body, user.id);
          if (!paid.ok) {
            res.status(paid.status).json({
              error: paid.error,
              ...(paid.conflicts ? { conflicts: paid.conflicts } : {}),
            });
            return;
          }
          if (paid.existing) {
            // Đã trả tiền và đơn đã tồn tại -> trả lại chính đơn đó, không tạo trùng.
            res.status(200).json(paid.existing);
            if (stId != null) releaseHolds(stId as string | number, user.id);
            return;
          }
          // Tiền là con số SERVER tự tính, không phải số client gửi.
          Object.assign(body, paid.totals);
        } else {
          delete body.paymentRef; // chỉ luồng thẻ mới được ghi mã giao dịch
        }

        req.body = body;
        await handleRest(req, res, rest);
        if (stId != null) releaseHolds(stId as string | number, user.id); // đặt xong -> nhả hold
        return;
      }
```

- [ ] **Step 3: Restart server**

```bash
netstat -ano | findstr :4000   # taskkill //PID <pid> //F
npm run auth
```

- [ ] **Step 4: Verify luồng "Tại quầy" KHÔNG đổi hành vi**

```bash
rm -f c.txt
curl -s -c c.txt -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@cinema.vn","password":"123456"}' > /dev/null
curl -s -b c.txt -w "\n%{http_code}\n" -X POST http://localhost:4000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"movieId":1,"showtimeId":1,"cinemaId":1,"roomId":1,"seats":["J9"],"seatTypes":{"standard":1,"vip":0,"couple":0},"paymentMethod":"counter","userName":"Test","totalPrice":90000,"createdAt":"2026-07-27T00:00:00.000Z"}'
```

Expected: `201` + đơn có `"paymentRef":null`. **Ghi lại `id` để xoá ở Step 6.**

- [ ] **Step 5: Verify luồng thẻ bị chặn khi thiếu / sai `paymentRef`**

```bash
curl -s -b c.txt -w "\n%{http_code}\n" -X POST http://localhost:4000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"movieId":1,"showtimeId":1,"cinemaId":1,"roomId":1,"seats":["J8"],"seatTypes":{"standard":1,"vip":0,"couple":0},"paymentMethod":"card","userName":"Test","totalPrice":1000,"createdAt":"2026-07-27T00:00:00.000Z"}'
curl -s -b c.txt -w "\n%{http_code}\n" -X POST http://localhost:4000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"movieId":1,"showtimeId":1,"cinemaId":1,"roomId":1,"seats":["J8"],"seatTypes":{"standard":1,"vip":0,"couple":0},"paymentMethod":"card","paymentRef":"pi_khong_ton_tai","userName":"Test","totalPrice":1000,"createdAt":"2026-07-27T00:00:00.000Z"}'
```

Expected: cả hai đều `402` — lần đầu "Thiếu mã giao dịch thanh toán.", lần sau "Không tìm thấy giao dịch thanh toán." (nếu chưa có key Stripe thì cả hai là `503` "Chưa cấu hình thanh toán thẻ." — cũng đạt, nghĩa là đơn KHÔNG được tạo).

- [ ] **Step 6: Dọn đơn test + xoá cookie jar**

```bash
rm -f c.txt a.txt
curl -s -c a.txt -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cinema.vn","password":"admin123"}' > /dev/null
curl -s -b a.txt -X DELETE http://localhost:4000/api/bookings/<id-ở-Step-4>
rm -f a.txt
```

Expected: `{}`. Kiểm lại `git status` **không** thấy `c.txt`/`a.txt`.

- [ ] **Step 7: Chạy 6 cổng + commit**

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build && npm run e2e
git add server/src/payments/settle.ts server/src/api/gateway.ts
git commit -m "feat(GD4-payment): gateway bat buoc verify PaymentIntent khi paymentMethod=card + idempotency theo paymentRef"
git push
```

---

### Task 5: Client — Payment Element trong bước ③

**Files:**
- Create: `src/services/payments.ts`
- Create: `src/queries/payments.ts`
- Create: `src/pages/booking/StripePayForm.tsx`
- Modify: `src/queries/keys.ts:3-21`
- Modify: `src/pages/booking/PaymentStep.tsx` (viết lại)
- Modify: `src/pages/booking/BookingWizard.tsx`
- Modify: `src/services/api.ts:69-74` (`createBooking` ném lỗi khi `!r.ok`)
- Modify: `src/pages/booking/Booking.css` (thêm khối `.pay-k__stripe`)
- Modify: `src/i18n/locales/vi.json`, `src/i18n/locales/en.json`

**Interfaces:**
- Consumes: `GET /api/payments/config`, `POST /api/payments/intent` (Task 3); `paymentRef` được gateway chấp nhận (Task 4)
- Produces:
  - `interface PaymentConfig { enabled: boolean; publishableKey?: string }`
  - `getPaymentConfig(): Promise<PaymentConfig>`
  - `createPaymentIntent(payload: IntentPayload): Promise<IntentResult>` với `IntentPayload = { showtimeId: number; seats: string[]; concessions: { id: number; qty: number }[] }`, `IntentResult = { clientSecret: string; amount: number }`
  - `usePaymentConfig(): UseQueryResult<PaymentConfig>`; key `qk.paymentConfig`
  - `type PayHandle = { pay: () => Promise<void> }` (export từ `StripePayForm.tsx`)

- [ ] **Step 1: Kill :4000 rồi cài dep client**

```bash
netstat -ano | findstr :4000   # taskkill //PID <pid> //F
npm install @stripe/stripe-js @stripe/react-stripe-js
npm run auth   # bật lại server ở cửa sổ khác
```

- [ ] **Step 2: Viết `src/services/payments.ts`**

```ts
// Thanh toán qua cổng phân quyền (:4000/api/payments). Publishable key lấy từ server
// (không phải biến VITE_*) nên đổi key trên Render không cần build lại.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export interface PaymentConfig {
  enabled: boolean;
  publishableKey?: string;
}

export const getPaymentConfig = (): Promise<PaymentConfig> =>
  fetch(`${BASE_URL}/payments/config`, { credentials: "include" }).then(
    (r) => r.json() as Promise<PaymentConfig>,
  );

export interface IntentPayload {
  showtimeId: number;
  seats: string[];
  concessions: { id: number; qty: number }[];
}

export interface IntentResult {
  clientSecret: string;
  amount: number;
}

export interface PaymentError extends Error {
  status?: number;
  conflicts?: string[];
}

export async function createPaymentIntent(
  payload: IntentPayload,
): Promise<IntentResult> {
  const r = await fetch(`${BASE_URL}/payments/intent`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(
      data.error || "Không tạo được phiên thanh toán.",
    ) as PaymentError;
    err.status = r.status;
    err.conflicts = data.conflicts;
    throw err;
  }
  return data as IntentResult;
}
```

- [ ] **Step 3: Thêm query key + hook**

Trong `src/queries/keys.ts`, thêm vào object `qk` (sau `allReviews`):

```ts
  paymentConfig: ["paymentConfig"] as const,
```

Tạo `src/queries/payments.ts`:

```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getPaymentConfig, type PaymentConfig } from "services/payments";
import { qk } from "./keys";

// Cấu hình thanh toán không đổi trong một phiên -> không cần refetch.
export const usePaymentConfig = (): UseQueryResult<PaymentConfig> =>
  useQuery({
    queryKey: qk.paymentConfig,
    queryFn: getPaymentConfig,
    staleTime: Infinity,
  });
```

- [ ] **Step 4: `createBooking` phải ném lỗi khi server từ chối**

Trong `src/services/api.ts`, thay hàm `createBooking` (dòng 69–74) bằng:

```ts
// Gateway có thể từ chối (402 thanh toán chưa hoàn tất, 409 ghế vướng...) — phải ném
// lỗi thay vì trả nguyên body lỗi như thể đó là một Booking.
export const createBooking = async (
  booking: Partial<Booking>,
): Promise<Booking> => {
  const r = await req(`/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Đặt vé thất bại.");
  return data as Booking;
};
```

- [ ] **Step 5: Viết `StripePayForm.tsx`**

Tạo `src/pages/booking/StripePayForm.tsx`:

```tsx
import { useImperativeHandle, useMemo, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { IntentResult } from "services/payments";

export type PayHandle = { pay: () => Promise<void> };

type Props = {
  publishableKey: string;
  amount: number;
  handleRef: MutableRefObject<PayHandle | null>; // đúng kiểu useRef trả về
  createIntent: () => Promise<IntentResult>;
  onPaid: (paymentRef: string) => Promise<void>;
  onError: (message: string) => void;
};

function InnerForm({
  handleRef,
  createIntent,
  onPaid,
  onError,
}: Omit<Props, "publishableKey" | "amount">) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation();

  // Nút bấm duy nhất vẫn là .os-k__cta của OrderSummary -> wizard gọi qua ref này.
  useImperativeHandle(
    handleRef,
    () => ({
      pay: async () => {
        if (!stripe || !elements) return;
        const submit = await elements.submit();
        if (submit.error) {
          onError(submit.error.message || t("booking.payFailed"));
          return;
        }
        // Intent chỉ được tạo ở đây -> bỏ dở giữa chừng không để lại rác.
        const { clientSecret } = await createIntent();
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          clientSecret,
          redirect: "if_required", // giữ người dùng ở lại trang -> hold ghế còn nguyên
        });
        if (error) {
          onError(error.message || t("booking.payDeclined"));
          return;
        }
        if (paymentIntent?.status !== "succeeded") {
          onError(t("booking.payIncomplete"));
          return;
        }
        await onPaid(paymentIntent.id);
      },
    }),
    [stripe, elements, createIntent, onPaid, onError, t],
  );

  return <PaymentElement />;
}

export default function StripePayForm({
  publishableKey,
  amount,
  handleRef,
  createIntent,
  onPaid,
  onError,
}: Props) {
  const { i18n, t } = useTranslation();
  const stripePromise = useMemo(
    () => loadStripe(publishableKey),
    [publishableKey],
  );

  return (
    <div className="pay-k__stripe">
      <Elements
        stripe={stripePromise}
        options={{
          mode: "payment",
          amount,
          currency: "vnd",
          locale: i18n.language === "en" ? "en" : "vi",
          appearance: {
            theme: "night",
            variables: {
              colorPrimary: "#e63030",
              colorBackground: "#151515",
              colorText: "#f5f5f5",
              borderRadius: "0px",
              fontFamily: "'Space Mono', monospace",
            },
          },
        }}
      >
        <InnerForm
          handleRef={handleRef}
          createIntent={createIntent}
          onPaid={onPaid}
          onError={onError}
        />
      </Elements>
      <p className="pay-k__testcard">{t("booking.payTestCard")}</p>
    </div>
  );
}
```

- [ ] **Step 6: Viết lại `PaymentStep.tsx`**

Thay toàn bộ nội dung `src/pages/booking/PaymentStep.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import type { MutableRefObject } from "react";
import type { IntentResult } from "services/payments";
import StripePayForm, { type PayHandle } from "./StripePayForm";

export default function PaymentStep({
  method,
  onChange,
  cardEnabled,
  publishableKey,
  amount,
  payHandleRef,
  createIntent,
  onPaid,
  onError,
}: {
  method: string;
  onChange: (m: string) => void;
  cardEnabled: boolean;
  publishableKey: string;
  amount: number;
  payHandleRef: MutableRefObject<PayHandle | null>;
  createIntent: () => Promise<IntentResult>;
  onPaid: (paymentRef: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  // Chỉ hiện thẻ khi server đã cấu hình Stripe; còn lại luôn có "tại quầy".
  const methods = [
    ...(cardEnabled
      ? [
          {
            key: "card",
            emoji: "💳",
            nameKey: "booking.cardName",
            descKey: "booking.cardDesc",
          },
        ]
      : []),
    {
      key: "counter",
      emoji: "🏦",
      nameKey: "booking.counterName",
      descKey: "booking.counterDesc",
    },
  ];

  return (
    <div className="pay-k">
      <div className="pay-k__head">
        <h2 className="pay-k__title">{t("booking.payTitle")}</h2>
        <p className="pay-k__sub">{t("booking.payDemo")}</p>
      </div>

      <div className="pay-k__methods">
        {methods.map((m) => (
          <label
            key={m.key}
            className={"pay-k__card" + (method === m.key ? " is-picked" : "")}
          >
            <input
              type="radio"
              name="payment"
              value={m.key}
              checked={method === m.key}
              onChange={() => onChange(m.key)}
            />
            <span className="pay-k__emoji" aria-hidden="true">
              {m.emoji}
            </span>
            <span className="pay-k__info">
              <span className="pay-k__name">{t(m.nameKey)}</span>
              <span className="pay-k__desc">{t(m.descKey)}</span>
            </span>
          </label>
        ))}
      </div>

      {cardEnabled && method === "card" && amount > 0 && (
        <StripePayForm
          publishableKey={publishableKey}
          amount={amount}
          handleRef={payHandleRef}
          createIntent={createIntent}
          onPaid={onPaid}
          onError={onError}
        />
      )}

      <p className="pay-k__note">
        {t("booking.payEncrypted", { action: t("booking.pay") })}
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Nối vào `BookingWizard.tsx`**

Thêm import:

```ts
import { usePaymentConfig } from "queries/payments";
import { createPaymentIntent, type PaymentError } from "services/payments";
import type { PayHandle } from "./StripePayForm";
```

Thêm state/ref cạnh các state hiện có (đổi giá trị khởi tạo của `paymentMethod`):

```ts
  const [paymentMethod, setPaymentMethod] = useState("counter");
  const [paying, setPaying] = useState(false);
  const payHandleRef = useRef<PayHandle | null>(null);

  const paymentConfigQ = usePaymentConfig();
  const cardEnabled = paymentConfigQ.data?.enabled === true;
  const publishableKey = paymentConfigQ.data?.publishableKey ?? "";

  // Có cấu hình thẻ thì chọn sẵn thẻ; không thì giữ "tại quầy".
  useEffect(() => {
    if (cardEnabled) setPaymentMethod("card");
  }, [cardEnabled]);
```

Đổi `confirm` để nhận `paymentRef` (chỉ 3 chỗ đổi: chữ ký, payload, và chỗ gọi):

```ts
  const confirm = async (paymentRef?: string) => {
    if (selected.length === 0 || !showtime || !room) return;
    setError("");
    try {
      // Re-check ghế trống ngay trước khi đặt.
      const freshSet = new Set(await getOccupiedSeats(showtimeId));
      const clash = selected.filter((s) => freshSet.has(s.seatNumber));
      if (clash.length) {
        setSelected((prev) => prev.filter((s) => !freshSet.has(s.seatNumber)));
        occupiedQ.refetch();
        setStep(1);
        setError(
          t("booking.clashSeats", {
            seats: clash.map((s) => s.seatNumber).join(", "),
          }),
        );
        return;
      }
```

giữ nguyên phần đếm ghế, rồi trong `createMut.mutateAsync({...})` thêm dòng sau `paymentMethod,`:

```ts
        ...(paymentRef ? { paymentRef } : {}),
```

Thêm 2 hàm mới ngay dưới `confirm`. **Cố ý KHÔNG dùng `useCallback`**: hai hàm này đọc `selected`/`fnb`/`showtime` và được truyền xuống `useImperativeHandle` của `StripePayForm`; memo hoá chúng sẽ đóng băng state của lần render cũ (khi `selected` còn rỗng) và làm `confirm()` thoát sớm. Tạo mới mỗi render là đúng ở đây — handle được dựng lại theo, luôn nhìn thấy state mới nhất.

```ts
  // Chỉ gọi khi bấm "Thanh toán" -> không tạo PaymentIntent thừa.
  const createIntent = async () => {
    try {
      return await createPaymentIntent({
        showtimeId: Number(showtimeId),
        seats: selected.map((s) => s.seatNumber),
        concessions: fnb.map((l) => ({ id: l.id, qty: l.qty })),
      });
    } catch (e) {
      const err = e as PaymentError;
      if (err.conflicts?.length) {
        const clash = new Set(err.conflicts);
        setSelected((prev) => prev.filter((s) => !clash.has(s.seatNumber)));
        occupiedQ.refetch();
        setStep(1);
      }
      throw err;
    }
  };

  const runCardPayment = async () => {
    if (!payHandleRef.current) return;
    setError("");
    setPaying(true);
    try {
      await payHandleRef.current.pay();
    } catch (e) {
      setError((e as Error).message || t("booking.payFailed"));
    } finally {
      setPaying(false);
    }
  };
```

Đổi `onPrimary` bước 3:

```ts
    if (paymentMethod === "card") {
      runCardPayment();
      return;
    }
    confirm();
```

Truyền props mới cho `PaymentStep` và cộng `paying` vào `loading` của `OrderSummary`:

```tsx
            {step === 3 && (
              <PaymentStep
                method={paymentMethod}
                onChange={setPaymentMethod}
                cardEnabled={cardEnabled}
                publishableKey={publishableKey}
                amount={total}
                payHandleRef={payHandleRef}
                createIntent={createIntent}
                onPaid={(paymentRef) => confirm(paymentRef)}
                onError={setError}
              />
            )}
```

```tsx
            loading={createMut.isPending || paying}
```

- [ ] **Step 8: Thêm CSS**

Thêm vào cuối `src/pages/booking/Booking.css`:

```css
/* --- Stripe Payment Element (bước ③) --- */
.pay-k__stripe {
  margin-top: var(--sp-4);
  padding: var(--sp-4);
  background: var(--surface-2);
  border: var(--bw-1) solid var(--border-strong);
}

.pay-k__testcard {
  margin: var(--sp-3) 0 0;
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  color: var(--text-dim);
  letter-spacing: 0.04em;
}
```

Nếu tên biến token không khớp, mở `src/styles/tokens.css` và dùng đúng tên đang có (**không** tự bịa biến mới; lưu ý **không có `--fs-xs`**, nhỏ nhất là `--fs-label`).

- [ ] **Step 9: Cập nhật i18n (cả hai file)**

Trong `src/i18n/locales/vi.json`, namespace `booking`: **xoá** `momoName`, `momoDesc`; sửa/thêm:

```json
    "payDemo": "Thanh toán thẻ chạy trên Stripe ở chế độ thử nghiệm — không có tiền thật nào bị trừ.",
    "cardName": "Thẻ quốc tế (Stripe)",
    "cardDesc": "Visa, Mastercard — chế độ thử nghiệm.",
    "payTestCard": "Thẻ thử: 4242 4242 4242 4242 · hết hạn bất kỳ trong tương lai · CVC bất kỳ",
    "payProcessing": "Đang xử lý thanh toán…",
    "payDeclined": "Thẻ bị từ chối. Vui lòng thử thẻ khác.",
    "payIncomplete": "Thanh toán chưa hoàn tất.",
    "payFailed": "Không thực hiện được thanh toán.",
    "paidBadge": "Đã thanh toán",
```

Trong `src/i18n/locales/en.json`, namespace `booking`: **xoá** `momoName`, `momoDesc`; sửa/thêm:

```json
    "payDemo": "Card payments run on Stripe in test mode — no real money is charged.",
    "cardName": "International card (Stripe)",
    "cardDesc": "Visa, Mastercard — test mode.",
    "payTestCard": "Test card: 4242 4242 4242 4242 · any future expiry · any CVC",
    "payProcessing": "Processing payment…",
    "payDeclined": "Card declined. Please try another card.",
    "payIncomplete": "Payment not completed.",
    "payFailed": "Payment could not be completed.",
    "paidBadge": "Paid",
```

- [ ] **Step 10: Kiểm không còn phương thức `momo` để CHỌN**

Run: `grep -rn "momoName\|momoDesc" src/`
Expected: không có kết quả nào.

**Cố ý GIỮ LẠI:** `METHOD_KEY.momo` trong `src/components/ETicket.tsx:27` và key `tickets.payMomo` trong hai file locale — người dùng trên bản live đã có thể tạo đơn với `paymentMethod: "momo"`, xoá đi thì vé cũ hiện chuỗi thô "momo". Chỉ bỏ *lựa chọn* momo ở bước ③, không bỏ khả năng *hiển thị* nó.

- [ ] **Step 11: Chạy 6 cổng**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`
Expected: xanh, **0 warning**. `npm run e2e` sẽ đỏ ở `booking.spec.ts` (mặc định giờ là thẻ) — **đó là dự kiến, sửa ở Task 6**; ghi rõ trong commit message.

- [ ] **Step 12: Verify bằng mắt trên dev server**

Mở http://localhost:3000, đăng nhập `a@cinema.vn/123456`, đặt tới bước ③.
Expected: có 2 thẻ chọn (Thẻ quốc tế + Tại quầy), chọn Thẻ thì hiện form Stripe tối màu, có dòng gợi ý thẻ thử. Điền `4242 4242 4242 4242`, hạn `12/34`, CVC `123` → bấm "Thanh toán" → ra e-ticket.
Sau đó **xoá đơn test** bằng quyền admin (như Task 4 Step 6).

- [ ] **Step 13: Commit + push**

```bash
git add src package.json package-lock.json
git commit -m "feat(GD4-payment): Payment Element o buoc 3 (services/queries/StripePayForm) + i18n + bo momo"
git push
```

---

### Task 6: Nhãn "Đã thanh toán", e2e, tài liệu

**Files:**
- Modify: `src/components/ETicket.tsx`
- Modify: `src/pages/admin/AdminBookings.tsx`
- Modify: `e2e/booking.spec.ts:58-61`
- Create: `e2e/payment.spec.ts`
- Modify: `playwright.config.ts` (nạp `.env`)
- Modify: `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: `Booking.paymentRef` (Task 1), luồng thẻ hoàn chỉnh (Task 5)
- Produces: không có API mới

- [ ] **Step 1: Hiện nhãn trên vé điện tử**

Trong `src/components/ETicket.tsx`, ô "phương thức thanh toán" nằm ở dòng **84–89**. Thay phần `<span className="eticket-k__value">…</span>` của ô đó bằng:

```tsx
            <span className="eticket-k__value">
              {METHOD_KEY[method] ? t(METHOD_KEY[method]) : method || "—"}
              {booking.paymentRef && (
                <span className="eticket-k__paid">
                  {t("booking.paidBadge")} · {booking.paymentRef}
                </span>
              )}
            </span>
```

`const { t } = useTranslation();` đã có sẵn ở dòng 51 — không cần thêm import. Thêm style vào `src/pages/booking/Booking.css`:

```css
.eticket-k__paid {
  display: block;
  margin-top: var(--sp-1);
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  color: var(--red);
  word-break: break-all;
}
```

- [ ] **Step 2: Hiện nhãn trong admin**

`AdminBookings.tsx` **không có cột phương thức thanh toán**; ô tổng tiền ở dòng **182**. Thay dòng đó bằng:

```tsx
                <td className="num">
                  {formatPrice(b.totalPrice || 0)}
                  {b.paymentRef ? ` · ${t("booking.paidBadge")}` : ""}
                </td>
```

Dùng đúng biến `t` sẵn có của component (i18n ở dự án này là **một namespace phẳng**, nên key đầy đủ `booking.paidBadge` gọi được từ trang admin).

- [ ] **Step 3: Sửa `booking.spec.ts` chọn "Tại quầy"**

Trong `e2e/booking.spec.ts`, thay khối bước ③ (dòng 58–61):

```ts
    // ③ Thanh toán — chọn "Tại quầy" (luồng không qua Stripe) để GHI đơn thật.
    await page.locator(".os-k__cta").click();
    await expect(page.locator(".pay-k")).toBeVisible();
    await page
      .locator(".pay-k__card", { hasText: "Thanh toán tại quầy" })
      .click();
    await page.getByRole("button", { name: "Thanh toán" }).click();
```

- [ ] **Step 4: Cho Playwright đọc `.env`**

Ở đầu `playwright.config.ts`, thêm dòng đầu tiên:

```ts
import "dotenv/config";
```

- [ ] **Step 5: Viết `e2e/payment.spec.ts`**

```ts
import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

// Luồng thanh toán THẺ qua Stripe test-mode (có GHI dữ liệu).
// Tự bỏ qua khi máy/CI không có key => CI không phụ thuộc mạng ra Stripe.
const API = "http://localhost:4000";
const hasStripe = Boolean(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY,
);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL("/");
}

async function deleteBookingAsAdmin(request: APIRequestContext, id: number) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: "admin@cinema.vn", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const del = await request.delete(`${API}/api/bookings/${id}`);
  expect(del.ok()).toBeTruthy();
}

test("thanh toán bằng thẻ Stripe test → e-ticket", async ({ page, request }) => {
  test.skip(!hasStripe, "Thiếu STRIPE_SECRET_KEY/STRIPE_PUBLISHABLE_KEY");
  test.setTimeout(90_000); // iframe Stripe + xác nhận qua mạng

  let createdId: number | null = null;
  try {
    await login(page, "a@cinema.vn", "123456");

    await page.goto("/cinemas");
    await page.locator(".venue-k").last().click();
    await page.locator(".time-k-btn").last().click();
    await expect(page).toHaveURL(/\/seats\/\d+/);

    // ① ghế cuối lưới (tránh đụng test khác chạy song song)
    await expect(page.locator(".seatmap-k__grid")).toBeVisible();
    await page.locator(".seatmap-k__seat:not(.is-booked)").last().click();

    // ② bỏ qua bắp nước
    await page.locator(".os-k__cta").click();
    await expect(page.locator(".fnb-k, .fnb-k__msg").first()).toBeVisible();

    // ③ thẻ
    await page.locator(".os-k__cta").click();
    await expect(page.locator(".pay-k")).toBeVisible();
    await page.locator(".pay-k__card", { hasText: "Stripe" }).click();
    await expect(page.locator(".pay-k__stripe")).toBeVisible();

    // Payment Element dựng nhiều iframe; iframe nhập liệu có title cố định này.
    const frame = page.frameLocator('iframe[title="Secure payment input frame"]');
    await frame.getByPlaceholder("1234 1234 1234 1234").fill("4242424242424242");
    await frame.getByPlaceholder("MM / YY").fill("12 / 34");
    await frame.getByPlaceholder("CVC").fill("123");

    await page.getByRole("button", { name: "Thanh toán" }).click();

    // ④ vé điện tử
    await expect(page.locator(".ticket-k__successtitle")).toBeVisible({
      timeout: 45_000,
    });
    const code = await page.locator(".eticket-k__code").first().innerText();
    expect(code).toMatch(/N°TK-\d{5}/);
    createdId = Number(code.replace(/\D/g, ""));
    await expect(page.locator(".eticket-k__paid")).toContainText("pi_");
  } finally {
    if (createdId) await deleteBookingAsAdmin(request, createdId);
  }
});
```

- [ ] **Step 6: Chạy e2e**

Run: `npm run e2e`
Expected: 20 test — 19 cũ xanh + `payment.spec.ts` xanh (nếu có key) hoặc **skipped** (nếu không).
Nếu selector iframe không khớp (Stripe đổi placeholder), chụp `npx playwright test e2e/payment.spec.ts --debug` để lấy tên field thật rồi sửa; **đừng** đổi các selector `.pay-k*` của mình.

- [ ] **Step 7: Verify prod-mode build còn chạy**

```bash
npm run build
```

Expected: xanh. (Không cần chạy `start:prod` — key Stripe được đọc lúc runtime, `build` chỉ cần biên dịch.)

- [ ] **Step 8: Cập nhật `CLAUDE.md`**

Sửa 4 chỗ:
1. Mục kiến trúc `server/src/` — thêm gạch đầu dòng cho `payments/*` (quote/verify thuần, stripe lazy, amount tra DB, settle dùng trong gateway; router `/api/payments` với `GET /config` + `POST /intent`).
2. Dòng mount order — thêm `/api/payments` vào chuỗi.
3. Mục Booking flow — nói rõ bước ③ có 2 phương thức, thẻ chạy Stripe test-mode với Payment Element deferred + `redirect:"if_required"`, server tự tính tiền và verify intent, `paymentRef @unique` chống trùng đơn.
4. Mục Testing — `e2e/` giờ có **bốn** file; `payment.spec.ts` tự skip khi thiếu key.

- [ ] **Step 9: Cập nhật `README.md`**

Thêm vào mục biến môi trường: `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` (tuỳ chọn — thiếu thì phương thức thẻ tự ẩn), và một đoạn ngắn "Thanh toán sandbox" nói rõ đây là Stripe **test-mode**, thẻ thử `4242 4242 4242 4242`, không có tiền thật.

- [ ] **Step 10: Chạy đủ 6 cổng lần cuối**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build && npm run e2e`
Expected: tất cả xanh, lint 0 warning.

- [ ] **Step 11: Chụp màn hình cho người dùng duyệt**

Viết script `shot.mjs` **trong thư mục project** (để resolve được `@playwright/test`), chụp bước ③ ở desktop 1280×800 và mobile 390×844 (đăng nhập → tới bước ③ → chọn thẻ), rồi **xoá `shot.mjs` trước khi commit** (Prettier quét cả file gốc). Dùng `--virtual-time-budget`/chờ AppShell qua splash. Đưa ảnh cho người dùng review qua Artifact (họ xem bằng điện thoại).

- [ ] **Step 12: Commit + push**

```bash
git add src e2e playwright.config.ts CLAUDE.md README.md
git commit -m "feat(GD4-payment): nhan Da thanh toan o ve/admin + e2e payment (skip khi thieu key) + cap nhat CLAUDE/README"
git push
```

---

## Sau khi xong

- Nhắc người dùng thêm `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` vào **Environment của service trên Render** để bản live bật được thẻ (migration `booking_payment_ref` tự áp khi container khởi động).
- Cập nhật memory `professionalization-roadmap` mục GĐ4: tính năng 5 xong, còn lại email vé.
