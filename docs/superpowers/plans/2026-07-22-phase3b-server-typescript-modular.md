# GĐ3b — Server → TypeScript + tách module (vẫn nền json-server) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Viết lại `server/auth-server.js` (388 dòng, CommonJS) thành các **module TypeScript** dưới `server/src/`, **giữ NGUYÊN 100% hành vi** — vẫn đọc/ghi dữ liệu qua **json-server** (`fetch(DATA_URL)`). Cô lập việc "TS-hoá + tách module" khỏi việc "đổi sang Prisma" (lát 3c).

**Architecture:** Tách theo trách nhiệm: `env` (đọc/validate env) · `auth/*` (tokens, cookies, helpers, data-access user, middleware, routes) · `api/*` (forward proxy, holds in-memory, occupied-seats, gateway phân quyền) · `app.ts` (ráp) · `index.ts` (listen). **Tầng data-access** (`auth/users.ts` + `api/forward.ts`) là **đường nối (seam)** mà 3c sẽ thay ruột bằng Prisma — route/middleware/cookie/holds giữ nguyên. Không lát nào trước 5 chạy code mới (app cũ `auth-server.js` vẫn phục vụ :4000 tới Task 5 mới flip) ⇒ app luôn xanh.

**Tech Stack:** TypeScript 5.7 (chạy dev bằng `tsx`), Express 5, jsonwebtoken, bcryptjs, cookie-parser, cors, express-rate-limit. **Không có Prisma trong lát này.**

## Global Constraints

- **Node 22**; **6 cổng CI xanh, lint 0 warning**.
- **HỢP ĐỒNG HTTP BẤT BIẾN** — mọi endpoint/status/shape/copy tiếng Việt **giống hệt** `auth-server.js`. Đây là bất biến của lát. Danh mục contract (client dựa vào — `src/services/api.ts`, `auth.ts`):
  - **Auth** (`:4000`): `POST /auth/register|login|logout|refresh` · `GET /auth/me`. login rate-limit 10 SAI/IP/15' (`skipSuccessfulRequests`). Trả `safeUser` = `{id,fullName,email,role}`. Cookie `at`(15m)/`rt`(7d hoặc phiên) httpOnly SameSite=Lax.
  - **Gateway** (`:4000/api`): thứ tự route **`/api/occupied-seats` → `/api/holds` → catch-all `/api`**. Filter client gửi: `?movieId= ?roomId= ?cityId= ?cinemaId= ?showtimeId=` + `?email=` (nội bộ auth). Quy tắc: catalog(`movies/showtimes/cinemas/cities/rooms/concessions`) read công khai, write admin; `users` admin-only; `bookings` GET scoped theo caller (POST ép userId + nhả hold, PATCH/DELETE admin); `occupied-seats` cần đăng nhập; `holds` POST(409 conflicts)/DELETE cần đăng nhập.
- **Giữ json-server + DATA_URL** (gỡ ở 3c). **Giữ `server/hash-passwords.js`** nguyên (.js, ngoài phạm vi).
- **Bí mật** không commit. TTL/secret/logic y nguyên.
- **Express 5 + TS strict:** handler KHÔNG được `return res.json(...)` (Response ≠ void). Dùng mẫu **`res.status(x).json(y); return;`** (tách câu) ở mọi guard sớm.

## File Structure

Tạo mới dưới `server/src/` (tsconfig `server/tsconfig.json` đã include `src/**/*.ts` + typecheck đã wired ở 3a):
- `server/src/env.ts` — đọc `.env` (dotenv) + hằng số + guard `JWT_SECRET`.
- `server/src/types.ts` — `DbUser`, `SafeUser`, `ReqUser`.
- `server/src/auth/helpers.ts` — `normalizeEmail`, `safeUser` (thuần).
- `server/src/auth/tokens.ts` — `signAccess`, `signRefresh`, `verifyToken`.
- `server/src/auth/cookies.ts` — `setAuthCookies`, `clearAuthCookies`.
- `server/src/auth/users.ts` — **SEAM**: `findUserByEmail/ById`, `createUser`, `updateUserPassword` (fetch json-server).
- `server/src/auth/middleware.ts` — `getUserFromReq`.
- `server/src/auth/routes.ts` — `authRouter` (5 endpoint + loginLimiter).
- `server/src/api/forward.ts` — **SEAM**: `forward(req,res,rest,extraQuery)` proxy json-server.
- `server/src/api/holds.ts` — store in-memory + `holdsRouter` (`POST`/`DELETE /`) + export `releaseHolds`, `heldByOthers`.
- `server/src/api/occupied.ts` — `occupiedRouter` (`GET /`).
- `server/src/api/gateway.ts` — `gatewayRouter` (catch-all `/api` phân quyền).
- `server/src/app.ts` — ráp express, mount theo thứ tự, `export const app`.
- `server/src/index.ts` — `app.listen(PORT)`.

