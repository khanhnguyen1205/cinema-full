# Mở rộng dữ liệu catalogue — thiết kế

Ngày: 2026-08-05

## Vấn đề

Dữ liệu hiện tại đủ để **chứng minh tính năng chạy**, không đủ để **trông như một
rạp thật**. Đo trực tiếp:

| Bảng | Hiện có | Hệ quả nhìn thấy trên màn hình |
| --- | --- | --- |
| `showtimes` | **52** | 5 rạp × 7 ngày ⇒ **~1,5 suất/rạp/ngày**. Chọn thành phố → rạp → ngày thì thường xuyên **rỗng** |
| `movies` | 16 | Lưới phim và dải "tối nay" ngắn; mỗi phim chỉ **một** thể loại nên bộ lọc thể loại gần như vô dụng |
| `reviews` | **9** | Chỉ nằm ở phim 1-6 ⇒ **10/16 phim không có đánh giá nào** |
| `users` | **4** | `@@unique([movieId, userId])` ⇒ trần cứng **4 review/phim** |
| `bookings` | **3** | Biểu đồ doanh thu recharts ở `/admin` gần như phẳng |
| `rooms` | 10 | Chỉ **2 phòng có `coupleRows`**, cả hai ở rạp 1 ⇒ ghế đôi vô hình ở 4/5 rạp |

Bốn chỗ trên đều do người dùng chỉ ra khi mở web, không phải suy đoán.

## Mục tiêu

Đưa catalogue lên quy mô một cụm rạp thật, **trên cả DB dev lẫn production**, mà
**không xoá một dòng dữ liệu nào đang có**.

**Ngoài phạm vi:** đổi schema, đổi UI, dịch mô tả phim cũ sang tiếng Việt.

## Phát hiện quan trọng: có HAI database, không phải một

Đo lúc 2026-08-05, đọc live **trước**, đọc dev **sau** vài giây:

| | movies | showtimes | `showtime` id=1 `.time` |
| --- | --- | --- | --- |
| Live (`cinema-full-a9xt.onrender.com`) | 16 | 52 | `2026-08-04T18:00:00` |
| Neon trong `.env` máy dev | 16 | 52 | `2026-08-03T18:00:00` |

Cùng dòng, cùng id, **giá trị khác nhau một ngày**. Thứ tự đọc loại trừ khả năng
bộ dịch lịch chiếu chạy xen vào. Kết luận: `.env` trỏ vào **DB dev**;
`DATABASE_URL` của production nằm trong env vars trên Render.

Hệ quả thiết kế: **không có một lệnh nào phủ được cả hai**. Phải có hai đường ra.

Đã cân nhắc và loại đường vòng qua REST API của bản live: gateway để `cinemas` và
`cities` **read-only**, còn `reviews`/`bookings` bị ép `userId` = người gọi — nên
30 user với 200 review đa dạng không tạo được qua đó. Đường ấy chỉ phủ được
`movies`/`rooms`/`showtimes`/`users`, tức một nửa việc.

## Quyết định đã chốt

| Câu hỏi | Chốt | Vì sao |
| --- | --- | --- |
| Quy mô | 40 phim · 5 tp · 12 rạp · 24 phòng · ~840 suất · 30 user · ~200 review · ~150 đơn | Đủ đất cho mọi bộ lọc và biểu đồ; `db.json` lên ~300 KB vẫn trong tầm `createMany` |
| Ghi vào đâu | **Cả hai** — `db.json` cho dev/CI, script bồi thêm cho prod | Người dùng muốn bản live đầy, nhưng seed đè lên prod là mất vé khách |
| Ai chạy trên prod | **Người dùng chạy** | Chuỗi kết nối production không cần đi qua hội thoại với agent |
| Nguồn ảnh | Tự soạn URL TMDB rồi **curl verify từng cái** | Máy không có TMDB API key. Xem "Rủi ro còn lại" |
| Cách soạn | **Lai**: biên tập gõ tay, cơ học sinh bằng script | Giá tiền trong `Booking` phải khớp `lib/pricing.ts`; gõ tay là sai chắc chắn, mà sai thì bảng admin cộng ra số vô lý |
| Mô tả phim mới | **Tiếng Anh một dòng**, y phong cách 16 phim cũ | Trộn hai ngôn ngữ trong cùng một lưới phim nhìn cẩu thả hơn là để nguyên tiếng Anh |

## Kiến trúc

Ranh giới chính: **dữ liệu cần đầu óc người** tách khỏi **dữ liệu thuần tổ hợp**.

```
scripts/seed-data/
  movies.mjs              24 phim: title, description, duration, genre, rating + URL ảnh ứng viên
  venues.mjs              2 thành phố, 7 rạp, 14 phòng
  people.mjs              26 user (tên Việt) + kho bình luận tiếng Việt theo số sao
  concessions.mjs         6 món bắp nước
  images.verified.json    ← do verify-images sinh ra, KHÔNG gõ tay

scripts/verify-images.mjs           curl từng URL → báo cáo → ghi images.verified.json
scripts/gen-seed-data.mjs           sinh showtimes/users/reviews/bookings → NỐI vào db.json
server/prisma/backfill-seed-data.ts đẩy phần mới lên production (dry-run mặc định)
```

`verify-images` tách riêng vì nó phụ thuộc mạng và chậm (~140 request). Tách ra
thì `gen-seed-data` chạy **offline** và **lặp lại ra kết quả y hệt** — chạy lại
generator không kéo theo một đợt gọi mạng, và một hôm TMDB chậm cũng không làm
hỏng việc sinh dữ liệu.

## Ràng buộc bắt buộc tôn trọng

Bốn thứ dưới đây, vi phạm cái nào cũng làm hỏng thứ đang chạy tốt:

