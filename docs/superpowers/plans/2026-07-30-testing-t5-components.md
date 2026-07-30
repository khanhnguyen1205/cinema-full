# Lát T5 — test cho component có logic Implementation Plan

**Goal:** Phủ 7 component có hành vi thật (không phải primitive tĩnh):
`Pagination` · `ConfirmDialog` · `InstallButton` · `ResendTicketButton` ·
`ETicket` · `Navbar` · `GlobalSearch`.

**Architecture:** Dùng lại nguyên hạ tầng T1 — MSW chặn ở tầng HTTP nên test đi
qua `services/*` và `queries/*` **thật**; `renderWithProviders` (đã có cổng
`waitForAuth` từ T4) cho mọi component chạm router/auth/query.

**Tech Stack:** Vitest 3 (project `client`, happy-dom) · MSW 2 ·
@testing-library/react + user-event · TanStack Query v5.

## Global Constraints

- **7 cổng CI phải xanh mỗi commit**: `typecheck` · `lint` (**0 warning**) ·
  `format:check` · `test:run` · `e2e` · `build` · `docker`.
- **Kiểm exit code, đừng kiểm bằng mắt** — nối bằng `&&`.
- **Không sửa hành vi app.** Test lòi ra bug thật thì dừng, báo người dùng, sửa ở
  commit riêng.
- Copy hiển thị qua `t()`, test assert **chuỗi tiếng Việt** (setup init i18n `vi`).
- Prettier quét file mới ⇒ `npm run format` trước khi commit. Commit thẳng `main`,
  message tiếng Việt không dấu.

## Rủi ro đã lường trước

1. `hooks/useInstallPrompt` là **store cấp module** ⇒ trạng thái rò giữa các test.
   Reset bằng cách bắn sự kiện `appinstalled` trong `afterEach` (không sửa mã app).
2. `GlobalSearch` debounce **150ms**: dùng **timer thật + `findBy*`** trước; chỉ
   chuyển sang `vi.useFakeTimers({ shouldAdvanceTime: true })` nếu chập chờn —
   timer giả trần sẽ treo MSW (bài học T4).
3. `Navbar` render **hai bản** `GlobalSearch`/`LanguageSwitcher`/`InstallButton`
   (desktop + mobile) ⇒ query phải scope theo container, không `getByRole` trần.

---

### Task 1 — `Pagination` + `ConfirmDialog`

**Files:** `src/components/admin/Pagination.test.tsx`,
`src/components/admin/ConfirmDialog.test.tsx`

- Pagination: `totalPages <= 1` → render `null`; hiện `from–to / total`; ‹ disable
  ở trang 1, › disable ở trang cuối; bấm → `onPage(page ± 1)`; nhãn trang qua
  `t("admin.pagPage")`.
- ConfirmDialog: hiện `message` + tiêu đề "Xác nhận"; "Hủy" → `onCancel`; "Xóa" →
  `onConfirm`; **Escape** và click nền → `onCancel` (đi qua `ui/Modal`).

### Task 2 — `InstallButton` + `ResendTicketButton`

**Files:** `src/components/InstallButton.test.tsx`,
`src/components/ResendTicketButton.test.tsx`

- InstallButton: mặc định **`null`**; sau `beforeinstallprompt` thì hiện nút "Cài
  đặt ứng dụng", bấm → gọi `prompt()` của sự kiện đã bắt; `appinstalled` → biến mất;
  prop `className` được nối vào class.
- ResendTicketButton: `/api/emails/config` `enabled:false` → **`null`**;
  `enabled:true` → hiện nút; bấm → POST `/api/emails/ticket` với `bookingId` đúng;
  đang gửi thì nút disable; thành công → `role="status"`; lỗi → `role="alert"` mang
  **thông điệp thật của server**.

### Task 3 — `ETicket`

**Files:** `src/components/ETicket.test.tsx`

Mã vé `TK-00001` (pad 5) ở cả thân lẫn cuống · tên phim / `rạp · phòng · type` ·
ghế · tổng tiền qua `formatPrice` · nhãn phương thức theo `METHOD_KEY`
(`counter`/`card`/**`momo` đơn cũ**) · `paymentRef` → nhãn "Đã thanh toán · pi_…"
(không có thì không hiện) · F&B chỉ hiện khi có · QR `value` =
`TK-xxxxx|showtimeId|ghế` · `size="compact"` đổi class + cỡ QR · phim thiếu →
fallback `#id`.

### Task 4 — `Navbar`

**Files:** `src/components/Navbar.test.tsx`

Khách → link "Đăng nhập" · user → avatar viết tắt 2 chữ, mở dropdown có "Vé của
tôi" và **không** có "Quản trị" · admin → có "Quản trị" · Đăng xuất → gọi
`/auth/logout` rồi về `/` · click ngoài và **Escape** đóng dropdown · hamburger đổi
`aria-expanded`, trỏ `aria-controls="nav-mobile"`, Escape đóng · link active theo
route hiện tại · prop `back` hiện nút ←.

### Task 5 — `GlobalSearch`

**Files:** `src/components/GlobalSearch.test.tsx`

Gõ → **debounce** rồi mới mở dropdown (`aria-expanded`) · nhóm Phim/Rạp/Suất ·
**chỉ suất chưa chiếu** (fixture có suất quá khứ để bắt) · tìm **không dấu**
("dien bien" ra "Điện Biên Phủ") · ↑↓ đổi `aria-selected`, Enter đi tới href đúng ·
Enter khi chưa chọn mục → `/search?q=` · Escape đóng · không kết quả → dòng rỗng ·
bấm mục → điều hướng + xoá ô nhập.

### Task 6 — docs

Cập nhật `docs/superpowers/plans/2026-07-29-testing-coverage-baseline.md` với số
coverage sau T5.
