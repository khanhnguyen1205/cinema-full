# GĐ3d — Dockerfile + Express serve SPA cùng origin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến dự án thành **một service duy nhất** chạy được ở production: Express vừa phục vụ `/api` + `/auth`, vừa phục vụ **SPA build cùng origin** (né hẳn cookie cross-site), đóng gói bằng **Dockerfile multi-stage** — sẵn sàng để lát 3f bấm deploy lên Render.

**Architecture:** Dev không đổi (Vite :3000 + API :4000, CORS). Chỉ khi `NODE_ENV=production` thì `static.ts` mới gắn `express.static("build")` + fallback SPA, và lúc đó CORS thành thừa (cùng origin) nên tắt. Kèm theo là các chỉnh sửa "prod-hardening" mà môi trường thật đòi hỏi: đọc `PORT` của Render, `trust proxy` (Render kết thúc TLS ở tầng ngoài), cookie `secure` khi production. Máy không có Docker → Dockerfile được verify bằng **một job CI build image thật**, cộng với chạy prod-mode local không-Docker.

**Tech Stack:** Express 5 + TypeScript (biên dịch `tsc` ra `server/dist`), Vite build (`build/`), Docker multi-stage `node:22` → `node:22-slim`, Prisma 6.19.3.

## Global Constraints

- **Node 22** (local `v22.11.0`; CI node 22; image `node:22`). **TypeScript ~5.7** strict.
- **Giữ 6 cổng CI xanh, lint 0 warning** ở MỌI commit: `typecheck` · `lint` · `format:check` · `test:run` · `e2e` · `build`. Task 3 thêm job thứ 7 (`docker`) — không thay thế cổng nào.
- **KHÔNG đổi hành vi dev.** `npm run dev` vẫn 2 server, vẫn CORS `WEB_ORIGIN`, cookie vẫn `secure:false` trên localhost. Mọi thứ mới chỉ bật khi `NODE_ENV=production`.
- **HỢP ĐỒNG HTTP BẤT BIẾN** (ràng buộc vàng GĐ3): `/api/*` và `/auth/*` phải được match **trước** fallback SPA, nếu không request API sẽ nhận về `index.html`.
- **KHÔNG sửa `src/`** (frontend).
- **Bí mật KHÔNG commit:** `DATABASE_URL`/`JWT_SECRET` chỉ ở `.env` (gitignored) + env Render. Dockerfile **không** được `COPY .env`.
- **Copy tiếng Việt** cho log/thông báo người-đọc.
- Server `tsx` không watch → sửa `server/**` phải **restart tay** :4000.
- **Gotcha Windows đã biết:** server tsx đang chạy **khoá file Prisma client** → `npm install`/`prisma generate` fail; kill :4000 trước.
- Mỗi Task = **1 commit**, push thẳng `main`.

## File Structure

- `server/src/static.ts` — **create**: `spaFallbackPattern` (regex thuần, test được) + `mountStatic(app)`.
- `server/src/static.test.ts` — **create**: test regex fallback.
- `server/src/app.ts` — **modify**: CORS chỉ khi dev; `trust proxy` khi prod; gọi `mountStatic(app)` **sau** các route API.
- `server/src/env.ts` — **modify**: `IS_PROD`; `PORT` đọc `process.env.PORT` (Render cấp) trước `AUTH_PORT`.
- `server/src/auth/cookies.ts` — **modify**: `secure: IS_PROD` (comment ở dòng 5 đã hẹn sẵn lát này).
- `server/tsconfig.build.json` — **create**: bản emit (`outDir: dist`, `rootDir: src`, chỉ `src`, bỏ file test).
- `package.json` — **modify**: thêm `build:server`, `start:prod`; `build` = web + server.
- `.gitignore` — **modify**: thêm `/server/dist`.
- `Dockerfile` — **create**: multi-stage.
- `.dockerignore` — **create**.
- `.github/workflows/ci.yml` — **modify**: thêm job `docker` (build image, không push).

**KHÔNG đụng:** `src/**`, `server/src/api/**`, `server/src/auth/{routes,tokens,middleware,helpers,users}.ts`, `server/prisma/**`.

---

