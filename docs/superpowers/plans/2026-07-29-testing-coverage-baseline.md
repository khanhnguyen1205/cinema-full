# Coverage nền — theo từng lát (2026-07-29)

Đo bằng `npm run test:cov`, **chưa đặt ngưỡng** (ngưỡng chốt ở lát T9 của spec —
đặt sớm sẽ chặn chính các lát đang làm dở).

## Tổng

| Chỉ số     | Sau T1+T2 | Sau T3    |
| ---------- | --------- | --------- |
| statements | 19.39%    | **23.71%** |
| branches   | 77.41%    | 77.33%    |
| functions  | 49.54%    | **53.81%** |
| lines      | 19.39%    | **23.71%** |
| số test    | 207       | **252**   |

Con số `branches` cao lệch hẳn so với `statements` là **bình thường và dễ hiểu
sai**: v8 chỉ đếm nhánh trong những file đã được nạp, mà phần lớn `src/pages/*`
chưa có test nào chạm tới nên gần như không đóng góp nhánh nào vào mẫu số.
Dùng **statements/lines** làm thước đo tiến bộ chính. (Nó nhích xuống 0,08 điểm ở
T3 vì các file server mới được nạp mang theo nhánh mới — không phải hồi quy.)

## Theo khu vực

| Khu vực              | Sau T1+T2 | Sau T3     | Ghi chú                                |
| -------------------- | --------- | ---------- | -------------------------------------- |
| `src/lib`            | 100       | 100        | helper thuần — đã phủ từ trước         |
| `src/components/ui`  | 97.04     | 97.04      | primitive — đã phủ từ trước            |
| **`server/src/auth`**| 29.74     | **95.38**  | ⬆ T3: đăng ký/đăng nhập/refresh/me     |
| `src/i18n`           | 93.47     | 93.47      |                                        |
| **`server/src/api`** | 76.38     | **90.87**  | ⬆ T3: holds + occupied                 |
| `src/context`        | 82.22     | 82.22      | lên nhờ `renderWithProviders` (T1)     |
| **`server/src/payments`** | ~0   | **70.99**  | ⬆ T3: /config + /intent                |
| **`server/src/email`**| 52.59    | **67.20**  | ⬆ T3: send.ts không-bao-giờ-throw      |
| `server/src`         | 64.61     | 64.61      |                                        |
| `src/hooks`          | 62.74     | 62.74      |                                        |
| `src/services`       | 32.88     | 32.88      | → lát **T4**                           |
| `src/queries`        | 8.53      | 8.53       | → lát **T4**                           |
| `src/components`     | 3.51      | 3.51       | → lát **T5**                           |
| `src/pages`          | 0         | 0          | → lát **T6**, **T7**                   |
| `src/pages/booking`  | 0         | 0          | → lát **T7**                           |
| `src/pages/admin`    | 0         | 0          | → lát **T8**                           |
| `server/src/db`      | 0         | 0          | prisma singleton — bị mock, luôn là 0  |

**Toàn bộ phía server đã có lưới.** Phần còn lại là client: T4→T8.

Dùng bảng này để đối chiếu ở các lát sau: mỗi lát phải làm số đi lên.
