# GĐ1 — Nền móng kỹ thuật (Engineering Foundation)

> Spec này thuộc lộ trình "chuyên nghiệp hoá" cinema-full (GĐ1→2→3→4). GĐ1 dựng nền móng kỹ thuật **không đổi giao diện**; UI craft ở GĐ2, kiến trúc thật + deploy ở GĐ3, chiều sâu tính năng ở GĐ4.

## Mục tiêu

Biến codebase từ "student project chạy được" thành nền móng mà một senior nhìn vào sẽ đánh giá là chuyên nghiệp: build system hiện đại, type-safe ở phần cốt lõi, có lint/format thống nhất, có test tự động, có xử lý lỗi runtime, cấu hình qua env, và CI xanh trên mỗi push.

## Nguyên tắc

- **Không đổi UI trong GĐ1.** Tiêu chí thành công gồm "ảnh chụp trước/sau giống hệt".
- **Mỗi lát cắt để app chạy xanh**, commit riêng, verify riêng. Hỏng ở đâu revert ở đó.
- **TypeScript tăng dần**: convert "xương sống" (types, services, lib, context, hooks, entry), *không* đụng `pages/*.jsx` — chúng sẽ được viết lại + gắn type trong GĐ2 (tránh làm hai lần).
- **CI phải luôn xanh**: chỉ đưa vào CI những bước nhanh & ổn định (typecheck/lint/test/build). E2e chạy local ở GĐ1.
- Giữ mọi thứ đang chạy: **port web = 3000** (start-dev.ps1, CORS auth `WEB_ORIGIN`, hook đều giả định 3000).

## Không nằm trong phạm vi GĐ1 (đã dời có chủ đích)

- **TanStack Query** → GĐ2: gắn liền với việc viết lại từng trang; đưa vào GĐ1 sẽ phải đấu nối vào trang cũ rồi gỡ ra → lãng phí. GĐ1 chỉ dựng typed service layer sạch để GĐ2 phủ React Query lên.
- **E2e đặt vé đầy đủ** → GĐ3: cần DB test tách biệt để không làm bẩn `db.json`. GĐ1 chỉ làm e2e *smoke*.
- **Convert TS toàn bộ pages** → GĐ2 (trong lúc rebuild UI).

## Kiến trúc sau GĐ1 (không đổi so với hiện tại về mặt runtime)

Vẫn 3 tiến trình: json-server `:9999` (nội bộ) → Express auth+gateway `:4000` → web `:3000`. GĐ1 chỉ đổi **cách build web** (Vite thay CRA), **ngôn ngữ phần cốt lõi** (TS), và thêm các lớp chất lượng (lint/test/CI/error boundary/env). Luồng dữ liệu, phân quyền, giữ ghế… giữ nguyên.

## Các lát cắt (trình tự thực thi)

Mỗi lát = 1 commit, kết thúc ở trạng thái xanh.

### 1a — Vite + env config
- Thêm `vite`, `@vitejs/plugin-react`, `vite-tsconfig-paths`; gỡ `react-scripts`.
- `index.html` chuyển ra thư mục gốc (từ `public/index.html`), bỏ token `%PUBLIC_URL%`, trỏ `<script type="module" src="/src/index.jsx">`.
- `vite.config.js` (tạm JS, đổi TS ở 1b): plugin react + tsconfigPaths, `server.port = 3000`, `server.strictPort = true`.
- Absolute imports (`components/...`) hoạt động qua `vite-tsconfig-paths` đọc `jsconfig`/`tsconfig` `baseUrl:src`.
- Bỏ URL hardcode: `src/services/api.js` và `auth.js` đọc `import.meta.env.VITE_API_URL` / `VITE_AUTH_URL` (fallback về giá trị hiện tại). Tạo `.env` (git-ignored) + `.env.example`.
- Scripts: `dev`→vite, `build`→`vite build`, `preview`→`vite preview`. `npm run dev` (all three) vẫn chạy web qua vite; `start` giữ alias để hook không vỡ.
- **Verify:** `npm run build` xanh; app chạy `:3000`; chụp Home/Movies/MovieDetail so với baseline — **giống hệt**.

