# GĐ2f — Auth Kinetic Redesign — Implementation Plan

Spec: `docs/superpowers/specs/2026-07-21-phase2f-auth-design.md`
Commit thẳng `main`, mỗi lát 1 commit, giữ 6 cổng CI xanh.

## Lát 2f/1 — AuthLayout + Auth.css + Login.tsx

**Task 1. `src/pages/AuthLayout.tsx` (mới)**
- Props: `{ codeNo: string; brand?: string; statement: ReactNode; sub: string; children: ReactNode }`.
- Cấu trúc: `.auth-k` (grid 2 cột) → `<aside className="auth-k__side">` bọc `TicketEdge` chứa `N°`, brand, statement Bebas, sub, `<Marquee>`; `<main className="auth-k__panel">` chứa `children` (logo mobile + form).
- Import `TicketEdge`, `Marquee` từ `components/ui`.
- Nền: `.auth-k__bg` (grid + glow) như spec §B.

**Task 2. `src/pages/Auth.css` — viết lại**
- Xoá toàn bộ class cũ (`.auth-page/.auth-card/.field-*/...`).
- Thêm block `-k`: `.auth-k`, `.auth-k__bg`, `.auth-k__side`, `.auth-k__code`, `.auth-k__brand`, `.auth-k__statement`, `.auth-k__sub`, `.auth-k__panel`, `.auth-k__logo`, `.authf-k` (form), `.authf-k__eyebrow/__title/__error`, `.field-k` (group), `.field-k__label`, `.field-k__wrap`, `.field-k__input`, `.field-k__eye`, `.authf-k__row`, `.authf-k__remember`, `.authf-k__submit`, `.authf-k__spinner`, `.authf-k__divider`, `.authf-k__switch/__link`.
- Responsive: `@media (max-width: 900px)` ẩn `.auth-k__side`, panel full; `.authf-k__row` → 1 cột.
- `@media (prefers-reduced-motion: reduce)` tắt fadeUp.
- Đảm bảo submit dùng bone (`--surface-invert`/`--text-invert`), hover → đỏ + `--shadow-hard`.

**Task 3. `src/pages/Login.tsx` (thay `.jsx`)**
- Giữ nguyên state/handler/imports logic. Đổi markup:
  - Bọc bằng `<AuthLayout codeNo="01" statement={<>XEM PHIM<br/>BẮT ĐẦU<br/>TỪ ĐÂY</>} sub="…">`.
  - Trong children: logo mobile, eyebrow "ĐĂNG NHẬP", tiêu đề "Chào mừng trở lại", error, form.
  - Input email: `placeholder="your@email.com"` (GIỮ). Mật khẩu: `placeholder="••••••••"` (GIỮ) + eye toggle (`aria-label`). Bỏ `.field-icon` SVG.
  - Remember checkbox. Submit `"Đăng nhập"` (GIỮ text) / spinner.
  - Switch → `/register` mang `state.from`.
- Xoá `Login.jsx`.

**Cổng lát 2f/1:** `npx tsc --noEmit`; `npm run lint` (0 warning); `npm run format:check`; unit test (Marquee/seatNav… vẫn 65); `npm run build`; smoke local nếu chạy nhanh (login admin).

## Lát 2f/2 — Register.tsx + review

**Task 4. `src/pages/Register.tsx` (thay `.jsx`)**
- Bọc `<AuthLayout codeNo="02" statement={<>MỘT TÀI KHOẢN<br/>MỞ MỌI<br/>SUẤT CHIẾU</>} sub="…">`.
- Children: eyebrow "TẠO TÀI KHOẢN", tiêu đề "Tạo tài khoản", error, form 4 trường (họ tên, email, hàng mật khẩu|xác nhận), submit "Tạo tài khoản".
- Bỏ mọi `.field-icon`; giữ eye toggle ở ô mật khẩu.
- Xoá `Register.jsx`.

**Task 5. Rà & review**
- Chạy đủ 6 cổng + e2e smoke (`npx playwright test`), đảm bảo 10 test cũ vẫn xanh (đặc biệt "đăng nhập admin").
- Chụp Login + Register (desktop + mobile 390px) qua Playwright, gom Artifact review 2f.
- Cập nhật memory `professionalization-roadmap.md`: 2f xong, kế tiếp 2g Admin.

## Không làm
- Không thêm test e2e mới (smoke hiện có đã phủ login).
- Không đổi text nút / placeholder ràng buộc.
- Không commit `CLAUDE.md` / `README.md`.