Sửa (Task 5):
- `package.json` — `"auth": "tsx server/src/index.ts"`; thêm `@types/*` devDeps.
- `.claude/start-dev.ps1` — dòng 28 `node server/auth-server.js` → `npm run auth`.
- Xoá `server/auth-server.js`.

---

## Task 1: Nền tảng — env, types, tokens, cookies, helpers

Các module thuần/hạ tầng không phụ thuộc Express routing. Deliverable: typecheck sạch (module chưa dùng nhưng compile được); test đơn vị cho helper thuần.

**Files:**
- Create: `server/src/env.ts`, `server/src/types.ts`, `server/src/auth/helpers.ts`, `server/src/auth/tokens.ts`, `server/src/auth/cookies.ts`
- Create test: `server/src/auth/helpers.test.ts`
- Modify: `package.json` (thêm `@types/express @types/cors @types/cookie-parser @types/jsonwebtoken`)

**Interfaces:**
- Produces:
  - `env.ts`: `PORT:number, DATA_URL:string, WEB_ORIGIN:string, JWT_SECRET:string, ACCESS_TTL:string, REFRESH_TTL:string, REFRESH_TTL_DAYS:number, HOLD_TTL_MS:number`
  - `types.ts`: `DbUser{id:number,fullName:string,email:string,password:string,role?:string}`, `SafeUser{id,fullName,email,role:string}`, `ReqUser{id:number,role:string}`
  - `helpers.ts`: `normalizeEmail(e?:string):string`, `safeUser(u:DbUser):SafeUser`
  - `tokens.ts`: `signAccess(id:number,role:string):string`, `signRefresh(id:number,remember:boolean):string`, `verifyToken(token:string):jwt.JwtPayload`
  - `cookies.ts`: `setAuthCookies(res:Response,user:{id:number;role?:string},remember:boolean):void`, `clearAuthCookies(res:Response):void`

- [ ] **Step 1: Cài @types**

```bash
npm install -D @types/express @types/cors @types/cookie-parser @types/jsonwebtoken
```
(bcryptjs 3.x + express-rate-limit tự kèm type; nếu typecheck báo thiếu type bcryptjs → `npm i -D @types/bcryptjs`.)

- [ ] **Step 2: `server/src/env.ts`**

```ts
import "dotenv/config"; // nạp .env trước khi đọc process.env

export const PORT = Number(process.env.AUTH_PORT) || 4000;
export const DATA_URL = process.env.DATA_URL || "http://localhost:9999";
export const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

// Dev only: giữ bí mật trong env ở production. Đổi secret => mọi phiên cũ hết hiệu lực.
const DEFAULT_SECRET = "cinema-dev-secret-change-me";
export const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
if (JWT_SECRET === DEFAULT_SECRET) {
  const msg =
    "[auth] Đang dùng JWT_SECRET mặc định — chỉ chấp nhận khi dev. Đặt JWT_SECRET trong .env cho production.";
  if (process.env.NODE_ENV === "production") throw new Error(msg);
  console.warn(msg);
}

export const ACCESS_TTL = "15m";
export const REFRESH_TTL_DAYS = 7;
export const REFRESH_TTL = `${REFRESH_TTL_DAYS}d`;
export const HOLD_TTL_MS = 8 * 60 * 1000; // 8 phút — khớp đồng hồ giữ ghế client
```

- [ ] **Step 3: `server/src/types.ts`**

```ts
export interface DbUser {
  id: number;
  fullName: string;
  email: string;
  password: string;
  role?: string;
}

export interface SafeUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

export interface ReqUser {
  id: number;
  role: string;
}
```

- [ ] **Step 4: `server/src/auth/helpers.ts`**

```ts
import type { DbUser, SafeUser } from "../types";

export const normalizeEmail = (e?: string): string =>
  (e || "").trim().toLowerCase();

export const safeUser = (u: DbUser): SafeUser => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  role: u.role || "user",
});
```

- [ ] **Step 5: `server/src/auth/tokens.ts`**

```ts
import jwt from "jsonwebtoken";
import { JWT_SECRET, ACCESS_TTL, REFRESH_TTL } from "../env";

export const signAccess = (id: number, role: string): string =>
  jwt.sign({ sub: id, role }, JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  } as jwt.SignOptions);

export const signRefresh = (id: number, remember: boolean): string =>
  jwt.sign({ sub: id, remember }, JWT_SECRET, {
    expiresIn: REFRESH_TTL,
  } as jwt.SignOptions);

export const verifyToken = (token: string): jwt.JwtPayload =>
  jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
```

- [ ] **Step 6: `server/src/auth/cookies.ts`**