1. **Ngày cứng phải giữ nguyên `2026-07-14` → `2026-07-20`.** `planShift` neo theo
   ngày **sớm nhất** của fixture để đẩy nó về `hôm nay − 2`. Suất chiếu mới rơi
   ngoài 7 ngày đó sẽ neo lại chỗ khác và **lệch toàn bộ cửa sổ lịch chiếu**.
2. **Phim 7 phải không có review của user 1.** `e2e/reviews.spec.ts` chọn đúng
   phim đó vì nó trống, để tránh 409 từ `@@unique([movieId, userId])`.
3. **Dòng id 1..N hiện có không được đụng một byte.** Generator chỉ **nối thêm**,
   id chạy tiếp từ `max(id)`.
4. **Giá phải tính bằng công thức thật** của `src/lib/pricing.ts`: `ROOM_TYPE_PRICE`
   (2D 75k · 3D 95k · IMAX 120k), VIP `×1.3`, đôi `×1.6`, làm tròn nghìn, cộng
   `SERVICE_FEE`.

Unit test **không** nằm trong danh sách này: `src/test/fixtures.ts` cố ý không đọc
`db.json`. Các spec e2e còn lại dùng `.first()` / `.last()` / `count() > 0`, không
hardcode tổng số, nên tự thích nghi.

## Quy tắc sinh

| Bảng | Quy tắc |
| --- | --- |
| `showtimes` (~840) | 24 phòng × 7 ngày × 5 khung giờ. `price` = `ROOM_TYPE_PRICE[room.type]`. Mỗi phim rải qua **nhiều rạp, nhiều thành phố** để bộ chọn tp→rạp→ngày không bao giờ rỗng. `bookedSeats` 5-15% sơ đồ |
| `users` (+26) | Tên Việt, email `<ten><n>@cinema.vn`, mật khẩu **bcrypt thật** (chung `123456` để đăng nhập thử được), role `user` |
| `reviews` (~200) | Mỗi phim 3-8 user **khác nhau**. Sao lệch về 4-5. `userName` khớp `fullName`. `verified: true` **chỉ khi** user đó thật sự có booking phim đó |
| `bookings` (~150) | Rải 30 ngày trước cửa sổ chiếu ⇒ biểu đồ doanh thu có đường cong. Ghế lấy từ sơ đồ phòng, **trừ ghế đã bán**, không bán trùng. Mọi cột tiền tính bằng công thức thật |

PRNG có seed cố định ⇒ chạy lại ra kết quả giống hệt, diff ổn định giữa các lần.

## Ảnh: verify trước khi ghi

Pool ~70 phim ứng viên → curl từng `poster` + `backdrop` → phân ba nhóm:

- **poster 200 + backdrop 200** → nhận đủ
- **poster 200, backdrop 404** → nhận, `backdrop: null` — hero tự rơi về
  poster-làm-mờ. Xấu hơn, nhưng không bao giờ vỡ
- **poster 404** → loại phim khỏi pool

Lấy 24 phim đầu qua được. Pool lớn để **may rủi bị hấp thụ bởi kích thước pool**
thay vì làm thiếu phim.

### Rủi ro còn lại (chấp nhận có ý thức)

curl chứng minh **"có một ảnh ở đường dẫn đó"**, **không** chứng minh đó là ảnh
đúng phim. Đường dẫn TMDB là chuỗi băm nên không thể suy ra từ tên phim. Ba lớp
giảm thiểu, không lớp nào là bảo đảm:

1. `verify-images.mjs` in bảng kết quả để duyệt mắt **trước khi** ghi vào `db.json`
2. `api/movies-validate.ts` vẫn chặn URL không phải http(s) tuyệt đối
3. `ImageField` trong `/admin/movies` hiện thumbnail thật + kích thước thật, là
   chốt chặn cuối do người duyệt

Có TMDB API key thì rủi ro này biến mất hoàn toàn. Người dùng đã chọn không lấy key.

## Hai đường ra

**Dev/CI** — generator nối vào `db.json`, rồi `npm run prisma:seed` vào Neon dev.
Phép kiểm số dòng sẵn có trong `seed.ts` tự khớp vì cả hai phía cùng đọc `db.json`.

**Production** — `server/prisma/backfill-seed-data.ts`, dựng theo khuôn
`backfill-backdrops.ts` đã có:

- **dry-run mặc định**, `--apply` mới ghi
- **chỉ `INSERT`** — không `DELETE`, không `UPDATE`. Vé khách và phim admin tự
  thêm an toàn tuyệt đối
- khớp theo **khoá tự nhiên** (tên phim · tên+địa chỉ rạp · email user) ⇒ chạy
  hai lần không nhân đôi
- **để Postgres tự cấp id**, không ép. Prod có thể đã có phim admin thêm chiếm
  id 17+; FK được ánh xạ lại theo id thật vừa nhận. Đây là khác biệt cốt lõi so
  với `seed.ts`, vốn ép id và reset sequence

## Kiểm chứng

Sáu cổng CI phải xanh: `typecheck` · `lint` (0 cảnh báo) · `format:check` ·
`test:cov` · `e2e` · `build`.

Cộng kiểm tay, vì cổng CI không nhìn được cái đang sửa ở đây là **hình thức**:
mở `localhost:3000`, chụp trang chủ / chi tiết phim / `/admin` để duyệt. Với
production: chạy dry-run, đọc số dòng dự định chèn, rồi mới `--apply`, rồi mở
bản live **bằng trình duyệt** — không phải curl. Lý do ở `CLAUDE.md` mục "Ports &
running the app": bản live từng treo ở màn hình splash suốt 4 ngày mà `curl` vào
API vẫn trả 200 khoẻ mạnh.
