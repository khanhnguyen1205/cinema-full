# Coverage nền — theo từng lát (2026-07-29)

Đo bằng `npm run test:cov`, **chưa đặt ngưỡng** (ngưỡng chốt ở lát T9 của spec —
đặt sớm sẽ chặn chính các lát đang làm dở).

## Tổng

| Chỉ số     | Sau T1+T2 | Sau T3 | Sau T4 | Sau T5 | Sau T6     |
| ---------- | --------- | ------ | ------ | ------ | ---------- |
| statements | 19.39%    | 23.71% | 25.30% | 34.13% | **55.03%** |
| branches   | 77.41%    | 77.33% | 79.05% | 82.74% | **86.17%** |
| functions  | 49.54%    | 53.81% | 61.20% | 69.09% | **76.35%** |
| lines      | 19.39%    | 23.71% | 25.30% | 34.13% | **55.03%** |
| số test    | 207       | 252    | 289    | 334    | **383**    |

Con số `branches` cao lệch hẳn so với `statements` là **bình thường và dễ hiểu
sai**: v8 chỉ đếm nhánh trong những file đã được nạp, mà phần lớn `src/pages/*`
chưa có test nào chạm tới nên gần như không đóng góp nhánh nào vào mẫu số.
Dùng **statements/lines** làm thước đo tiến bộ chính.

**Lưu ý về phép đo:** từ T4, `coverage.include` có thêm `.jsx` — repo còn 3 file
`.jsx` (2 route guard + `admin/Modal` shim); bỏ sót chúng thì số đo nói dối rằng
chúng không được test.

## Theo khu vực

| Khu vực               | T3        | T4        | T5        | T6        | Ghi chú                            |
| --------------------- | --------- | --------- | --------- | --------- | ---------------------------------- |
| `src/lib`             | 100       | 100       | 100       | 100       | helper thuần                       |
| `src/routes`          | —         | **100**   | 100       | 100       | T4                                 |
| `src/hooks`           | 62.74     | **100**   | 100       | 100       | T4: `usePagination`                |
| `src/i18n`            | 93.47     | 93.47     | **100**   | 100       | T5                                 |
| `src/components/ui`   | 97.04     | 97.04     | **98.76** | 98.76     | T5                                 |
| `server/src/auth`     | **95.38** | 95.38     | 95.38     | 95.38     | T3                                 |
| `src/context`         | 82.22     | **93.33** | 93.33     | 93.33     | T4                                 |
| `server/src/api`      | **90.87** | 90.87     | 90.87     | 90.87     | T3                                 |
| **`src/components`**  | 3.51      | 3.51      | **81.79** | **84.78** | ⬆ T5, nhích thêm ở T6              |
| `server/src/payments` | **70.99** | 70.99     | 70.99     | 70.99     | T3                                 |
| **`src/services`**    | 32.88     | 59.45     | 68.91     | **76.57** | ⬆ T6                               |
| **`src/pages`**       | 0         | 0         | 0         | **71.80** | ⬆ T6 — lát này (6 trang công khai) |
| `server/src/email`    | **67.20** | 67.20     | 67.20     | 67.20     | T3                                 |
| `server/src`          | 64.61     | 64.61     | 64.61     | 64.61     |                                    |
| **`src/queries`**     | 8.53      | 19.91     | 32.11     | **52.84** | ⬆ T6 (catalog/reviews)             |
| `src/pages/booking`   | 0         | 0         | 0         | 0         | → lát **T7**                       |
| `src/pages/admin`     | 0         | 0         | 0         | 0         | → lát **T8**                       |
| `server/src/db`       | 0         | 0         | 0         | 0         | prisma singleton — bị mock, luôn 0 |

**Server, tầng dữ liệu client, components và 6 trang công khai đã có lưới.**
Còn lại: **wizard đặt vé + auth + MyTickets** (T7) và **6 trang admin** (T8).

**Ghi chú T6:** phần `src/pages` chưa phủ chủ yếu là các trang chưa đụng tới
(booking wizard, Login/Register, MyTickets) — 6 trang công khai của lát này đã ở
mức cao. Hạ tầng cũng mạnh thêm: MSW nay **tôn trọng query filter**
(`?movieId=`/`?cityId=`/`?cinemaId=`), có `GET /:id` và **ghi được `reviews`**
(reset sau mỗi test).

**Ghi chú T5:** `src/components` từ 3.51 lên **81.79** chỉ với 45 test vì bảy
component có logic chiếm gần hết mã trong thư mục; phần còn thiếu là các nhánh
hiếm (ErrorBoundary khi có lỗi thật, PWAUpdatePrompt) — để lát sau nếu cần.

Dùng bảng này để đối chiếu ở các lát sau: mỗi lát phải làm số đi lên.
