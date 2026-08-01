# Cổng a11y + đo Lighthouse

Việc (5) của giai đoạn "dọn nợ chất lượng", sau khi nhánh test T1→T9 đã đóng
(477 test, độ phủ 90.93% là cổng CI).

## Phạm vi

**Làm:** kiểm tra a11y tự động thành **cổng CI lâu dài**, và **một đợt đo
Lighthouse** trên bản build production kèm sửa những điểm đáng sửa.

**Không làm: môi trường staging.** Đã cân nhắc và loại (người dùng chốt
2026-08-01). Lý do: repo commit thẳng `main` theo chủ ý, nên staging chỉ có
nghĩa nếu đổi sang nhánh + PR — tức là đổi cách làm việc chứ không phải thêm hạ
tầng. Nó cũng đẻ ra **database thứ hai phải seed lại định kỳ** (bẫy seed-rot đã
cắn ngày 2026-08-01), trong khi CI đã dựng Postgres thật + chạy e2e + build ảnh
Docker mỗi lần push — phần lớn giá trị của staging đã có sẵn.

## Quyết định đã chốt

| Câu hỏi                    | Chốt                                                       |
| -------------------------- | ---------------------------------------------------------- |
| a11y: cổng hay rà một lần? | **Cổng CI lâu dài** (đỏ khi có vi phạm)                     |
| Lighthouse: cổng hay đo?   | **Đo + sửa + báo cáo**, KHÔNG vào CI                        |
| Lỗi tương phản màu?        | **Sửa token cho đạt chuẩn**, kèm ảnh trước/sau để duyệt     |
| Công cụ a11y               | **axe-core trong Playwright**, chạy trong job `e2e` sẵn có  |

**Vì sao Lighthouse không thành cổng:** điểm hiệu năng trên máy CI dao động
±5–10 tùy tải, đặt ngưỡng sẽ đỏ vặt rồi mất niềm tin — mà phần Lighthouse đo
được chính xác (a11y) thì axe đã chặn rồi.

**Vì sao axe chạy trong Playwright chứ không phải `jest-axe` + happy-dom:**
happy-dom **không áp CSS** (bẫy đã ghi trong CLAUDE.md từ lát T5), nên nó **mù
hoàn toàn với lỗi tương phản** — đúng loại lỗi ta cam kết sẽ sửa. Playwright
chạy trình duyệt thật với CSS thật và dữ liệu thật từ Postgres.

## Cổng a11y

**Tệp:** `e2e/a11y.spec.ts`. **Dev-dep:** `@axe-core/playwright`.
Chạy trong job `e2e` hiện có (đã có Postgres + seed + webServer) — **không thêm
job CI nào**, chi phí thêm khoảng 10 giây.

**Số cổng CI vì thế KHÔNG đổi**: vẫn là sáu cổng (`typecheck` · `lint` ·
`format:check` · `test:cov` · `e2e` · `build`) cộng job `docker`. Kiểm tra a11y
nằm *bên trong* cổng `e2e`, không phải cổng thứ bảy — tài liệu phải nói đúng
như vậy.

### 16 trạng thái được quét

- **Công khai (8):** `/` · `/movies` · `/movie/:id` · `/cinemas` · `/cinema/:id`
  · `/search?q=…` · `/login` · `/register`
- **Đã đăng nhập (4):** `/tickets`, và **cả ba bước đầu** của wizard đặt vé
  (`/seats/:id`: ① ghế → ② bắp nước → ③ thanh toán). Đây là màn hình tương tác
  nặng nhất trong app (sơ đồ ghế roving-tabindex, radio ẩn, đồng hồ đếm ngược);
  quét trang tĩnh sẽ bỏ sót đúng chỗ dễ sai nhất.
- **Quản trị (4 + 1):** `/admin` + ba bảng đại diện, **cộng một modal đang mở**
  ("Thêm phim"). Dialog là nơi lỗi a11y hay nằm nhất (focus, `aria-modal`,
  nhãn) mà quét trang đóng không bao giờ thấy.

