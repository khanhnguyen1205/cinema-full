# Tự làm mới cửa sổ lịch chiếu — thiết kế

Ngày: 2026-08-02

## Vấn đề

`server/prisma/date-shift.ts` dịch mốc thời gian **một lần duy nhất, lúc seed**,
sao cho ngày sớm nhất của fixture rơi vào `hôm nay − 2`. Fixture trải 7 ngày nên
cửa sổ thành `[hôm nay−2, hôm nay+4]`. Sau đó nó đứng yên trong khi thời gian
trôi tiếp: **khoảng ngày thứ năm kể từ lần seed, mọi suất chiếu đều thành quá
khứ**. `src/lib/time.ts` (`isUpcoming`) lọc đúng như một rạp thật ⇒ trang chủ
quảng cáo phim không đặt được, panel đặt vé rỗng, tab "Sắp tới" rỗng.

Đây không phải giả thuyết. Đã xảy ra hai lần:

- **2026-08-01** trên DB dev — 2 test e2e đỏ ở `.time-k-btn`, tưởng lỗi mã.
- **2026-08-02** trên bản live — suất muộn nhất `2026-08-01T18:30`, **0 suất đặt
  được**, trong khi `curl /api/showtimes` vẫn trả 200 với đủ 52 dòng nên nhìn
  qua thấy khoẻ.

Cách chữa hiện tại là chạy tay `npm run prisma:seed`, mà seed **xoá sạch bảng** —
mọi tài khoản và vé khách tự tạo trên live biến mất.

## Mục tiêu

Lịch chiếu tự dịch về quanh hôm nay, **không xoá dữ liệu người dùng**, không
thêm hạ tầng, không thêm cổng CI.

**Ngoài phạm vi:** seed lần đầu. Cơ chế này dịch lịch **đã có**; DB rỗng thì nó
đứng im. Tạo dữ liệu ban đầu vẫn là việc của `npm run prisma:seed`.

## Quyết định đã chốt

| Câu hỏi | Chốt | Vì sao |
| --- | --- | --- |
| Dữ liệu người dùng | **Giữ nguyên** — `UPDATE` tại chỗ, không wipe | App còn dùng để người khác vào thử; mất tài khoản khách mỗi vài ngày là hỏng |
| Khi nào dịch | **Khi phía trước còn dưới 2 ngày** | Trang không bao giờ rơi vào cảnh gần rỗng; thực tế dịch ~3 ngày một lần |
| Chạy ở đâu | **Trong chính server Express** | Render free không có Cron Job; service ngủ rồi thức ⇒ mỗi lần thức là một lần khởi động, phép kiểm chạy trước khi khách thấy trang rỗng |
| Dịch cột nào | **Chỉ `Showtime.time`** | `Booking.createdAt`/`Review.createdAt` là thời điểm CÓ THẬT của người thật; dịch chúng là bịa. Đơn khách đặt tối nay mà hiện "đặt ngày 05/08" thì vô lý ngay trên vé |

Cái giá của quyết định cuối: 3 đơn trong seed có `createdAt` cố định, sau vài lần
dịch sẽ thành "mua sau ngày chiếu". Chỗ đó chỉ hiện ở cột "Ngày đặt" của bảng
admin, và chỉ sai trên dữ liệu giả. Chấp nhận.

## Việc dọn bắt buộc: chuyển `date-shift.ts` vào `server/src/`

`server/tsconfig.build.json` đặt `rootDir: "src"` và `include: ["src/**/*.ts"]`,
nên **mã trong `server/src/` không import được `server/prisma/date-shift.ts`** —
đúng cái ràng buộc đã buộc `payments/quote.ts` phải chép lại luật giá của
`src/lib/pricing.ts`.

Ở đây **không cần chép**: `server/prisma/seed.ts` chạy bằng `tsx` và không nằm
trong bản build, nên nó import ngược vào `src/` được.

Vậy:

- `server/prisma/date-shift.ts` → **`server/src/schedule/date-shift.ts`**
- `server/prisma/date-shift.test.ts` → **`server/src/schedule/date-shift.test.ts`**
  (vitest project `server` khớp `server/**/*.test.ts` nên vẫn được nhặt)
- `seed.ts` đổi import sang `../src/schedule/date-shift`

Một nguồn sự thật duy nhất cho phép tính ngày, dùng chung giữa seed và cơ chế mới.

## Kiến trúc

Ba file, mỗi file một việc:

