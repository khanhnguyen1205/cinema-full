# GĐ4 — Tính năng 3: i18n (đa ngôn ngữ Vi/En) — thiết kế

**Ngày:** 2026-07-25
**Trạng thái:** Đã duyệt thiết kế, chuẩn bị viết plan.
**Giai đoạn:** GĐ4 (chiều sâu tính năng) — tính năng thứ 3, sau Review phim (`f17de79`) và Search nâng cao (`da6e859`).

## Mục tiêu

Thêm đa ngôn ngữ **Tiếng Việt (mặc định) + English** cho toàn app (cả trang công khai lẫn admin), với bộ chuyển ngôn ngữ trên Navbar, dịch mọi chữ giao diện tĩnh, và định dạng ngày/giờ theo locale.

## Quyết định đã chốt (brainstorm)

1. **Phạm vi: TOÀN BỘ** — trang công khai + Booking + Auth + MyTickets + **Admin**.
2. **Cơ chế: `react-i18next`** (i18next + react-i18next + i18next-browser-languagedetector) — chuẩn ngành, hook `useTranslation`, nội suy biến, số nhiều, file JSON. Self-contained, không CDN.
3. **2 ngôn ngữ:** `vi` (mặc định) + `en`.
4. **Mặc định luôn Tiếng Việt** — phát hiện CHỈ qua `localStorage('lang')` + `htmlTag`, **KHÔNG** dò `navigator.language` (để e2e giữ xanh: context mới không có localStorage → vi). Người dùng tự bấm EN.
5. **Giá tiền: LUÔN VND (`₫`)** dù UI ngôn ngữ nào — rạp Việt Nam, không quy đổi tiền tệ (ngoài phạm vi).
6. **Ngày/giờ: đổi theo locale** (`vi-VN` ↔ `en-US`).
7. **KHÔNG dịch nội dung DB** (tên phim, mô tả, tên/địa chỉ rạp, tên F&B) — không đổi schema. Thể loại (mã `ACTION`/`SCI-FI`…) map sang nhãn song ngữ qua bảng tra.

## Ràng buộc

- Giữ **6 cổng CI xanh** mỗi lát (typecheck · lint 0-warning · format · vitest · e2e · build).
- **RÀNG BUỘC e2e:** smoke/booking/reviews dựa vào placeholder `your@email.com` / `••••••••` và nút **"Đăng nhập"**. Vì mặc định là `vi` và e2e chạy ở mặc định (context mới, không localStorage), các chuỗi này giữ nguyên tiếng Việt → **e2e không phải sửa selector**. Bản dịch `vi` của chúng phải KHỚP CHÍNH XÁC chuỗi hiện tại.
- Absolute imports; đăng ký thư mục mới `src/i18n` trong **cả** `tsconfig.json` paths **và** `vite.config.mjs` alias.
- `localStorage` cho `lang` là chấp nhận được (khác token auth cố tình không lưu).
- Tôn trọng hệ thiết kế Kinetic cho `LanguageSwitcher`.
- Direct-to-main, mỗi lát 1 commit + push.

## Hiện trạng

- **53 file** `.ts/.tsx` chứa chữ tiếng Việt; **23 chỗ** dùng `toLocaleString("vi-VN")`/`toLocaleDateString("vi-VN")`. **Chưa có** dep i18n.
- Copy tiếng Việt rải khắp pages + components + admin.

## Kiến trúc

### File mới

| File | Trách nhiệm |
|---|---|
| `src/i18n/index.ts` | 🆕 Cấu hình i18next (resources vi/en, fallback vi, detection localStorage+htmlTag, `escapeValue:false`) |
| `src/i18n/format.ts` | 🆕 `formatDateTime(iso)`, `formatDate(iso)`, `formatPrice(n)` — đọc `i18n.language`; giá LUÔN VND |
| `src/i18n/locales/vi.json` | 🆕 Bản dịch tiếng Việt, khoá lồng theo khu vực |
| `src/i18n/locales/en.json` | 🆕 Bản dịch tiếng Anh (cùng cây khoá) |
| `src/components/LanguageSwitcher.tsx` + `.css` | 🆕 Nút VI/EN Kinetic (Navbar desktop + menu mobile) |

### Sửa

- `src/index.tsx` — `import "i18n"` (chạy init) TRƯỚC khi render.
- `tsconfig.json` + `vite.config.mjs` — thêm alias `i18n`.
- Mọi trang/component có chữ → `const { t } = useTranslation()` + `t("area.key")`.
- 23 chỗ format → helper trong `format.ts`.
- `index.html` `<html lang>` cập nhật động (i18next `languageChanged` → `document.documentElement.lang`).

### Cây khoá dịch (một file/ngôn ngữ, lồng theo khu vực)