### Luật đỏ

Chặn ở `impact` **critical** và **serious**. `moderate`/`minor` vẫn in ra log
nhưng không làm đỏ. Đặt ngưỡng ở "mọi vi phạm" thì lần đầu sẽ đỏ vì những thứ
còn tranh cãi được, và kết cục là ai đó tắt cả cổng — cùng lý lẽ với việc đệm 1
điểm ở ngưỡng coverage (lát T9).

Hằng `EXCLUDED_RULES` ở đầu tệp, **rỗng khi bắt đầu**; thêm gì vào đó phải kèm
chú thích lý do ngay tại chỗ. Tương phản **không** được nằm trong danh sách này.

### Ràng buộc

Spec này **chỉ đọc**, đúng luật của `smoke.spec.ts`: đi tới bước ③ nhưng
**không bấm Thanh toán**, không tạo/sửa/xoá gì. Vì thế bước ④ (vé điện tử)
không quét được — bù lại `ETicket` đã có 9 unit test và `/tickets` (quét được)
render đúng component đó.

Lần chạy đầu gần như chắc chắn đỏ; đó là mục đích. Vi phạm được sửa **trước**,
để commit đưa cổng vào CI là một commit đã xanh.

## Đo Lighthouse

Chạy trên **bản build production local**: `npm run build`, rồi
`NODE_ENV=production PORT=4100 npm run start:prod` (dùng DB dev Neon), rồi
`npx lighthouse` trỏ `CHROME_PATH` vào Chromium của Playwright — **không phải
cài thêm trình duyệt**.

**Bốn trang công khai:** `/` · `/movies` · `/movie/:id` · `/cinemas`. Chỉ trang
công khai, vì Lighthouse chạy không có cookie phiên nên trang admin và trang vé
sẽ bị đá về `/login` và cho ra con số vô nghĩa.

**Chế độ mobile** (mặc định: CPU/mạng bị bóp). Số sẽ xấu hơn desktop nhiều và
đó là số đúng — người dùng thật xem bằng điện thoại.

**Sửa gì thì đo xong mới biết.** Hai thứ lường trước:

- _Dễ, ít rủi ro:_ meta description, `width`/`height` cho ảnh poster (thiếu thì
  layout shift), `font-display`.
- _Đòn bẩy lớn nhất nhưng là thay đổi mã thật:_ `recharts` (~200KB) đang nằm
  trong bundle chính dù **chỉ admin dùng** → tách route admin bằng `React.lazy`.
  Nếu số liệu chỉ đúng vào đây thì **hỏi người dùng trước**, không tự ý đổi cấu
  trúc route.

`scripts/lighthouse.mjs` được commit để lần sau đo lại y hệt. **Báo cáo JSON
không commit** — chỉ commit bảng markdown trước/sau.

## Chia lát

| #     | Nội dung                                                                             |
| ----- | ------------------------------------------------------------------------------------ |
| 1     | Cài `@axe-core/playwright`, viết spec quét, **chạy tại chỗ thu vi phạm** (chưa commit) |
| 2..n  | Sửa vi phạm theo nhóm; **nhóm tương phản đi riêng một commit** kèm ảnh trước/sau       |
| n+1   | Commit `e2e/a11y.spec.ts` + dep khi đã xanh → cổng CI                                  |
| n+2   | Đo Lighthouse → sửa phần dễ ăn → `docs/.../2026-08-01-lighthouse-baseline.md`          |
| cuối  | Cập nhật CLAUDE.md + README                                                            |

Mỗi lát giữ **7 cổng xanh** và push thẳng `main`.

## Bàn giao

- Cổng a11y chạy trong CI, đỏ khi có vi phạm critical/serious.
- Bảng điểm Lighthouse trước/sau trong `docs/`.
- Một **Artifact ảnh trước/sau** cho mọi thay đổi màu, để duyệt trên điện thoại.
- CLAUDE.md + README nói đúng bộ cổng hiện có.