### 1b — TypeScript spine
- Thêm `typescript`, `@types/react`, `@types/react-dom`, `@types/node`; `tsconfig.json` (strict, `allowJs`, `checkJs:false`, `jsx:"react-jsx"`, `baseUrl:"src"`), `vite.config.ts`.
- `src/types/index.ts`: `Movie`, `Showtime`, `Room`, `Cinema`, `City`, `Booking`, `User`, `Concession`, `Seat`, `SeatType`.
- Convert sang `.ts/.tsx`: `services/api.ts`, `services/auth.ts`, `lib/pricing.ts`, `context/AuthContext.tsx`, `hooks/usePagination.ts`, `src/App.tsx`, `src/index.tsx`.
- `pages/*.jsx`, `components/*.jsx`, `routes/*.jsx` **giữ nguyên** (allowJs). Script `typecheck`: `tsc --noEmit`.
- **Verify:** `npm run typecheck` xanh; app vẫn chạy.

### 1c — ESLint + Prettier
- ESLint flat config (`eslint.config.js`): `@eslint/js`, `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`. Prettier + `eslint-config-prettier`.
- Scripts `lint`, `lint:fix`, `format`. Chạy format toàn repo; sửa các cảnh báo thật (không phá logic).
- **Verify:** `npm run lint` xanh; `npm run typecheck` vẫn xanh.

### 1d — Vitest + unit test
- Thêm `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Block `test` trong `vite.config.ts` (environment jsdom, setup jest-dom).
- Test **kỹ** `lib/pricing.ts`: `vipPrice`/`couplePrice` (làm tròn 1000), `priceOf` (thường/VIP/đôi), `coupleUnits`, `buildSeatLayout` (số ghế/hàng, cờ isVip/isCouple, lối đi), `bookedSeatSet` (hợp bookedSeats ∪ bookings), `fnbLines`/`fnbTotal`.
- Vài test service với `fetch` mock (ví dụ `getOccupiedSeats` bóc `.seats`, `holdSeats` gửi đúng body).
- Script `test`, `test:watch`, `coverage`.
- **Verify:** `npm test` xanh.

### 1e — ErrorBoundary + server dotenv
- `src/components/ErrorBoundary.tsx`: class component bắt lỗi render, fallback "cinematic" (nút tải lại), bọc quanh `<App/>`.
- Server: thêm `dotenv`, `require("dotenv").config()` đầu `auth-server.js`; đọc `JWT_SECRET`/`AUTH_PORT`/`DATA_URL`/`WEB_ORIGIN` từ `.env` (đã có default). Thêm `.env.example` cho server.
- **Verify:** ném lỗi thử trong 1 component → thấy fallback thay vì trắng trang; server vẫn chạy với/không có `.env`.

### 1f — Playwright smoke e2e
- Thêm `@playwright/test`; `playwright.config.ts` (baseURL `:3000`, `webServer` tuỳ chọn hoặc dựa vào stack đang chạy).
- 1 spec smoke: mở `/` (thấy hero), điều hướng `/movies` (thấy lưới phim), đăng nhập bằng user seed, vào được route bảo vệ (`/tickets`).
- Script `e2e`, `e2e:ui`. Tài liệu hoá trong README.
- **Verify:** `npm run e2e` pass local (3 server đang chạy).

### 1g — CI (GitHub Actions)
- `.github/workflows/ci.yml`: trigger push/PR lên `main`; Node 20; `npm ci` → `npm run typecheck` → `npm run lint` → `npm test` → `npm run build`.
- E2e **không** đưa vào CI ở GĐ1 (cần stack chạy) — giữ CI nhanh & luôn xanh.
- **Verify:** Actions xanh trên GitHub sau khi push.

## Tiêu chí hoàn thành GĐ1

- `npm run build`, `typecheck`, `lint`, `test` đều xanh.
- App chạy `:3000` qua Vite; UI **không đổi** so với baseline (đối chiếu ảnh).
- Playwright smoke pass local.
- CI xanh trên GitHub.
- README cập nhật lệnh mới (dev/build/preview/lint/test/e2e); `.env.example` có mặt.

## Rủi ro & giảm thiểu

- **Vite đổi port mặc định (5173)** → ghim `server.port=3000` + `strictPort`, kiểm CORS auth.
- **`%PUBLIC_URL%`/asset path** khác giữa CRA và Vite → rà `index.html` + tham chiếu asset.
- **Migration lớn dễ vỡ** → chẻ 7 lát, mỗi lát verify + commit; hook auto-start vẫn chạy được (`npm start` giữ alias).
- **`react-scripts` gỡ đi** có thể còn phụ thuộc ẩn → build sạch để phát hiện.
- **ESLint có thể lộ lỗi thật** → sửa cẩn thận, không tắt rule bừa; giữ typecheck xanh song song.
