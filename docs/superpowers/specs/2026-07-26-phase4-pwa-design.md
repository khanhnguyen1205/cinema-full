# GĐ4 — PWA (Progressive Web App) — Thiết kế

**Ngày:** 2026-07-26
**Tính năng:** GĐ4 tính năng 4 — biến cinema-full thành PWA cài đặt được, mở offline (app-shell + catalog công khai), có nút cài đặt riêng và toast nhắc cập nhật.

## Mục tiêu & phạm vi

- App **cài được lên màn hình chính** (installable) trên Android/desktop, chạy chế độ `standalone`.
- **Offline:** app-shell (JS/CSS/font/icon precache) mở được không mạng; duyệt lại phim/rạp/suất **công khai đã xem** nhờ runtime cache.
- **Nút "Cài đặt ứng dụng" riêng** trong app (bắt `beforeinstallprompt`).
- **Toast nhắc cập nhật** khi có bản deploy mới (không tự reload giữa chừng).
- Song ngữ (mọi chuỗi qua i18n).

**KHÔNG làm (YAGNI / an toàn):**
- Không cache dữ liệu cá nhân: `/api/bookings`, `/api/users`, `/auth/*`, `/api/occupied-seats`, `/api/holds` **luôn phải sống** (tránh lộ vé trên máy chung + seat-hold phải realtime).
- Không hàng đợi đặt vé offline (đụng seat-hold server-side).
- Không đổi hợp đồng HTTP `/api`·`/auth`, không đổi backend (Express đã serve `build/`).

## Kiến trúc lõi — vite-plugin-pwa

Thêm 1 devDependency `vite-plugin-pwa`; cấu hình trong `vite.config.mjs`. Không đụng server: ở prod, `server/src/static.ts` serve `build/` với SPA-fallback loại trừ `/api`+`/auth`, nên `sw.js` và `manifest.webmanifest` (file thật trong `build/`) được `express.static` phục vụ ở gốc trước fallback; SW scope `/`.

**Cấu hình plugin:**
- `registerType: "prompt"` — chủ động nhắc cập nhật.
- `injectRegister: null` — đăng ký qua hook React (không cần `registerSW.js` rời).
- **Manifest:**
  - `name`: "Cinema — The Cinematic Editorial"
  - `short_name`: "Cinema"
  - `description`: "Đặt vé xem phim: chọn suất, chọn ghế, bắp nước và nhận vé điện tử QR."
  - `display`: "standalone"
  - `theme_color`: "#0a0a0a", `background_color`: "#0a0a0a"
  - `start_url`: "/", `scope`: "/", `lang`: "vi", `dir`: "ltr"
  - `categories`: ["entertainment"]
  - `icons`: 192, 512, 512-maskable (`purpose: "maskable"`), (apple-touch qua `<link>` trong head)
- **Workbox:**
  - `globPatterns`: `["**/*.{js,css,html,woff2,png,svg,ico,webmanifest}"]` — precache shell + font.
  - `navigateFallback: "index.html"`, `navigateFallbackDenylist: [/^\/api/, /^\/auth/]` — không nuốt request API.
  - `runtimeCaching`: **một rule** cho catalog công khai:
    - `urlPattern`: hàm `({ url, sameOrigin }) => sameOrigin && PUBLIC_CATALOG_RE.test(url.pathname)` với `PUBLIC_CATALOG_RE = /^\/api\/(movies|showtimes|cinemas|cities|rooms|concessions|reviews)(\/|\?|$)/`.
    - `handler`: `"StaleWhileRevalidate"`.
    - `options`: `cacheName: "catalog-api"`, `expiration: { maxEntries: 200, maxAgeSeconds: 86400 }`, `cacheableResponse: { statuses: [200] }`.
    - Không có rule nào khác ⇒ mọi path khác (bookings/users/occupied/holds/auth) đi thẳng mạng, không cache.
- `devOptions.enabled: false` (mặc định): **SW tắt trong `npm run dev`** ⇒ Playwright e2e (chạy trên dev server) không bị SW/caching can thiệp; giữ nguyên 18 e2e.

## Tích hợp React

### Toast nhắc cập nhật
- Component `src/components/PWAUpdatePrompt.tsx`, dùng `useRegisterSW()` từ `virtual:pwa-register/react`.
- Khi `needRefresh` → toast cố định (Kinetic: khối bone/viền cứng, góc dưới): `t("pwa.updateReady")` + nút `t("pwa.reload")` gọi `updateServiceWorker(true)` + nút đóng (`t("pwa.dismiss")` ẩn toast, đặt `needRefresh=false`).
- Mount 1 lần trong `App.tsx` (trong `BrowserRouter`, cạnh `Routes`). Trả `null` khi không có bản mới.
- Type: thêm `/// <reference types="vite-plugin-pwa/react" />` vào `src/vite-env.d.ts`.
- CSS: khối `.pwa-k*` (dùng token có sẵn `--surface-invert`/`--text-invert`/`--border-strong`/`--shadow-*`), tôn trọng `prefers-reduced-motion`.