```
common      — nút/nhãn dùng chung (Thử lại, Đang tải, Tìm kiếm, Xóa lọc, Đóng, Hủy, Lưu, Xóa…)
nav         — Navbar/Footer (Trang chủ, Phim, Rạp, Vé, Đăng nhập, Đăng xuất, Quản trị…)
home        — Home hero/section
movies      — Movies (tiêu đề, nhãn lọc, Lọc nâng cao, điểm, thời lượng, định dạng, rỗng…)
movieDetail — MovieDetail (các khu N°, đặt vé, đánh giá khán giả…)
cinemas     — Cinemas + CinemaDetail
search      — Search (khu Phim/Rạp/Suất, gợi ý, rỗng)
booking     — Booking wizard 4 bước + thông báo + SeatHoldTimer
auth        — Login/Register (KHỚP chuỗi vi hiện tại cho nút/placeholder e2e)
tickets     — MyTickets
admin       — mọi trang admin + sidebar + form + bảng + ConfirmDialog
genres      — bảng nhãn thể loại: ACTION/SCI-FI/… → nhãn vi/en
```

### `LanguageSwitcher`

Nút đôi **VI | EN**, active đảo màu bone (`--surface-invert`), `i18n.changeLanguage(lang)` + ghi `localStorage`. `aria-pressed` cho nút active. Đặt trong `nav-k__right` (desktop, cạnh search) và menu mobile.

### Định dạng (`format.ts`)

```ts
formatDateTime(iso): string  // new Date(iso).toLocaleString(localeOf(i18n.language), {…})
formatDate(iso): string      // toLocaleDateString
formatPrice(n): string       // n.toLocaleString(localeOf) + " ₫"  — LUÔN VND
```
`localeOf`: `vi` → `"vi-VN"`, `en` → `"en-US"`. Các component gọi helper thay vì `toLocaleString` trực tiếp; helper đọc `i18n.language` tại thời điểm render (component re-render khi đổi ngôn ngữ nhờ `useTranslation` subscribe).

## Data flow

- `i18next` giữ ngôn ngữ hiện tại; `useTranslation()` trong component subscribe → đổi ngôn ngữ tự re-render toàn cây.
- `t("area.key", { count, name })` cho nội suy/số nhiều.
- Không đụng TanStack Query / gateway / DB. Thuần client UI layer.

## Xử lý lỗi & rìa

- Thiếu khoá dịch → i18next trả về khoá (fallback vi trước). Bắt sớm bằng grep quét chữ tiếng Việt còn sót sau mỗi lát.
- Nội suy chuỗi có biến (vd "{{count}} phim", "Xin chào {{name}}") — dùng placeholder i18next, KHÔNG nối chuỗi thủ công.
- Số nhiều tiếng Anh (1 movie / 2 movies) vs tiếng Việt (không biến đổi) — dùng `_plural` key khi cần.
- `prefers-reduced-motion`, a11y: LanguageSwitcher là nút thật, `aria-pressed`.

## Testing

- **Unit (Vitest):** `format.test.ts` — `formatPrice` luôn có `₫`; `formatDateTime`/`formatDate` đổi theo `i18n.language` (set vi→en assert khác nhau). (i18n init trong test qua `src/test/setup.ts` hoặc import trực tiếp.)
- **E2E (Playwright, chỉ đọc — thêm smoke):** bấm nút **EN** trên Navbar → một nhãn điều hướng đổi (vd "Phim" → "Movies"); bấm **VI** → trở lại. Không ghi dữ liệu. Các test cũ chạy ở mặc định vi → không sửa.
- Giữ 6 cổng xanh; lint 0 warning.

## Chia lát (mỗi lát = 1 commit, push, 6 cổng xanh)

- **T1 Hạ tầng + chrome:** cài deps + `i18n/index.ts` + `format.ts` + `locales/{vi,en}.json` (khung `common`+`nav`) + alias tsconfig/vite + `index.tsx` import + `LanguageSwitcher` trên Navbar + dịch **Navbar/Footer**. → bộ chuyển chạy end-to-end trên chrome.
- **T2** Home + Movies + Search (+ bảng nhãn `genres`).
- **T3** MovieDetail + Cinemas + CinemaDetail.
- **T4** Booking wizard + MyTickets + Auth (giữ khớp chuỗi vi e2e).
- **T5** Admin (mọi trang admin + `AdminLayout`/`ConfirmDialog`/`Pagination`…).
- **T6** Rà format (23 chỗ `toLocaleString` → helper) + e2e smoke bấm-EN + cập nhật CLAUDE.md + **grep quét chữ tiếng Việt còn sót** toàn `src`.

**Giảm rủi ro sót:** sau mỗi lát `grep -E "[dấu tiếng Việt]"` trên file đã sửa; T6 quét toàn cục lần cuối (cho phép chừa: comment tiếng Việt, chuỗi trong `db.json`/docs, chuỗi vi trong `vi.json`).

## Verify & review

- Mỗi lát: screenshot headless Chrome desktop+mobile **cả 2 ngôn ngữ** (bấm EN), gom Artifact gallery (`--virtual-time-budget=5000`).

## Ngoài phạm vi (YAGNI)

- Dịch nội dung DB (tên/mô tả phim, rạp) — cần cột đa ngôn ngữ, để sau.
- Quy đổi tiền tệ ($/₫) — giá luôn VND.
- Ngôn ngữ thứ 3, RTL.
- Dò `navigator.language` (cố tình bỏ để e2e ổn định + mặc định rạp Việt).