```ts
import type { Response } from "express";
import { signAccess, signRefresh } from "./tokens";
import { REFRESH_TTL_DAYS } from "../env";

// secure:false vì localhost http (3d sẽ bật secure ở production).
const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,
  path: "/",
};

export function setAuthCookies(
  res: Response,
  user: { id: number; role?: string },
  remember: boolean,
): void {
  const access = signAccess(user.id, user.role || "user");
  const refresh = signRefresh(user.id, !!remember);
  // access: cookie phiên; JWT tự hết hạn sau 15'
  res.cookie("at", access, { ...baseCookie });
  // refresh: "ghi nhớ" => bền (maxAge), không thì cookie phiên
  res.cookie("rt", refresh, {
    ...baseCookie,
    ...(remember ? { maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000 } : {}),
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie("at", baseCookie);
  res.clearCookie("rt", baseCookie);
}
```

- [ ] **Step 7: Test helper thuần `server/src/auth/helpers.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { normalizeEmail, safeUser } from "./helpers";

describe("normalizeEmail", () => {
  it("trim + lowercase", () => {
    expect(normalizeEmail("  Admin@Cinema.VN ")).toBe("admin@cinema.vn");
  });
  it("undefined -> chuỗi rỗng", () => {
    expect(normalizeEmail()).toBe("");
  });
});

describe("safeUser", () => {
  it("chỉ lộ id/fullName/email/role, không lộ password", () => {
    const out = safeUser({
      id: 2,
      fullName: "Admin",
      email: "admin@cinema.vn",
      password: "$2b$hash",
      role: "admin",
    });
    expect(out).toEqual({
      id: 2,
      fullName: "Admin",
      email: "admin@cinema.vn",
      role: "admin",
    });
    expect("password" in out).toBe(false);
  });
  it("thiếu role -> mặc định 'user'", () => {
    const out = safeUser({
      id: 3,
      fullName: "X",
      email: "x@y.z",
      password: "p",
    });
    expect(out.role).toBe("user");
  });
});
```

> **Lưu ý Vitest:** config include `src/**/*.{test,spec}.{ts,tsx}` (thư mục `src` GỐC repo). File này ở `server/src/` — **nằm ngoài** include ⇒ vitest KHÔNG chạy nó. Sửa: mở rộng include trong `vite.config.mjs` khối `test` thành `["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.ts"]`. Làm ở Step 8.

- [ ] **Step 8: Mở rộng Vitest include** (`vite.config.mjs`)

Tìm khối `test: { ... include: [...] }` và thêm `"server/**/*.{test,spec}.ts"`:
```js
    include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.ts"],
```
(Nếu chưa có `include` tường minh, thêm dòng trên vào khối `test`.)

- [ ] **Step 9: Chạy test + typecheck + lint**

```bash
npm run test:run   # phải thấy helpers.test.ts chay + PASS (3 test moi)
npm run typecheck  # tsc root + tsc -p server (env/types/helpers/tokens/cookies compile)
npm run lint
npm run format
```
Expected: test tăng lên **68** (65 + 3). typecheck/lint sạch. Nếu tokens.ts lỗi type `expiresIn` → đã cast `as jwt.SignOptions`; nếu vẫn lỗi, kiểm `@types/jsonwebtoken` đã cài.

- [ ] **Step 10: Commit**

