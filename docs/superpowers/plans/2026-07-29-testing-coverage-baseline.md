# Coverage nền — sau T1 + T2 (2026-07-29)

Đo bằng `npm run test:cov`, **chưa đặt ngưỡng** (ngưỡng chốt ở lát T9 của spec —
đặt ngay bây giờ sẽ chặn chính các lát T3–T8 đang làm dở).

## Tổng

| Chỉ số     | Sau T1+T2 |
| ---------- | --------- |
| statements | 19.39%    |
| branches   | 77.41%    |
| functions  | 49.54%    |
| lines      | 19.39%    |

Con số `branches` cao lệch hẳn so với `statements` là **bình thường và dễ hiểu
sai**: v8 chỉ đếm nhánh trong những file đã được nạp, mà phần lớn `src/pages/*`
chưa có test nào chạm tới nên gần như không đóng góp nhánh nào vào mẫu số.
Dùng **statements/lines** làm thước đo tiến bộ chính.

## Theo khu vực

| Khu vực              | % Stmts | Ghi chú                                    |
| -------------------- | ------- | ------------------------------------------ |
| `src/lib`            | 100     | helper thuần — đã phủ từ trước             |
| `src/components/ui`  | 97.04   | primitive — đã phủ từ trước                |
| `src/i18n`           | 93.47   |                                            |
| `src/context`        | 82.22   | lên nhờ `renderWithProviders` (T1.3)       |
| `server/src/api`     | 76.38   | **T2**: gateway + repo                     |
| `server/src`         | 64.61   |                                            |
| `src/hooks`          | 62.74   |                                            |
| `server/src/email`   | 52.59   | mới có phần thuần (templates/lang)         |
| `src/services`       | 32.88   | → lát **T4**                               |
| `server/src/auth`    | 29.74   | → lát **T3**                               |
| `src/queries`        | 8.53    | → lát **T4**                               |
| `src/components`     | 3.51    | → lát **T5**                               |
| `src/pages`          | 0       | → lát **T6**, **T7**                       |
| `src/pages/booking`  | 0       | → lát **T7**                               |
| `src/pages/admin`    | 0       | → lát **T8**                               |
| `server/src/db`      | 0       | prisma singleton — bị mock, sẽ luôn là 0   |

Dùng bảng này để đối chiếu ở các lát sau: mỗi lát phải làm số đi lên.
