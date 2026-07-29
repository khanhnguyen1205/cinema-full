# Coverage nền — theo từng lát (2026-07-29)

Đo bằng `npm run test:cov`, **chưa đặt ngưỡng** (ngưỡng chốt ở lát T9 của spec —
đặt sớm sẽ chặn chính các lát đang làm dở).

## Tổng

| Chỉ số     | Sau T1+T2 | Sau T3     | Sau T4     |
| ---------- | --------- | ---------- | ---------- |
| statements | 19.39%    | 23.71%     | **25.30%** |
| branches   | 77.41%    | 77.33%     | **79.05%** |
| functions  | 49.54%    | 53.81%     | **61.20%** |
| lines      | 19.39%    | 23.71%     | **25.30%** |
| số test    | 207       | 252        | **289**    |

Con số `branches` cao lệch hẳn so với `statements` là **bình thường và dễ hiểu
sai**: v8 chỉ đếm nhánh trong những file đã được nạp, mà phần lớn `src/pages/*`
chưa có test nào chạm tới nên gần như không đóng góp nhánh nào vào mẫu số.
Dùng **statements/lines** làm thước đo tiến bộ chính.

**Lưu ý về phép đo:** từ T4, `coverage.include` có thêm `.jsx` — repo còn 3 file
`.jsx` (2 route guard + `admin/Modal` shim); bỏ sót chúng thì số đo nói dối rằng
chúng không được test.

## Theo khu vực

| Khu vực              | T1+T2 | T3        | T4         | Ghi chú                              |
| -------------------- | ----- | --------- | ---------- | ------------------------------------ |
| `src/lib`            | 100   | 100       | 100        | helper thuần                         |
| **`src/routes`**     | —     | —         | **100**    | ⬆ T4 (lộ ra sau khi thêm `.jsx`)     |
| **`src/hooks`**      | 62.74 | 62.74     | **100**    | ⬆ T4: `usePagination`                |
| `src/components/ui`  | 97.04 | 97.04     | 97.04      | primitive                            |
| `server/src/auth`    | 29.74 | **95.38** | 95.38      | T3                                   |
| **`src/context`**    | 82.22 | 82.22     | **93.33**  | ⬆ T4: refresh 13' + idle 30'         |
| `src/i18n`           | 93.47 | 93.47     | 93.47      |                                      |
| `server/src/api`     | 76.38 | **90.87** | 90.87      | T3                                   |
| `server/src/payments`| ~0    | **70.99** | 70.99      | T3                                   |
| `server/src/email`   | 52.59 | **67.20** | 67.20      | T3                                   |
| `server/src`         | 64.61 | 64.61     | 64.61      |                                      |
| **`src/services`**   | 32.88 | 32.88     | **59.45**  | ⬆ T4                                 |
| **`src/queries`**    | 8.53  | 8.53      | **19.91**  | ⬆ T4 (booking; catalog/admin để sau) |
| `src/components`     | 3.51  | 3.51      | 3.51       | → lát **T5**                         |
| `src/pages`          | 0     | 0         | 0          | → lát **T6**, **T7**                 |
| `src/pages/booking`  | 0     | 0         | 0          | → lát **T7**                         |
| `src/pages/admin`    | 0     | 0         | 0          | → lát **T8**                         |
| `server/src/db`      | 0     | 0         | 0          | prisma singleton — bị mock, luôn 0   |

**Toàn bộ server + tầng dữ liệu client đã có lưới.** Còn lại: components (T5) và
pages (T6–T8) — đây là chỗ chiếm ~4.500 dòng nên số tổng sẽ nhảy mạnh ở các lát đó.

Dùng bảng này để đối chiếu ở các lát sau: mỗi lát phải làm số đi lên.
