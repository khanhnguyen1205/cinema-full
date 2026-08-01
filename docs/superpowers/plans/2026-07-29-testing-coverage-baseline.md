# Coverage nền — theo từng lát (2026-07-29)

Đo bằng `npm run test:cov`, **chưa đặt ngưỡng** (ngưỡng chốt ở lát T9 của spec —
đặt sớm sẽ chặn chính các lát đang làm dở).

## Tổng

| Chỉ số     | Sau T1+T2 | Sau T3 | Sau T4 | Sau T5 | Sau T6 | Sau T7 | Sau T8     |
| ---------- | --------- | ------ | ------ | ------ | ------ | ------ | ---------- |
| statements | 19.39%    | 23.71% | 25.30% | 34.13% | 55.03% | 73.06% | **90.93%** |
| branches   | 77.41%    | 77.33% | 79.05% | 82.74% | 86.17% | 87.56% | **88.37%** |
| functions  | 49.54%    | 53.81% | 61.20% | 69.09% | 76.35% | 79.48% | **85.56%** |
| lines      | 19.39%    | 23.71% | 25.30% | 34.13% | 55.03% | 73.06% | **90.93%** |
| số test    | 207       | 252    | 289    | 334    | 383    | 432    | **477**    |

Con số `branches` cao lệch hẳn so với `statements` là **bình thường và dễ hiểu
sai**: v8 chỉ đếm nhánh trong những file đã được nạp, mà phần lớn `src/pages/*`
chưa có test nào chạm tới nên gần như không đóng góp nhánh nào vào mẫu số.
Dùng **statements/lines** làm thước đo tiến bộ chính.

**Lưu ý về phép đo:** từ T4, `coverage.include` có thêm `.jsx` — repo còn 3 file
`.jsx` (2 route guard + `admin/Modal` shim); bỏ sót chúng thì số đo nói dối rằng
chúng không được test.

## Theo khu vực

| Khu vực               | T3        | T4        | T5        | T6        | T7        | T8        | Ghi chú                            |
| --------------------- | --------- | --------- | --------- | --------- | --------- | --------- | ---------------------------------- |
| `src/lib`             | 100       | 100       | 100       | 100       | 100       | 100       | helper thuần                       |
| `src/routes`          | —         | **100**   | 100       | 100       | 100       | 100       | T4                                 |
| `src/hooks`           | 62.74     | **100**   | 100       | 100       | 100       | 100       | T4: `usePagination`                |
| `src/i18n`            | 93.47     | 93.47     | **100**   | 100       | 100       | 100       | T5                                 |
| `src/pages/admin`     | 0         | 0         | 0         | 0         | 0         | **99.48** | ⬆ T8 — lát này (6 trang)           |
| `src/components/ui`   | 97.04     | 97.04     | **98.76** | 98.76     | 98.76     | 98.76     | T5                                 |
| `src/context`         | 82.22     | **93.33** | 93.33     | 93.33     | **96.66** | 96.66     | T7 (đăng nhập thật qua Login)      |
| **`src/queries`**     | 8.53      | 19.91     | 32.11     | 52.84     | 56.91     | **95.93** | ⬆ T8 kéo theo `admin.ts`           |
| `src/pages`           | 0         | 0         | 0         | 71.80     | **95.52** | 95.52     | T7 (Login/Register/MyTickets)      |
| `server/src/auth`     | **95.38** | 95.38     | 95.38     | 95.38     | 95.38     | 95.38     | T3                                 |
| `src/pages/booking`   | 0         | 0         | 0         | 0         | **91.10** | 91.10     | T7 (wizard 4 bước)                 |
| `server/src/api`      | **90.87** | 90.87     | 90.87     | 90.87     | 90.87     | 90.87     | T3                                 |
| **`src/services`**    | 32.88     | 59.45     | 68.91     | 76.57     | 79.27     | **86.03** | ⬆ T8 (CRUD admin)                  |
| **`src/components`**  | 3.51      | 3.51      | **81.79** | **84.78** | 84.78     | 84.78     | T5, nhích thêm ở T6                |
| `server/src/payments` | **70.99** | 70.99     | 70.99     | 70.99     | 70.99     | 70.99     | T3                                 |
| `server/src/email`    | **67.20** | 67.20     | 67.20     | 67.20     | 67.20     | 67.20     | T3                                 |
| `server/src`          | 64.61     | 64.61     | 64.61     | 64.61     | 64.61     | 64.61     |                                    |
| `server/src/db`       | 0         | 0         | 0         | 0         | 0         | 0         | prisma singleton — bị mock, luôn 0 |

**Không còn khu vực nào 0%** ngoài ba thứ cố ý: `server/src/db` (singleton bị
mock), `src/styles/fonts.ts` (chỉ import font) và `App.tsx`/`index.tsx` (điểm
vào — dựng cây provider, e2e mới là chỗ phủ chúng).

**Ghi chú T8:** 45 test cho 6 trang admin, đưa `src/pages/admin` từ 0 lên
**99.48** và kéo `src/queries` lên **95.93** (mọi mutation admin nay có đường
chạy thật). Phần còn thiếu của toàn dự án dồn về **đường Stripe + email**
(`payments/settle.ts` 6.77, `email/resend.ts` 8.33, `email/qr.ts` 11.11) —
đều là mã gọi dịch vụ ngoài, đã có e2e thật hoặc cố ý không unit-test.

**Ghi chú T7:** 49 test cho 4 trang có luồng. Đo được `src/pages/booking`
**91.10** ngay lát đầu vì `BookingWizard` gánh gần hết logic (bốn bước + giữ ghế
+ xung đột). Phần chưa phủ tập trung ở đường **thẻ Stripe** (`StripePayForm`
75, `services/payments` 22.22) — cố ý bỏ khỏi unit test vì `@stripe/stripe-js`
nạp script thật; luồng đó do `e2e/payment.spec.ts` chạy trên Stripe test-mode
bảo chứng.

**Gotcha đo đạc:** phải chạy `npm run test:cov` (hoặc
`vitest run --coverage.enabled=true`). Kiểu `npm run test:run -- --coverage`
**không** bật được coverage khi vitest chạy nhiều project — chạy xong vẫn xanh
mà không in bảng nào, rất dễ tưởng là số cũ.

**Ghi chú T6:** phần `src/pages` chưa phủ chủ yếu là các trang chưa đụng tới
(booking wizard, Login/Register, MyTickets) — 6 trang công khai của lát này đã ở
mức cao. Hạ tầng cũng mạnh thêm: MSW nay **tôn trọng query filter**
(`?movieId=`/`?cityId=`/`?cinemaId=`), có `GET /:id` và **ghi được `reviews`**
(reset sau mỗi test).

**Ghi chú T5:** `src/components` từ 3.51 lên **81.79** chỉ với 45 test vì bảy
component có logic chiếm gần hết mã trong thư mục; phần còn thiếu là các nhánh
hiếm (ErrorBoundary khi có lỗi thật, PWAUpdatePrompt) — để lát sau nếu cần.

Dùng bảng này để đối chiếu ở các lát sau: mỗi lát phải làm số đi lên.
