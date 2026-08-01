# Lighthouse — đo và sửa (2026-08-01)

Chạy trên **bản build production** phục vụ bởi chính server Express
(`NODE_ENV=production PORT=4100`), **chế độ mobile** (mặc định của Lighthouse:
CPU và mạng bị bóp). Lặp lại được bằng `node scripts/lighthouse.mjs`.

## Kết quả

| Trang       | Hiệu năng   | Trợ năng | Thực hành tốt | SEO         |
| ----------- | ----------- | -------- | ------------- | ----------- |
| `/`         | 59 → **69** | **100**  | 75 → **96**   | 83 → **100** |
| `/movies`   | 58 → **71** | **100**  | 93            | 83 → **100** |
| `/movie/1`  | 59 → **67** | **100**  | 75 → **96**   | 83 → **100** |
| `/cinemas`  | 56 → **70** | **100**  | 96            | 82 → **100** |

**Trợ năng 100/100 ngay từ lần đo đầu** — sau khi cổng axe đã sửa xong 26 vi
phạm. Một công cụ độc lập xác nhận lại phần việc đó.

## Đã sửa

| Việc | Vì sao | Kết quả |
| ---- | ------ | ------- |
| **Tách bundle** `React.lazy` cho route admin + đặt vé | `recharts` (~200KB, chỉ admin dùng) và `@stripe/stripe-js` nằm trong bundle chính. Gói Stripe còn **tự chèn script `js.stripe.com` ngay khi được import**, nên mọi trang công khai đều dính cookie bên thứ ba và một lượt tải mạng thừa | JS không dùng **694 → 156 KiB**; LCP **10,6s → 5,5s**; "Thực hành tốt" 75 → 96 |
| `public/robots.txt` | Không có file thật thì SPA fallback trả `index.html` cho `/robots.txt`, trình thu thập đọc HTML (Lighthouse: 19 lỗi cú pháp) | SEO 83 → 100 |
| `<meta name="description">` | Thiếu hẳn | SEO |
| `Cache-Control: max-age=31536000, immutable` cho `/assets/*` | Tên file có hash nên nội dung không đổi dưới cùng một tên; `index.html`/`sw.js`/manifest **giữ nguyên không cache** để người dùng không kẹt bản cũ | Khách quay lại |
| Màn chờ vẽ được thứ gì đó | `<div className="loading-spinner" />` — **class đó không có CSS ở đâu cả**, nên splash kiểm tra phiên là một ô rỗng vô hình. Lighthouse báo thẳng `NO_FCP` (trang không vẽ gì) | FCP đo được thay vì lỗi |

## Cố ý KHÔNG sửa

- **"Enable text compression — 332 KiB"**: bản live **đã nén sẵn** ở tầng proxy
  của Render (`curl` xác nhận `Content-Encoding: gzip`). Con số này chỉ là hiện
  tượng của phép đo local, nơi Express phục vụ trần. Sửa nó là sửa một vấn đề
  không tồn tại trên bản thật.
- **"Improve image delivery — 208 KiB"**: poster là URL ảnh ngoài trong dữ liệu
  seed, không nằm trong tay ta.
- **`render-blocking-resources` 1,5s**: là CSS + font tự host. Bỏ chặn render
  bằng cách nội tuyến CSS quan trọng sẽ đổi cách nạp của toàn bộ hệ thiết kế —
  chi phí cao hơn hẳn 10 điểm hiệu năng, để lần sau nếu cần.
- **`label-content-name-mismatch`**: axe xếp `moderate` nên cổng a11y không
  chặn. Đáng xem lại khi rảnh, không phải lỗi chặn đường ai.

## Bẫy khi đo (đọc trước khi đo lại)

**Phải build KHÔNG có `.env`.** Bản build local mặc định nướng
`VITE_API_URL=http://localhost:4000` vào bundle, nên khi chạy prod-mode ở cổng
4100 nó gọi sang cổng 4000 — tắt server dev là trang trắng và Lighthouse trả
`NO_FCP`. Đây đúng là họ hàng của sự cố đã cắn ở GĐ3f (xem CLAUDE.md). Cách đo
đúng — giống hệt thứ Docker đóng gói, vì `.dockerignore` loại `.env`:

```bash
printf 'VITE_API_URL=\nVITE_AUTH_URL=\n' > .env.production   # tạm
npm run build
rm .env.production
NODE_ENV=production PORT=4100 JWT_SECRET=... npm run start:prod   # cửa sổ khác
node scripts/lighthouse.mjs
```

Báo cáo JSON (`lighthouse-*.json`) đã vào `.gitignore` — chỉ commit bảng này.