### Nút cài đặt
- Hook `src/hooks/useInstallPrompt.ts`: lắng nghe `beforeinstallprompt` (gọi `preventDefault`, lưu event vào state), `appinstalled` (xoá event). Trả `{ canInstall: boolean, promptInstall: () => Promise<void> }`. `promptInstall` gọi `evt.prompt()` rồi xoá event (dùng 1 lần).
- Component `src/components/InstallButton.tsx`: render **chỉ khi `canInstall`**; nút gọn `t("pwa.install")`; bấm → `promptInstall()`. Đặt trong Navbar `nav-k__right` (desktop, cạnh `LanguageSwitcher`) + trong block menu mobile (cạnh `nav-k__lang-mobile`).
- Không cần i18n cho aria đặc biệt ngoài nhãn.

### i18n
- Namespace mới **`pwa`** trong `src/i18n/locales/vi.json` + `en.json`:
  - `install`: "Cài đặt ứng dụng" / "Install app"
  - `updateReady`: "Có bản mới" / "New version available"
  - `reload`: "Tải lại" / "Reload"
  - `dismiss`: "Đóng" / "Dismiss"

## Icon

Hướng **"C" đỏ Bebas trên nền gần-đen, viền cứng mảnh** (hệ Kinetic).

- Nguồn: `public/favicon.svg` — vừa là favicon vector phục vụ thật, vừa là nguồn dựng bitmap.
- Script `scripts/gen-icons.mjs` (headless Chrome qua Playwright — đã là devDep): nhúng font Bebas Neue woff2 base64 từ `node_modules/@fontsource/bebas-neue`, render HTML rồi screenshot đúng kích thước:
  - `public/icon-192.png` (192×192)
  - `public/icon-512.png` (512×512)
  - `public/icon-512-maskable.png` (512×512, nội dung trong vùng an toàn ~80% giữa, nền đặc gần-đen)
  - `public/apple-touch-icon.png` (180×180, nền đặc — iOS không dùng alpha)
  - `public/favicon-32.png` (32×32)
- Vite copy `public/*` vào gốc `build/`.
- `index.html` `<head>` thêm: `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, `<link rel="icon" href="/favicon-32.png" sizes="32x32">`, `<link rel="mask-icon" href="/favicon.svg" color="#e63030">`. (`<link rel="manifest">` do plugin tự inject lúc build.)
- Script `scripts/gen-icons.mjs` giữ trong repo (prettier-clean; thêm block ESLint `scripts/**` node-env) để tái tạo; chạy 1 lần, **commit các PNG + SVG**.

## Serve ở prod

Không đổi `server/`. Lưu ý xác nhận khi verify: `.webmanifest` được `express.static` (mime-db) trả `application/manifest+json`; SW `/sw.js` scope `/`; API request thắng runtime-cache đúng whitelist.

## Kiểm thử & xác minh

- **Build gate:** `npm run build` phải sinh `build/sw.js` + `build/manifest.webmanifest` + icons (không lỗi thiếu icon).
- **Prod-mode local** (như GĐ3d, không cần Docker): `NODE_ENV=production PORT=4100 JWT_SECRET=… node server/dist/index.js` → headless Chrome:
  - manifest hợp lệ (name/icons/display), SW đăng ký (`navigator.serviceWorker.controller` sau reload thứ 2),
  - `/api/movies` vẫn trả 16 phim (API thắng cache/fallback),
  - reload offline → app-shell hiện.
  - Chụp icon + nút cài đặt gửi review qua điện thoại ([[phone-review-screenshots]]).
- **Unit test nhẹ:** `useInstallPrompt` (dispatch `beforeinstallprompt` → `canInstall=true`; `appinstalled` → `false`) + smoke key `pwa` tồn tại.
- **e2e:** giữ **18 nguyên** (SW tắt ở dev ⇒ không thêm phụ thuộc mong manh). Chỉ thêm 1 assertion đọc `theme-color`/`<link rel=manifest>` **nếu** dev có inject (nếu không, bỏ — không làm đỏ CI).

## Chia lát (mỗi lát 1 commit, 6 cổng xanh, push main)

- **P1 — Icon:** `public/favicon.svg` + `scripts/gen-icons.mjs` + PNG + `<head>` links + block ESLint `scripts/**`.
- **P2 — Plugin/SW:** `vite-plugin-pwa` + manifest + workbox (precache + runtime cache whitelist) + type ref. Verify build sinh sw/manifest.
- **P3 — React/UI:** `PWAUpdatePrompt` + `useInstallPrompt` + `InstallButton` (Navbar) + namespace `pwa` i18n + CSS `.pwa-k`.
- **P4 — Verify & docs:** prod-mode verify + unit test + cập nhật CLAUDE.md/README + (tùy chọn) e2e assertion nhẹ.

## Ràng buộc / rủi ro

- **Không bật `devOptions.enabled`** → tránh SW cache /api trong e2e (booking/reviews ghi thật, cần dữ liệu tươi).
- Runtime cache **chỉ** catalog công khai; whitelist bằng regex chặt, mọi thứ khác không cache.
- Bebas woff2 phải nhúng vào HTML dựng icon (headless Chrome không có font hệ thống đó).
- Manifest `lang: "vi"` tĩnh (metadata app-level; không đổi theo user — YAGNI).
- Giữ nguyên `theme-color` `#0a0a0a` đã có trong `index.html`.
