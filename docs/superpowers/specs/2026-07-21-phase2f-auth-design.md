# GĐ2f — Auth (Login / Register) · Kinetic Redesign — Design Spec

**Ngày:** 2026-07-21 · **Trạng thái:** Đã duyệt (split editorial)

## A. Phạm vi

Chỉ redesign UI 2 trang xác thực sang hệ Kinetic + TSX. **Không** đổi logic auth.

| File | Hành động |
|------|-----------|
| `src/pages/Login.jsx` | → `Login.tsx` (giữ nguyên state/handler, thay markup + class) |
| `src/pages/Register.jsx` | → `Register.tsx` |
| `src/pages/AuthLayout.tsx` | **mới** — split shell + panel trái tái dùng |
| `src/pages/Auth.css` | viết lại toàn bộ theo `-k` (bỏ class cũ) |

**Không đụng:** `services/auth.js`, `context/AuthContext.jsx`, route trong `App.jsx` (vẫn `<Login/>` / `<Register/>`), backend.

**Giữ nguyên hành vi:** validate (đủ trường, mật khẩu ≥6, confirm khớp), `remember` checkbox (Login), eye toggle mật khẩu, chặn double-submit, điều hướng `from` sau khi vào, link chéo Login↔Register mang `state.from`.

## B. Layout "Split editorial"

Khung 2 cột trên desktop, 1 cột trên mobile:

```
┌───────────────────────┬──────────────────────────┐
│  PANEL TRÁI (bone)    │  PANEL PHẢI (form kinetic)│
│  ── ẩn < 900px ──     │  ── full-width mobile ──  │
│  N°  · brand mono      │  Logo CINEMA (mobile)     │
│  Statement Bebas lớn   │  Eyebrow mono             │
│  Sub mono              │  Tiêu đề Bebas            │
│  ▓ Marquee mono        │  [error]                  │
│  răng cưa mép phải →   │  Form                     │
│                        │  Switch link              │
└───────────────────────┴──────────────────────────┘
```

- Bọc bằng `AuthLayout` nhận props `{ side, eyebrow, title, children }`; `side` = nội dung panel trái (statement + marquee thay đổi giữa Login/Register).
- Panel trái dùng nền `--surface-invert` (bone, chữ đen) — đồng bộ khối "bone" của vé/thanh toán. Mép phải panel trái là răng cưa của `TicketEdge` (tái dùng), gợi ý "cuống vé".
- Nền trang: giữ grid mờ + glow đỏ hiện có nhưng bản `-k` (mảng tối, không bo góc).

## C. Panel trái (signature)

- `N°01` (Login) / `N°02` (Register) — mã mono góc trên, đồng bộ ngôn ngữ `N°`.
- Brand mono: `THE CINEMATIC EDITORIAL`.
- **Statement Bebas** cỡ `--fs-2xl`, nghiêng khối:
  - Login: `XEM PHIM / BẮT ĐẦU / TỪ ĐÂY`
  - Register: `MỘT TÀI KHOẢN / MỞ MỌI / SUẤT CHIẾU`
- Dòng sub mono nhỏ mô tả.
- `Marquee` mono chạy chậm (speed ~40) ở đáy: chuỗi lặp `ĐẶT VÉ · CHỌN GHẾ · BẮP NƯỚC · QUÉT MÃ ·`.
- Ẩn hoàn toàn `@media (max-width: 900px)`.

## D. Panel phải (form kinetic)

- Mobile: logo `CINEMA` (Bebas đỏ) trên đầu (desktop ẩn — đã có ở panel trái).
- Eyebrow mono (`ĐĂNG NHẬP` / `TẠO TÀI KHOẢN`) + tiêu đề Bebas (`Chào mừng trở lại` / `Tạo tài khoản`).
- **Input kinetic:** mép cứng `--bw-1`/`--r-sm`, nền tối, label mono uppercase. Focus → viền đỏ. **Bỏ** icon trang trí bên trái ô. **Giữ** nút eye (mật khẩu) bên phải; SVG eye tái dùng nguyên.
- Register giữ 2 cột (mật khẩu | xác nhận) như hiện tại, xuống 1 cột ở mobile.
- Error: khối mép cứng viền đỏ (không bo tròn), giữ icon cảnh báo.
- **Nút submit:** khối bone đảo màu (`--surface-invert`, chữ đen) — hover đổi đỏ/dịch shadow cứng; giữ spinner khi loading. Chữ **"Đăng nhập"** / **"Tạo tài khoản"** (giữ nguyên text — ràng buộc smoke).
- Remember (Login): checkbox accent đỏ, label mono.
- Divider "hoặc" + switch link chéo giữ nguyên nội dung, style `-k`.

## E. Ràng buộc smoke (BẮT BUỘC — e2e đang dựa vào)

- `placeholder="your@email.com"` và `placeholder="••••••••"` giữ nguyên.
- Nút submit Login có accessible name **"Đăng nhập"** (`getByRole("button", { name: "Đăng nhập" })`).
- Login vẫn ở route `/login`, đăng nhập admin thành công điều hướng `/`.

## F. A11y & motion

- Panel trái `aria-hidden` không cần (chỉ trang trí text) nhưng marquee đã tự `aria-hidden` bản nhân đôi.
- `prefers-reduced-motion`: tắt animation vào trang + marquee (Marquee đã tự lo; thêm cho fadeUp).
- Input có `<label>` gắn qua bọc (giữ pattern label + input cạnh nhau); eye button `aria-label="Hiện/Ẩn mật khẩu"`.
- Focus-visible ring rõ trên nút và link.

## G. Kế hoạch chia lát

- **2f/1** — `AuthLayout.tsx` + `Auth.css` (viết lại) + `Login.tsx`. Xoá `Login.jsx`. Typecheck/lint/format/build xanh, smoke login vẫn qua.
- **2f/2** — `Register.tsx` (dùng lại `AuthLayout`). Xoá `Register.jsx`. Rà smoke (không cần test mới — chỉ đảm bảo không vỡ). Chụp review → Artifact.