## Task 1: `static.ts` + prod-hardening (chỉ bật khi NODE_ENV=production)

**Files:**
- Create: `server/src/static.ts`, `server/src/static.test.ts`
- Modify: `server/src/env.ts`, `server/src/app.ts`, `server/src/auth/cookies.ts`

**Interfaces:**
- Produces: `spaFallbackPattern: RegExp`, `mountStatic(app: Express): void` (Task 2 chạy nó ở prod-mode), `IS_PROD: boolean` (từ `env.ts`).

- [ ] **Step 1: Viết test trước (`server/src/static.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import { spaFallbackPattern } from "./static";

describe("spaFallbackPattern", () => {
  it("khớp các route SPA để trả index.html", () => {
    expect(spaFallbackPattern.test("/")).toBe(true);
    expect(spaFallbackPattern.test("/movies")).toBe(true);
    expect(spaFallbackPattern.test("/seats/12")).toBe(true);
    expect(spaFallbackPattern.test("/admin/bookings")).toBe(true);
  });
  it("KHÔNG khớp /api và /auth (API phải được xử lý trước)", () => {
    expect(spaFallbackPattern.test("/api/movies")).toBe(false);
    expect(spaFallbackPattern.test("/api/occupied-seats")).toBe(false);
    expect(spaFallbackPattern.test("/auth/login")).toBe(false);
  });
  it("khớp route bắt đầu bằng chữ giống api/auth nhưng khác đoạn", () => {
    expect(spaFallbackPattern.test("/apixel")).toBe(true);
    expect(spaFallbackPattern.test("/authors")).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test cho nó FAIL**

Run: `npx vitest run server/src/static.test.ts`
Expected: FAIL — `Failed to resolve import "./static"`.

- [ ] **Step 3: Viết `server/src/static.ts`**

```ts
import path from "node:path";
import fs from "node:fs";
import express, { type Express } from "express";
import { IS_PROD } from "./env";

// Mọi đường dẫn KHÔNG bắt đầu bằng /api hoặc /auth (đúng đoạn đầu) đều là route SPA.
// "/apixel" vẫn là route SPA — vì thế cần (?:/|$) chứ không chỉ (?!api).
export const spaFallbackPattern = /^\/(?!api(?:\/|$)|auth(?:\/|$)).*$/;

// Ở production, chính server này phục vụ luôn SPA đã build => cùng origin,
// cookie SameSite=Lax hoạt động bình thường, không cần CORS.
export function mountStatic(app: Express): void {
  if (!IS_PROD) return;
  const buildDir = path.resolve(process.cwd(), "build");
  const indexHtml = path.join(buildDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    console.warn(
      `[server] Không thấy ${indexHtml} — bỏ qua phục vụ SPA. Chạy "npm run build" trước.`,
    );
    return;
  }
  app.use(express.static(buildDir));
  // Fallback: mọi route SPA trả index.html để React Router tự điều hướng.
  app.get(spaFallbackPattern, (_req, res) => {
    res.sendFile(indexHtml);
  });
  console.log(`[server] Phục vụ SPA từ ${buildDir}`);
}
```

- [ ] **Step 4: Chạy test cho PASS**

Run: `npx vitest run server/src/static.test.ts`
Expected: PASS — 3 test.

- [ ] **Step 5: Sửa `server/src/env.ts`**

Thay dòng `export const PORT = Number(process.env.AUTH_PORT) || 4000;` bằng:

```ts
export const IS_PROD = process.env.NODE_ENV === "production";
// Render (và phần lớn PaaS) cấp cổng qua PORT; dev dùng AUTH_PORT.
export const PORT = Number(process.env.PORT || process.env.AUTH_PORT) || 4000;
```

- [ ] **Step 6: Sửa `server/src/auth/cookies.ts`**

- Thêm `IS_PROD` vào import từ `../env`: `import { REFRESH_TTL_DAYS, IS_PROD } from "../env";`
- Đổi khối `baseCookie`:

```ts
// Production chạy sau HTTPS (Render) => bật secure. Dev là http://localhost nên tắt.
const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: IS_PROD,
  path: "/",
};
```

- [ ] **Step 7: Sửa `server/src/app.ts`**

```ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { WEB_ORIGIN, IS_PROD } from "./env";
import { authRouter } from "./auth/routes";
import { occupiedRouter } from "./api/occupied";
import { holdsRouter } from "./api/holds";
import { gatewayRouter } from "./api/gateway";
import { mountStatic } from "./static";