```bash
git add server/src package.json package-lock.json vite.config.mjs
git commit -m "feat(GD3b/1): nen tang server TS — env/types/tokens/cookies/helpers (+test)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Auth data-access + middleware + routes

Cổng `/auth/*` đầy đủ, vẫn đọc user qua json-server. Deliverable: typecheck sạch; router compile (chưa mount — app cũ vẫn chạy).

**Files:**
- Create: `server/src/auth/users.ts`, `server/src/auth/middleware.ts`, `server/src/auth/routes.ts`

**Interfaces:**
- Consumes: `env` (DATA_URL), `helpers` (normalizeEmail/safeUser), `tokens` (verifyToken), `cookies` (set/clear), `types` (DbUser/ReqUser).
- Produces:
  - `users.ts`: `findUserByEmail(email:string):Promise<DbUser|null>`, `findUserById(id:number|string):Promise<DbUser|null>`, `createUser(data:{fullName;email;password;role:string}):Promise<DbUser>`, `updateUserPassword(id:number,password:string):Promise<void>`
  - `middleware.ts`: `getUserFromReq(req:Request):ReqUser|null`
  - `routes.ts`: `authRouter:Router`

- [ ] **Step 1: `server/src/auth/users.ts`** (SEAM — 3c thay ruột bằng Prisma)

```ts
import { DATA_URL } from "../env";
import type { DbUser } from "../types";

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const r = await fetch(`${DATA_URL}/users?email=${encodeURIComponent(email)}`);
  const list = (await r.json()) as DbUser[];
  return list[0] || null;
}

export async function findUserById(
  id: number | string,
): Promise<DbUser | null> {
  const r = await fetch(`${DATA_URL}/users/${id}`);
  if (!r.ok) return null;
  return (await r.json()) as DbUser;
}

export async function createUser(data: {
  fullName: string;
  email: string;
  password: string;
  role: string;
}): Promise<DbUser> {
  const r = await fetch(`${DATA_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return (await r.json()) as DbUser;
}

export async function updateUserPassword(
  id: number,
  password: string,
): Promise<void> {
  await fetch(`${DATA_URL}/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}
```

- [ ] **Step 2: `server/src/auth/middleware.ts`**

```ts
import type { Request } from "express";
import { verifyToken } from "./tokens";
import type { ReqUser } from "../types";

// Đọc user từ access cookie (không ném lỗi nếu thiếu/hết hạn -> trả null).
export function getUserFromReq(req: Request): ReqUser | null {
  const t = req.cookies?.at as string | undefined;
  if (!t) return null;
  try {
    const p = verifyToken(t);
    return { id: p.sub as number, role: p.role as string };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: `server/src/auth/routes.ts`** (port nguyên hành vi; mẫu `res...; return;`)

```ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { normalizeEmail, safeUser } from "./helpers";
import { setAuthCookies, clearAuthCookies } from "./cookies";
import { verifyToken } from "./tokens";
import {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserPassword,
} from "./users";

export const authRouter: Router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, // 10 lần đăng nhập SAI / IP / 15'
  skipSuccessfulRequests: true, // chỉ đếm login thất bại (đúng ý brute-force)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều lần thử. Vui lòng đợi rồi thử lại." },
});

authRouter.post("/register", async (req, res) => {
  try {
    const fullName = (req.body.fullName || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    if (!fullName || !email || !password) {
      res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự." });
      return;
    }
    if (await findUserByEmail(email)) {
      res.status(409).json({ error: "Email này đã được đăng ký." });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await createUser({
      fullName,
      email,
      password: hash,
      role: "user",
    });
    setAuthCookies(res, user, false);
    res.status(201).json(safeUser(user));
  } catch {
    res.status(500).json({ error: "Đăng ký thất bại. Vui lòng thử lại." });
  }
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    const remember = !!req.body.remember;
    const user = await findUserByEmail(email);
    // Thông báo chung chung (không tiết lộ email có tồn tại hay không)
    if (!user || !user.password) {
      res.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
      return;
    }
    // Hỗ trợ seed cũ (plaintext): so sánh thẳng rồi nâng cấp bcrypt.
    let ok: boolean;
    if (typeof user.password === "string" && user.password.startsWith("$2")) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      ok = user.password === password;
      if (ok) {
        const hash = await bcrypt.hash(password, 10);
        await updateUserPassword(user.id, hash);
      }
    }
    if (!ok) {
      res.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
      return;
    }
    setAuthCookies(res, user, remember);
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ error: "Đăng nhập thất bại. Vui lòng thử lại." });
  }
});

authRouter.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.rt as string | undefined;
    if (!token) {
      res.status(401).json({ error: "Phiên đã hết hạn." });
      return;
    }
    const payload = verifyToken(token);
    const user = await findUserById(payload.sub as number);
    if (!user) {
      res.status(401).json({ error: "Phiên đã hết hạn." });
      return;
    }
    setAuthCookies(res, user, !!payload.remember); // giữ chế độ ghi nhớ
    res.json(safeUser(user));
  } catch {
    clearAuthCookies(res);
    res.status(401).json({ error: "Phiên đã hết hạn." });
  }
});

authRouter.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.at as string | undefined;
    if (!token) {
      res.status(401).json({ error: "Chưa đăng nhập." });
      return;
    }
    const payload = verifyToken(token);
    const user = await findUserById(payload.sub as number);
    if (!user) {
      res.status(401).json({ error: "Chưa đăng nhập." });
      return;
    }
    res.json(safeUser(user));
  } catch {
    res.status(401).json({ error: "Phiên truy cập đã hết hạn." });
  }
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.status(204).end();
});
```

- [ ] **Step 4: typecheck + lint + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add server/src/auth
git commit -m "feat(GD3b/2): auth routes TS (data-access user + middleware + /auth/*) — van nen json-server

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: sạch. (Router chưa mount — chưa ảnh hưởng runtime.)

---

## Task 3: Gateway data-access, holds in-memory, occupied-seats

**Files:**
- Create: `server/src/api/forward.ts`, `server/src/api/holds.ts`, `server/src/api/occupied.ts`

**Interfaces:**
- Consumes: `env` (DATA_URL), `auth/middleware` (getUserFromReq).
- Produces:
  - `forward.ts`: `forward(req:Request,res:Response,rest:string,extraQuery?:Record<string,string|number>):Promise<void>`
  - `holds.ts`: `holdsRouter:Router`, `releaseHolds(showtimeId:string|number,userId:number):void`, `heldByOthers(showtimeId:string|number,userId:number):string[]`
  - `occupied.ts`: `occupiedRouter:Router`

- [ ] **Step 1: `server/src/api/forward.ts`** (SEAM — proxy json-server)

```ts
import type { Request, Response } from "express";
import { DATA_URL } from "../env";

// Chuyển tiếp request sang json-server, giữ query + body + status + header cần thiết.
export async function forward(
  req: Request,
  res: Response,
  rest: string,
  extraQuery?: Record<string, string | number>,
): Promise<void> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query))
    params.set(k, String(v as string));
  if (extraQuery)
    for (const [k, v] of Object.entries(extraQuery)) params.set(k, String(v));
  const qs = params.toString();
  const url = `${DATA_URL}/${rest}${qs ? `?${qs}` : ""}`;
  const init: RequestInit = { method: req.method, headers: {} };
  if (!["GET", "HEAD", "DELETE"].includes(req.method)) {
    (init.headers as Record<string, string>)["Content-Type"] =
      "application/json";
    init.body = JSON.stringify(req.body || {});
  }
  const r = await fetch(url, init);
  const body = await r.text();
  res.status(r.status);
  const ct = r.headers.get("content-type");
  if (ct) res.set("Content-Type", ct);
  const xtc = r.headers.get("x-total-count");
  if (xtc) res.set("X-Total-Count", xtc);
  res.send(body);
}
```

- [ ] **Step 2: `server/src/api/holds.ts`** (in-memory + routes)

```ts
import { Router } from "express";
import { getUserFromReq } from "../auth/middleware";
import { HOLD_TTL_MS } from "../env";

// Map<showtimeId(string), Map<seatNumber, { userId, expiresAt }>>.
type Hold = { userId: number; expiresAt: number };
const holds = new Map<string, Map<string, Hold>>();

// Lấy map ghế của 1 suất sau khi dọn hold hết hạn (tạo nếu chưa có).
function seatHolds(showtimeId: string | number): Map<string, Hold> {
  const key = String(showtimeId);
  let m = holds.get(key);
  if (!m) {
    m = new Map();
    holds.set(key, m);
  }
  const now = Date.now();
  for (const [seat, h] of m) if (h.expiresAt <= now) m.delete(seat);
  return m;
}

// Ghế đang bị NGƯỜI KHÁC (khác userId) giữ ở 1 suất.
export function heldByOthers(
  showtimeId: string | number,
  userId: number,
): string[] {
  const out: string[] = [];
  for (const [seat, h] of seatHolds(showtimeId))
    if (h.userId !== userId) out.push(seat);
  return out;
}

// Đặt lại toàn bộ ghế user giữ ở suất = danh sách seats, gia hạn TTL (kiêm heartbeat).
function setHolds(
  showtimeId: string | number,
  userId: number,
  seats: string[],
): number {
  const m = seatHolds(showtimeId);
  for (const [seat, h] of m) if (h.userId === userId) m.delete(seat);
  const expiresAt = Date.now() + HOLD_TTL_MS;
  seats.forEach((s) => m.set(s, { userId, expiresAt }));
  return expiresAt;
}

// Nhả toàn bộ hold của user ở 1 suất.
export function releaseHolds(
  showtimeId: string | number,
  userId: number,
): void {
  const m = seatHolds(showtimeId);
  for (const [seat, h] of m) if (h.userId === userId) m.delete(seat);
}

export const holdsRouter: Router = Router();

// Giữ ghế: đặt/gia hạn danh sách ghế (kiêm heartbeat).
holdsRouter.post("/", (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Vui lòng đăng nhập." });
    return;
  }
  const showtimeId = req.body.showtimeId;
  const seats: string[] = Array.isArray(req.body.seats) ? req.body.seats : [];
  if (!showtimeId) {
    res.status(400).json({ error: "Thiếu showtimeId." });
    return;
  }
  const others = new Set(heldByOthers(showtimeId, user.id));
  const conflicts = seats.filter((s) => others.has(s));
  if (conflicts.length) {
    res.status(409).json({ error: "Ghế vừa bị người khác giữ.", conflicts });
    return;
  }
  const expiresAt = setHolds(showtimeId, user.id, seats);
  res.json({ ok: true, expiresAt });
});

// Nhả ghế đang giữ của user cho 1 suất.
holdsRouter.delete("/", (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Vui lòng đăng nhập." });
    return;
  }
  const showtimeId = req.query.showtimeId as string | undefined;
  if (!showtimeId) {
    res.status(400).json({ error: "Thiếu showtimeId." });
    return;
  }
  releaseHolds(showtimeId, user.id);
  res.status(204).end();
});
```

- [ ] **Step 3: `server/src/api/occupied.ts`**

```ts
import { Router } from "express";
import { getUserFromReq } from "../auth/middleware";
import { heldByOthers } from "./holds";
import { DATA_URL } from "../env";

type Booking = { showtimeId: number | string; seats?: string[] };
type Showtime = { bookedSeats?: string[] };

export const occupiedRouter: Router = Router();

// Ghế đã đặt của 1 suất: đã bán (booking + showtime.bookedSeats) + ghế người khác đang giữ.
occupiedRouter.get("/", async (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Vui lòng đăng nhập." });
    return;
  }
  const showtimeId = req.query.showtimeId as string | undefined;
  if (!showtimeId) {
    res.status(400).json({ error: "Thiếu showtimeId." });
    return;
  }
  try {
    const [bookings, stRes] = await Promise.all([
      fetch(`${DATA_URL}/bookings`).then((r) => r.json() as Promise<Booking[]>),
      fetch(`${DATA_URL}/showtimes/${showtimeId}`),
    ]);
    const showtime = stRes.ok ? ((await stRes.json()) as Showtime) : null;
    const set = new Set<string>(showtime?.bookedSeats || []);
    bookings
      .filter((b) => String(b.showtimeId) === String(showtimeId))
      .forEach((b) => (b.seats || []).forEach((s) => set.add(s)));
    heldByOthers(showtimeId, user.id).forEach((s) => set.add(s));
    res.json({ showtimeId: Number(showtimeId), seats: [...set] });
  } catch {
    res.status(502).json({ error: "Lỗi cổng dữ liệu." });
  }
});
```

- [ ] **Step 4: typecheck + lint + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add server/src/api
git commit -m "feat(GD3b/3): gateway data-access (forward) + holds in-memory + occupied-seats TS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Gateway phân quyền (catch-all /api)

**Files:**
- Create: `server/src/api/gateway.ts`

**Interfaces:**
- Consumes: `forward`, `auth/middleware` (getUserFromReq), `holds` (releaseHolds).
- Produces: `gatewayRouter:Router` (dùng làm `app.use("/api", gatewayRouter)`).

- [ ] **Step 1: `server/src/api/gateway.ts`** (port quy tắc y nguyên)

```ts
import { Router } from "express";
import { forward } from "./forward";
import { getUserFromReq } from "../auth/middleware";
import { releaseHolds } from "./holds";

// Catalog: đọc công khai, ghi cần admin.
const PUBLIC_READ = new Set([
  "movies",
  "showtimes",
  "cinemas",
  "cities",
  "rooms",
  "concessions",
]);

export const gatewayRouter: Router = Router();

gatewayRouter.use(async (req, res) => {
  try {
    const rest = req.path.replace(/^\/+/, ""); // vd "movies/3" | "bookings"
    const collection = rest.split("/")[0];
    const isRead = req.method === "GET";
    const user = getUserFromReq(req);
    const isAdmin = user?.role === "admin";
    const deny = (code: number, msg: string) =>
      res.status(code).json({ error: msg });

    // users: chỉ admin (đang lộ email + hash nếu mở)
    if (collection === "users") {
      if (!isAdmin) return deny(403, "Không có quyền truy cập.");
      return void (await forward(req, res, rest));
    }

    // bookings: theo chủ sở hữu
    if (collection === "bookings") {
      if (isRead) {
        if (!user) return deny(401, "Vui lòng đăng nhập.");
        if (isAdmin) return void (await forward(req, res, rest));
        if (rest !== "bookings") return deny(403, "Không có quyền."); // chặn đọc đơn lẻ của người khác
        return void (await forward(req, res, rest, { userId: user.id })); // chỉ đơn của mình
      }
      if (req.method === "POST") {
        if (!user) return deny(401, "Vui lòng đăng nhập.");
        req.body = { ...req.body, userId: user.id }; // ép userId = chính mình
        const stId = req.body.showtimeId;
        await forward(req, res, rest);
        if (stId != null) releaseHolds(stId, user.id); // đặt xong -> nhả hold của mình
        return;
      }
      if (!isAdmin) return deny(403, "Không có quyền."); // PATCH/DELETE
      return void (await forward(req, res, rest));
    }

    // catalog
    if (PUBLIC_READ.has(collection)) {
      if (isRead) return void (await forward(req, res, rest));
      if (!isAdmin) return deny(403, "Không có quyền.");
      return void (await forward(req, res, rest));
    }

    return deny(403, "Không có quyền."); // mặc định chặn
  } catch {
    res.status(502).json({ error: "Lỗi cổng dữ liệu." });
  }
});
```

> **Chú ý porting:** bản JS dùng `return forward(...)` (trả Promise). Ở TS handler `void`, ta bọc `return void (await forward(...))` để vừa chờ vừa thoả kiểu. `deny` trả Response — dùng ở `return deny(...)` cũng vướng `void`; **sửa:** đổi `deny` không `return` được → dùng mẫu `deny(...); return;`. Xem Step 2.

- [ ] **Step 2: Sửa `deny`/`return` cho hợp kiểu void**

Trong `gateway.ts`, đổi mọi `return deny(code,msg)` thành `{ deny(code, msg); return; }` và giữ `deny` là:
```ts
    const deny = (code: number, msg: string): void => {
      res.status(code).json({ error: msg });
    };
```
Ví dụ:
```ts
    if (collection === "users") {
      if (!isAdmin) {
        deny(403, "Không có quyền truy cập.");
        return;
      }
      await forward(req, res, rest);
      return;
    }
```
Áp dụng đồng nhất cho mọi nhánh (users/bookings/catalog/default). **Hành vi giữ nguyên** — chỉ đổi cú pháp để hợp TS. Sau khi sửa, chạy `npm run typecheck` tới khi sạch.

- [ ] **Step 3: typecheck + lint + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add server/src/api/gateway.ts
git commit -m "feat(GD3b/4): gateway phan quyen /api (catalog/users/bookings) TS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Ráp app + flip sang tsx + xoá auth-server.js + verify tích hợp

Đây là bước **flip**: mount router theo đúng thứ tự, đổi `npm run auth` sang tsx, xoá JS cũ, restart :4000, verify toàn bộ contract + e2e.

**Files:**
- Create: `server/src/app.ts`, `server/src/index.ts`
- Modify: `package.json` (`"auth"`), `.claude/start-dev.ps1` (dòng 28)
- Delete: `server/auth-server.js`

**Interfaces:**
- Consumes: `authRouter`, `occupiedRouter`, `holdsRouter`, `gatewayRouter`, `env` (PORT/WEB_ORIGIN).

- [ ] **Step 1: `server/src/app.ts`** (thứ tự mount BẮT BUỘC)

```ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { WEB_ORIGIN } from "./env";
import { authRouter } from "./auth/routes";
import { occupiedRouter } from "./api/occupied";
import { holdsRouter } from "./api/holds";
import { gatewayRouter } from "./api/gateway";

export const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));

app.use("/auth", authRouter);

// Routes riêng PHẢI khai báo trước catch-all "/api" (Express match theo thứ tự).
app.use("/api/occupied-seats", occupiedRouter);
app.use("/api/holds", holdsRouter);
app.use("/api", gatewayRouter);
```

- [ ] **Step 2: `server/src/index.ts`**

```ts
import { app } from "./app";
import { PORT, DATA_URL, WEB_ORIGIN } from "./env";

app.listen(PORT, () => {
  console.log(
    `Auth server chạy tại http://localhost:${PORT} (data: ${DATA_URL}, web: ${WEB_ORIGIN})`,
  );
});
```

- [ ] **Step 3: Đổi script `auth` + hook**

`package.json`:
```json
"auth": "tsx server/src/index.ts",
```
`.claude/start-dev.ps1` dòng 28: đổi `node server/auth-server.js` → `npm run auth`; cập nhật comment dòng 25 (`server/src/index.ts`).

- [ ] **Step 4: Xoá server cũ + restart :4000**

```bash
git rm server/auth-server.js
# Kill listener :4000 (server cu), khoi dong ban tsx:
netstat -ano | grep :4000 | grep LISTENING   # lay PID
# taskkill //PID <PID> //F
npm run auth   # chay nen (tsx server/src/index.ts) — cho log "Auth server chay tai..."
```
> Kill PID :4000 rồi chạy `npm run auth` ở tiến trình nền. Xác nhận log khởi động + không lỗi.

- [ ] **Step 5: Smoke API bằng curl** (verify contract y hệt bản JS)

Chạy (server tsx :4000 + json-server :9999 đang chạy):
```bash
# 1) catalog public read
curl -s localhost:4000/api/movies | head -c 80; echo
curl -s localhost:4000/api/movies/1 | head -c 80; echo
curl -s "localhost:4000/api/showtimes?movieId=1" | head -c 80; echo
curl -s "localhost:4000/api/cinemas?cityId=1" | head -c 80; echo
curl -s "localhost:4000/api/rooms?cinemaId=1" | head -c 80; echo
# 2) chua dang nhap -> 401
curl -s -o /dev/null -w "%{http_code}\n" localhost:4000/auth/me         # 401
curl -s -o /dev/null -w "%{http_code}\n" "localhost:4000/api/occupied-seats?showtimeId=1"  # 401
curl -s -o /dev/null -w "%{http_code}\n" localhost:4000/api/bookings    # 401
# 3) login admin -> cookie, roi me/occupied/bookings
curl -s -c /tmp/cj.txt -X POST localhost:4000/auth/login -H "Content-Type: application/json" -d '{"email":"admin@cinema.vn","password":"admin123"}' -o /dev/null -w "login=%{http_code}\n"
curl -s -b /tmp/cj.txt localhost:4000/auth/me; echo
curl -s -b /tmp/cj.txt "localhost:4000/api/occupied-seats?showtimeId=1"; echo
curl -s -b /tmp/cj.txt localhost:4000/api/bookings | head -c 80; echo    # admin thay tat ca
curl -s -b /tmp/cj.txt -o /dev/null -w "users=%{http_code}\n" localhost:4000/api/users  # 200 (admin)
# 4) holds POST/DELETE
curl -s -b /tmp/cj.txt -X POST localhost:4000/api/holds -H "Content-Type: application/json" -d '{"showtimeId":3,"seats":["A1"]}'; echo   # {ok,expiresAt}
curl -s -b /tmp/cj.txt -X DELETE "localhost:4000/api/holds?showtimeId=3" -o /dev/null -w "del=%{http_code}\n"  # 204
# 5) sai mat khau -> 401
curl -s -X POST localhost:4000/auth/login -H "Content-Type: application/json" -d '{"email":"admin@cinema.vn","password":"SAI"}' -o /dev/null -w "wrong=%{http_code}\n"  # 401
```
Expected: catalog trả JSON; 3 mã 401 khi chưa login; `login=200` + me trả `{id,fullName,email,role:"admin"}`; occupied trả `{showtimeId,seats}`; bookings admin trả mảng; `users=200`; holds `{ok,expiresAt}` + `del=204`; `wrong=401`. **KHÔNG được ghi db.json** (holds in-memory; không POST booking trong smoke này).

- [ ] **Step 6: 6 cổng CI**

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build && npm run e2e
```
Expected: tất cả PASS. e2e 11 smoke (login admin, seat flow…) chạy qua **server tsx mới**. Nếu e2e đăng nhập fail do rate-limit tích luỹ → kill :4000 + `npm run auth` (reset limiter in-memory) rồi chạy lại.

- [ ] **Step 7: Screenshot verify (review qua điện thoại)**

Chụp Home + Login + Seat map (headless Chrome `--virtual-time-budget=5000`) hoặc script Playwright, đăng Artifact gallery để review — xác nhận UI không đổi (server thay nhưng client contract y nguyên).

- [ ] **Step 8: Commit flip**

```bash
git add server/src/app.ts server/src/index.ts package.json .claude/start-dev.ps1
git rm server/auth-server.js
git commit -m "feat(GD3b/5): flip auth server sang TS modular (tsx) — xoa auth-server.js

app.ts mount /auth + /api/occupied-seats + /api/holds + /api (dung thu tu).
npm run auth => tsx server/src/index.ts; hook start-dev cap nhat. Hanh vi/
contract y nguyen (verify curl smoke + 11 e2e + screenshot).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 9: Verify CI xanh GitHub**

`https://api.github.com/repos/khanhnguyen1205/cinema-full/actions/runs` → run "GD3b/5" `success`. **Lưu ý CI e2e:** job `e2e` chạy `npm run dev` (concurrently api+auth+web) — `auth` giờ là tsx; runner cần `tsx` (đã ở devDeps, `npm ci` có). json-server vẫn trong `dev` script (chưa gỡ). Nếu `dev` khởi động chậm hơn (tsx transpile) → Playwright webServer `timeout` mặc định 120s vẫn đủ.

---

## Self-Review

**1. Spec coverage (spec §3.4 + Global Constraints ↔ task):**
- Cấu trúc module `env/prisma?/auth/*/api/*/app/index` → Task 1-5. (prisma.ts KHÔNG có ở 3b — đúng, để 3c.) ✅
- Auth 5 endpoint + limiter + safeUser + cookie → Task 2 Step 3. ✅
- Gateway thứ tự occupied→holds→/api + quy tắc catalog/users/bookings → Task 3-4 + Task 5 app.ts. ✅
- Holds in-memory TTL 8' + 409 conflicts + POST booking nhả hold → Task 3 (holds) + Task 4 (gateway gọi releaseHolds). ✅
- occupied-seats hợp booking+bookedSeats+heldByOthers → Task 3 Step 3. ✅
- Filter `movieId/roomId/cityId/cinemaId/showtimeId/email` → forward giữ nguyên `req.query` (Task 3 Step 1). ✅
- `auth` script → tsx; hook cập nhật; xoá JS → Task 5. ✅
- Giữ json-server/DATA_URL/hash-passwords.js → không task nào gỡ. ✅

**2. Placeholder scan:** không TBD; mọi file có code đầy đủ; smoke có lệnh + kỳ vọng cụ thể. ✅

**3. Type consistency:**
- `getUserFromReq → ReqUser{id,role}` dùng ở holds/occupied/gateway. ✅
- `forward(req,res,rest,extraQuery?)` chữ ký khớp mọi lời gọi trong gateway. ✅
- `releaseHolds(showtimeId,userId)` export từ holds, gọi ở gateway. ✅
- `heldByOthers` export từ holds, dùng ở occupied. ✅
- `authRouter/occupiedRouter/holdsRouter/gatewayRouter` khớp import ở app.ts. ✅
- **Đã ghi rõ** mẫu `res...; return;` + `deny(...); return;` để tránh lỗi Express5 `Response≠void` (Task 2/3/4).

**Điểm rủi ro khi thực thi:**
- `jwt.sign` kiểu `expiresIn` → đã cast `as jwt.SignOptions`.
- `req.cookies` cần `@types/cookie-parser` (Task 1 Step 1).
- Vitest include phải thêm `server/**` (Task 1 Step 8) nếu không test helper bị bỏ.
- e2e/CI: `dev` script khởi động auth bằng tsx — chậm hơn node chút, để mắt timeout webServer.