| File | Việc | Phụ thuộc |
| --- | --- | --- |
| `server/src/schedule/date-shift.ts` | `PAST_DAYS`/`dayOf`/`addDays`/`offsetDaysFor` như cũ, **thêm `planShift()`** | thuần — không import gì |
| `server/src/schedule/refresh.ts` | đọc showtime → hỏi `planShift` → ghi trong transaction | Prisma |
| `server/src/index.ts` | gọi lúc khởi động + đặt nhịp lặp 6 giờ | — |

### Luật quyết định (thuần)

```ts
planShift(times: string[], today: string): number | null
```

Trả về **số ngày cần dịch**, hoặc **`null` = đang khoẻ, đừng đụng vào**.

- `times` rỗng → `null` (DB chưa seed, không phải việc của nó)
- ngày muộn nhất cách `today` **≥ 2 ngày** → `null`. So sánh theo **ngày lịch**
  (`dayOf`), không theo giờ: một suất 23:00 tối mai vẫn tính là "1 ngày phía
  trước", đúng như người dùng nhìn vào dải chọn ngày.
- ngược lại → `offsetDaysFor(ngàySớmNhất, today)`, đưa cửa sổ về `[today−2, today+4]`
- kết quả bằng 0 → `null` (không có gì để làm)

Ngưỡng 2 ngày lấy từ cửa sổ khoẻ có ngày muộn nhất `today+4`: đứng im 3 ngày, sang
ngày thứ ba thì muộn nhất còn `+1` ⇒ dịch. Không bao giờ để trang xuống dưới 2
ngày đặt được.

### Ghi

`refresh.ts` đọc `{id, time}` của mọi showtime; nếu `planShift` trả số thì ghi lại
từng dòng trong **một `prisma.$transaction`**. 52 dòng, vài chục mili giây, hiếm
khi chạy.

Dùng lại `addDays` cho từng chuỗi **thay vì làm phép ngày bằng SQL**: mọi phép tính
thời gian nằm đúng một chỗ đã có test, không đẻ thêm một biến thể `to_char(...)`
để lệch. Chỉ chạm cột `Showtime.time`.

### Vòng đời

Gắn ở **`index.ts`**, KHÔNG phải `app.ts` — `app.ts` bị test supertest import, để ở
đó thì mỗi lần chạy unit test là một lần bộ hẹn giờ nổ.

```
app.listen(...) → void refreshShowtimes()        // ngay khi khởi động
                → setInterval(6 giờ).unref()
```

### Xử lý lỗi

- **Không bao giờ throw** — try/catch, log rồi thôi, đúng nếp `email/send.ts`. DB
  chậm hay mất mạng không được phép làm sập server.
- **Cờ `running` cấp module** chặn hai lượt chồng nhau (khởi động + nhịp lặp).
- **`.unref()`** để bộ hẹn giờ không giữ tiến trình sống.
- **Chỉ log khi thực sự dịch** (`🔄 Đã dịch lịch chiếu +N ngày: ...`); im lặng khi
  không làm gì, để không rác log mỗi 6 giờ.

## Kiểm thử

- **`date-shift.test.ts`**: giữ 9 test sẵn có, thêm ~6 test cho `planShift` —
  mảng rỗng → `null`; cửa sổ khoẻ (`+4`) → `null`; **biên đúng 2 ngày → `null`**;
  `+1` ngày → dịch; toàn quá khứ → dịch; offset 0 → `null`. Thuần, chạy được ở
  job `checks` không có database.
- **`refresh.ts` không có unit test** — nó import Prisma singleton, theo nếp repo
  (`gateway.ts`) thì file chạm Prisma/env không đặt test. Phần đáng sai của nó là
  phép quyết định, mà phép đó đã nằm ở chỗ thuần.
- **Sáu cổng CI giữ nguyên**, không thêm cổng. Ngưỡng coverage không bị đe doạ:
  phần thêm gần như toàn là mã thuần có test.

## Verify sau khi làm

1. `npm run test:cov` + 6 cổng xanh.
2. Cục bộ: lùi `Showtime.time` trên DB dev về quá khứ, khởi động lại `npm run auth`,
   xem log báo đã dịch và `GET /api/showtimes` cho lại suất tương lai.
3. Trên live sau khi deploy: đếm suất `time >= now` qua API **và** mở bằng trình
   duyệt headless (`.movie-k` → `.time-k-btn` → `.book-k__cta` enabled) — `curl`
   200 không chứng minh trang chạy, bài học GĐ3f.