export const app = express();
// Render kết thúc TLS ở proxy phía trước => tin X-Forwarded-* (cần cho rate-limit theo IP).
if (IS_PROD) app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
// Dev: web (:3000) khác origin với API (:4000) nên cần CORS.
// Prod: SPA được chính server này phục vụ => cùng origin, không cần CORS.
if (!IS_PROD) app.use(cors({ origin: WEB_ORIGIN, credentials: true }));

app.use("/auth", authRouter);

// Routes riêng PHẢI khai báo trước catch-all "/api" (Express match theo thứ tự).
app.use("/api/occupied-seats", occupiedRouter);
app.use("/api/holds", holdsRouter);
app.use("/api", gatewayRouter);

// SPA đứng CUỐI: chỉ nhận những gì API không nhận.
mountStatic(app);
```

- [ ] **Step 8: Kiểm dev không đổi hành vi**

Kill :4000 rồi `npm run auth`. Chạy:
```bash
curl -s -o /dev/null -w "movies=%{http_code}\n" http://localhost:4000/api/movies
curl -s -i -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" -d '{"email":"admin@cinema.vn","password":"admin123"}' | grep -i "set-cookie" | head -2
curl -s -o /dev/null -w "route-SPA-o-dev=%{http_code}\n" http://localhost:4000/movies
```
Expected: `movies=200`; `Set-Cookie` **KHÔNG** có `Secure` (dev); `route-SPA-o-dev=404` (dev không phục vụ SPA — Vite lo).

- [ ] **Step 9: 6 cổng**

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build
npm run e2e
```
Expected: PASS; `test:run` = 83 test (80 + 3 mới).

- [ ] **Step 10: Commit**

```bash
npm run format
git add server/src package.json
git commit -m "feat(GD3d/1): static.ts serve SPA cung origin (prod) + prod-hardening (PORT/trust proxy/cookie secure)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

---

## Task 2: Biên dịch server + Dockerfile + verify prod-mode không cần Docker

**Files:**
- Create: `server/tsconfig.build.json`, `Dockerfile`, `.dockerignore`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: `mountStatic` (Task 1).
- Produces: `server/dist/index.js` (entry runtime của image); script `build:server`, `start:prod`.

- [ ] **Step 1: Tạo `server/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

`server/tsconfig.json` giữ nguyên (noEmit — dùng cho cổng `typecheck`, phủ cả `prisma/seed.ts`).

- [ ] **Step 2: Sửa `package.json` (scripts + .gitignore)**

Thêm/đổi trong `"scripts"`:
```json
"build": "vite build && npm run build:server",
"build:server": "tsc -p server/tsconfig.build.json",
"start:prod": "node server/dist/index.js"
```

Thêm vào `.gitignore` (ngay dưới `/build`):
```
/server/dist
```

- [ ] **Step 3: Build thử + kiểm output**

```bash
npm run build
ls server/dist/ server/dist/api server/dist/auth
```
Expected: có `index.js`, `app.js`, `env.js`, `static.js`, `db/prisma.js`, `api/*.js`, `auth/*.js` — và **không** có `*.test.js`.

- [ ] **Step 4: Chạy prod-mode local (không Docker) — bằng chứng "một service, một cổng"**

```bash
NODE_ENV=production PORT=4100 JWT_SECRET=local-prod-test-secret node server/dist/index.js &
sleep 3
curl -s -o /dev/null -w "trang-chu=%{http_code}\n" http://localhost:4100/
curl -s http://localhost:4100/ | grep -o "<title>[^<]*</title>"
curl -s -o /dev/null -w "route-SPA=%{http_code}\n" http://localhost:4100/movies
curl -s http://localhost:4100/movies | grep -c "<div id=\"root\">"
curl -s http://localhost:4100/api/movies | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('api/movies ->',JSON.parse(d).length,'phim'))"
curl -s -o /dev/null -w "api-404=%{http_code}\n" http://localhost:4100/api/movies/9999
curl -s -i -X POST http://localhost:4100/auth/login -H "Content-Type: application/json" -d '{"email":"admin@cinema.vn","password":"admin123"}' | grep -i "set-cookie" | head -1
curl -s -o /dev/null -w "tai-tinh-js=%{http_code}\n" "$(curl -s http://localhost:4100/ | grep -o '/assets/[^"]*\.js' | head -1 | sed 's|^|http://localhost:4100|')"
```
Expected:
- `trang-chu=200`, `<title>` của app, `route-SPA=200` và trả về HTML có `<div id="root">` (**không** phải 404 — đây chính là fallback SPA)
- `api/movies -> 16 phim` (API vẫn thắng fallback), `api-404=404`
- `Set-Cookie` **CÓ** cờ `Secure` (khác hẳn dev ở Task 1 Step 8)
- `tai-tinh-js=200` (file tĩnh trong `build/assets` được phục vụ)

> **Lưu ý:** ở prod-mode local, đăng nhập bằng **trình duyệt** qua `http://` sẽ KHÔNG giữ được phiên vì cookie `Secure` chỉ gửi qua https — đúng như thiết kế. Verify bằng curl (curl không chặn) là đủ; trên Render là https nên hoạt động bình thường.

Dọn: kill tiến trình vừa chạy trên :4100.

- [ ] **Step 5: Viết `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

# ---------- Stage 1: build ----------
FROM node:22 AS build
WORKDIR /app

# Cài dependencies trước để tận dụng cache layer khi chỉ đổi mã nguồn.
COPY package.json package-lock.json ./
COPY server/prisma ./server/prisma
# postinstall chạy "prisma generate" — cần sẵn schema ở trên (không cần DB).
RUN npm ci

COPY . .
# Sinh cả SPA (build/) lẫn server đã biên dịch (server/dist/).
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# openssl: Prisma engine cần; ca-certificates: gọi TLS tới Postgres.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/prisma ./server/prisma
# Bỏ devDependencies; postinstall sinh lại Prisma Client cho image runtime.
RUN npm ci --omit=dev

COPY --from=build /app/build ./build
COPY --from=build /app/server/dist ./server/dist

# Render cấp PORT lúc chạy; 4000 chỉ là mặc định khi chạy tay.
ENV PORT=4000
EXPOSE 4000

# migrate deploy idempotent — an toàn khi khởi động lại.
CMD ["sh", "-c", "npx prisma migrate deploy --schema server/prisma/schema.prisma && node server/dist/index.js"]
```

- [ ] **Step 6: Viết `.dockerignore`**

```
node_modules
build
server/dist
.git
.github
.claude
.env
.env.*
!.env.example
coverage
test-results
playwright-report
blob-report
.playwright
docs
*.md
.vscode
```

> `.env` bị loại **có chủ đích** — bí mật đi qua env của Render, không nằm trong image.

- [ ] **Step 7: 6 cổng**

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build
npm run e2e
```
Expected: PASS. Chú ý `format:check` quét cả `Dockerfile`? Không — Prettier không có parser cho Dockerfile nên bỏ qua; nhưng **`.dockerignore` và YAML thì có** → chạy `npm run format` trước.

- [ ] **Step 8: Commit**

```bash
npm run format
git add package.json .gitignore server/tsconfig.build.json Dockerfile .dockerignore
git commit -m "feat(GD3d/2): build:server (tsc -> server/dist) + Dockerfile multi-stage + .dockerignore

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

---

## Task 3: CI build image thật (verify Dockerfile khi máy không có Docker)

**Vì sao:** máy local không có Docker nên Dockerfile là thứ **duy nhất trong dự án chưa từng được chạy**. Runner ubuntu của GitHub có sẵn Docker → build image trong CI là cách rẻ nhất để biết nó thật sự dựng được, trước khi Render build (nơi lỗi sẽ tốn nhiều thời gian hơn để chẩn đoán).

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Thêm job `docker` vào cuối `.github/workflows/ci.yml`**

```yaml
  docker:
    name: Build Docker image
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build image (không push)
        uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          load: true
          tags: cinema-full:ci
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Kiểm image khởi động được (không cần DB)
        run: |
          docker run --rm --entrypoint node cinema-full:ci -e "
            const fs=require('fs');
            for (const f of ['server/dist/index.js','server/dist/app.js','build/index.html']) {
              if (!fs.existsSync(f)) { console.error('THIEU:', f); process.exit(1); }
            }
            console.log('Image co du SPA build + server da bien dich.');
          "
```

> Không chạy nguyên server trong bước kiểm vì nó cần `DATABASE_URL` thật; ta chỉ xác nhận image chứa đủ artefact và Node chạy được trong đó.

- [ ] **Step 2: `format:check` + commit**

```bash
npm run format
npm run format:check
git add .github/workflows/ci.yml
git commit -m "ci(GD3d/3): job build Docker image de verify Dockerfile"
git push origin main
```

- [ ] **Step 3: Xác minh CI**

Kiểm **badge** (github.com, không dính rate-limit API):
```bash
curl -s "https://github.com/khanhnguyen1205/cinema-full/actions/workflows/ci.yml/badge.svg?branch=main" | grep -o '<title>[^<]*</title>'
```
Expected: `CI - passing`, và job `Build Docker image` xanh.

> **Quy tắc rút ra từ 3c:** KHÔNG poll `api.github.com` vòng lặp dày — 60 request/giờ cho IP chưa xác thực, hết quota là mù thông tin. Poll thưa (≥90s) hoặc dùng badge.

---

## Self-Review (đã rà)

**1. Spec coverage:**
- Spec §3.5 `static.ts` (`express.static("build")` + fallback regex, chỉ bật ở production, khai báo sau `/api`+`/auth`) → Task 1 Step 3, 7. ✅
- Spec §4.1 Dockerfile multi-stage (stage build `npm ci` + `prisma generate` + `vite build` + `tsc -p server`; stage runtime slim, copy `build`/`server/dist`/`server/prisma`, CMD `migrate deploy && node`) → Task 2 Step 5. ✅
- Spec §4.1 `.dockerignore` → Task 2 Step 6. ✅
- Spec §4.3 "máy không Docker → verify prod-mode local không-Docker" → Task 2 Step 4; **bổ sung** job CI build image (Task 3) để Dockerfile không phải là thứ chưa từng chạy. ✅
- Spec §5.1 `build:server` → Task 2 Step 2. ✅
- Spec §4.2 env Render (`DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, không cần `WEB_ORIGIN`) → chuẩn bị bằng `IS_PROD` tắt CORS + `PORT` (Task 1); việc khai env thật thuộc 3f. ✅

**2. Placeholder scan:** không có TBD/TODO; mọi step có lệnh + kỳ vọng cụ thể; mọi file mới có nội dung đầy đủ. ✅

**3. Type consistency:** `IS_PROD` export từ `env.ts` (Task 1 Step 5) được `static.ts`, `app.ts`, `cookies.ts` dùng; `mountStatic(app)` nhận `Express` khớp `export const app = express()`; `spaFallbackPattern` dùng ở cả `static.ts` và test. `build:server` trỏ `server/tsconfig.build.json` tạo ở Task 2 Step 1; `start:prod` trỏ `server/dist/index.js` do nó sinh ra. ✅

**Điểm cần chú ý khi thực thi:**
- **Thứ tự middleware là mấu chốt:** `mountStatic(app)` phải gọi **sau cùng**. Nếu gọi trước `/api`, mọi request API sẽ nhận `index.html` (lỗi âm thầm, e2e vẫn có thể xanh vì dev không bật static).
- `process.cwd()` là gốc repo khi chạy `node server/dist/index.js` từ gốc, và là `/app` trong image — cả hai đều đúng. Đừng dùng `__dirname` (khác nhau giữa `tsx` và `dist`).
- Cookie `Secure` làm prod-mode local không đăng nhập được **bằng trình duyệt** (http). Đây là hành vi đúng, không phải lỗi.
- Nếu `npm ci` trong Docker fail ở `postinstall`: kiểm đã `COPY server/prisma` **trước** `npm ci` chưa (schema phải có mặt).
- Windows: kill :4000 trước khi build/install nếu gặp lỗi khoá file Prisma client.
