# GĐ4 — Tính năng 1: Review phim (đánh giá của khán giả)

**Ngày:** 2026-07-24
**Giai đoạn:** GĐ4 (chiều sâu tính năng) — tính năng đầu tiên
**Trạng thái:** Thiết kế đã duyệt, chờ lập plan

## Bối cảnh

GĐ1–GĐ3 đã hoàn tất: app đã live (Express TS + Prisma/Postgres, 1 service serve cả SPA lẫn `/api`+`/auth`). GĐ4 là "giỏ" gồm nhiều tính năng độc lập (review, search nâng cao, thanh toán sandbox, email vé, i18n, PWA). Cách làm: **decompose — từng tính năng đi trọn vòng spec → plan → code → merge**. Tài liệu này đặc tả tính năng **đầu tiên: Review phim**.

Mỗi `Movie` hiện đã có field `rating` (số ~6.8–9.0) hiển thị làm điểm sao khắp app — coi như "điểm phê bình". Review của khán giả sẽ là **một mục riêng**, không đụng vào điểm này.

## Quyết định đã chốt (qua brainstorm)

1. **Điểm phim:** giữ `Movie.rating` seed nguyên vẹn làm "điểm phê bình". Thêm mục **"Đánh giá của khán giả"** riêng trên MovieDetail, có điểm trung bình sao của user tính riêng. Không đụng dữ liệu/UI điểm cũ (rủi ro thấp).
2. **Quyền review:** mọi user đăng nhập đều viết được; review của người **đã từng đặt vé phim đó** được gắn badge **"Đã xem"** (`verified`).
3. **Vòng đời:** 1 review / user / phim; chủ review **sửa & xoá** review của mình; review **hiện ngay** khi đăng (không duyệt trước); **admin xoá được bất kỳ** review nào (kiểm duyệt kiểu gỡ bỏ).
4. **Nội dung:** chấm **1–5 sao bắt buộc** + **bình luận văn bản tùy chọn** (≤ 500 ký tự).
5. **Seed:** tạo sẵn ~8–10 review mẫu tiếng Việt (điểm đa dạng, một số `verified:true` khớp user đã có booking trong seed) để demo có nội dung.

## Kiến trúc (Approach A — reviews là collection qua gateway sẵn có)

Bám đúng pattern hiện có: reviews là một collection REST đi qua catch-all `/api`, xử lý bởi `handleRest` (`repo.ts`), với luật phân quyền riêng trong `gateway.ts` — **y hệt cách `bookings` đang làm**. Điểm trung bình tính client-side từ danh sách review. Không thêm route riêng nên **không đụng thứ tự mount load-bearing** trong `app.ts` (`/auth` → `/api/occupied-seats` → `/api/holds` → `/api` → SPA).

Đã loại: (B) router `/api/reviews` tự viết — trùng lặp, lệch pattern generic; (C) nhúng reviews thành JSON trong `Movie` — không truy vấn được, kẹt tương tranh.

## Phần 1 — Mô hình dữ liệu

Thêm **model `Review`** (model thứ 9) vào `server/prisma/schema.prisma`:

```prisma
model Review {
  id        Int      @id @default(autoincrement())
  movieId   Int
  movie     Movie    @relation(fields: [movieId], references: [id], onDelete: Cascade)
  userId    Int
  userName  String
  rating    Int      // 1..5
  comment   String?  // tùy chọn, ≤ 500 ký tự (validate ở gateway + form)
  verified  Boolean  @default(false) // true nếu user đã từng đặt vé phim này
  createdAt String   // fidelity chuỗi ISO như Showtime/Booking
  @@unique([movieId, userId])
}
```

`Movie` thêm quan hệ ngược: `reviews Review[]`.

Khác biệt có chủ đích so với `Booking`:
- **Có FK tới `Movie` + `onDelete: Cascade`** — review chỉ có nghĩa khi phim còn tồn tại (khác vé: vé là snapshot phi-FK giữ mãi). Xoá phim → xoá review kèm. Guard xoá phim client-side hiện tại vẫn chặn khi còn suất chiếu, nên đây là hành vi bổ sung an toàn.
- **`@@unique([movieId, userId])`** ép "1 review/user/phim". Vi phạm → Prisma `P2002` → `repo.ts` đã map sẵn **409**.
- **`verified`** đóng dấu **một lần lúc POST** (server đếm booking của caller cho phim đó). GET công khai không phải truy vấn booking → không rò rỉ dữ liệu người khác. Chấp nhận: review cũ không tự cập nhật verified khi user đặt vé sau này.
- `createdAt` **String** nhất quán fidelity serialize.

**Migration:** `npm run prisma:migrate -- --name reviews`. CI job `e2e` (Postgres container) tự `migrate deploy` + seed. DB prod trên Render tự `migrate deploy` lúc container khởi động — nhưng review seed mẫu chỉ có ở dev/CI; prod sẽ cần seed lại một lần (ghi chú lúc triển khai, không bắt buộc).

**`db.json`** (seed fixture) thêm mảng `reviews` với ~8–10 bản ghi mẫu (id liên tục, `createdAt` chuỗi ISO, một số `verified:true`). `server/prisma/seed.ts` thêm `Review` vào vòng wipe→insert→reset-sequence→assert-count.

**`src/types/index.ts`** thêm:
```ts
export interface Review {
  id: number;
  movieId: number;
  userId: number;
  userName: string;
  rating: number; // 1..5
  comment?: string;
  verified: boolean;
  createdAt: string;
}
```

## Phần 2 — Backend & gateway

**`server/src/api/collections.ts`** — thêm `"reviews"` vào `CollectionName` và `COLLECTIONS`:
```ts
reviews: {
  filterable: { id: "int", movieId: "int", userId: "int" },
  writable: ["movieId", "rating", "comment", "userId", "userName", "verified", "createdAt"],
  json: [],
},
```
`writable` gồm cả field do gateway kiểm soát (`userId/userName/verified/createdAt`) vì `pickWritable` chỉ giữ field trong danh sách này. **An toàn** vì gateway spread giá trị của mình **sau** `req.body` (ghi đè mọi giá trị user tự gửi — kể cả `verified:true` giả mạo). File này **KHÔNG import Prisma** (giữ để test chạy không cần DB) — chỉ thêm metadata thuần + test.

**`server/src/api/gateway.ts`** — thêm nhánh `reviews` (cạnh nhánh `bookings`, cùng phong cách `deny(); return;`). Gateway **được phép import prisma singleton** (`db/prisma.ts`) vì file này không có unit test (verify bằng curl/e2e):

- **GET** — công khai. Cho phép lọc `?movieId=` (đã có trong `filterable`). Không filter → trả tất (dùng cho AdminReviews). `handleRest` list `orderBy:{id:"asc"}` — client tự sắp mới-nhất-trước.
- **POST** — cần đăng nhập (bất kỳ user, không cần admin):
  1. Validate: `rating` là số nguyên ∈ 1..5; `comment` nếu có phải là string ≤ 500 ký tự; `movieId` là số + phim tồn tại (prisma `movie.findUnique`). Sai → `deny(400, …)`.
  2. Đếm booking của caller cho phim: `verified = (await prisma.booking.count({ where: { movieId, userId: caller.id } })) > 0`.
  3. `req.body = { ...req.body, userId: caller.id, userName: caller.fullName, verified, createdAt: new Date().toISOString() }` (giá trị gateway ghi đè sau).
  4. `handleRest` → **201**; đụng `@@unique` → `P2002` → **409** ("Bạn đã đánh giá phim này rồi.").
- **PATCH/DELETE `/api/reviews/:id`** — **chủ-hoặc-admin**:
  1. Đọc review: `prisma.review.findUnique({ where: { id } })` → không có → **404**.
  2. `if (review.userId !== caller.id && !isAdmin) deny(403)`.
  3. PATCH: chủ chỉ được sửa `rating`/`comment` (pickWritable + gateway loại các field khác khỏi body trước khi giao — hoặc dựa vào việc chủ không gửi field khác; validate lại rating/comment như POST).
  4. `handleRest` → PATCH 200 (bản ghi mới) / DELETE `{}`+200.

Helper nhỏ có thể tách: `ownerOrAdmin(review, user)` (+ test thuần nếu tách khỏi Prisma-fetch).

## Phần 3 — Frontend

**`src/queries/keys.ts`** — thêm `qk.reviews(movieId)` = `["reviews", movieId]` và `qk.allReviews` = `["reviews", "all"]`.

**`src/queries/reviews.ts`** (mới):
- `useMovieReviews(movieId)` → GET `/reviews?movieId=`.
- `useCreateReview` / `useUpdateReview` / `useDeleteReview` — mỗi mutation `invalidateQueries` `reviews(movieId)` (và `allReviews` cho admin). Không refetch thủ công.

**`src/services/api.ts`** — `getReviews(movieId)`, `createReview({movieId, rating, comment})`, `updateReview(id, {rating, comment})`, `deleteReview(id)` — đều `credentials:"include"`, khớp hợp đồng REST (POST 201, DELETE `{}`).

**`src/components/ui/StarRating.tsx`** (mới, + test + barrel):
- Chế độ **input**: chọn 1–5 sao, `role="radiogroup"`, bàn phím (mũi tên trái/phải, phím số 1–5), `aria-label`. Emit `onChange(value)`.
- Chế độ **readonly**: hiển thị điểm (hỗ trợ nửa sao cho trung bình).
- Phong cách Kinetic: sao accent **đỏ** `--red`, viền cứng, nhất quán `ui.css`.

**`src/lib/reviewStats.ts`** (mới, thuần, + test kiểu `pricing.test.ts`):
- `reviewStats(reviews: Review[])` → `{ average: number, count: number, distribution: Record<1|2|3|4|5, number> }`. `average` làm tròn 1 chữ số thập phân; mảng rỗng → `{average:0, count:0, distribution:{...0}}`.

**`src/pages/MovieDetail.tsx`** — thêm khu **N° mới "Đánh giá của khán giả"** (trong `Reveal`+`Section`, chèn vào mạch N° hiện có, đánh số tiếp):
- **Header:** điểm trung bình sao lớn (đỏ) + tổng số đánh giá + thanh phân bố 5→1 sao (từ `reviewStats`).
- **Form review** (chỉ khi đăng nhập):
  - Chưa có review của mình → `StarRating` input + `<textarea>` (đếm ký tự ≤500) + nút "Gửi đánh giá".
  - Đã có review của mình → form ở chế độ **sửa** (nạp sẵn) + nút **Xoá**.
  - Chưa đăng nhập → khối mời đăng nhập (link `/login`, giữ `state.from`).
- **Danh sách review:** mới nhất trước; mỗi thẻ = tên user + `StarRating` readonly + badge **"Đã xem"** (khi `verified`) + bình luận + thời gian tương đối. Chủ review thấy Sửa/Xoá; admin thấy Xoá trên mọi thẻ. Hiển thị ~5 đầu + nút "Xem thêm".
- **Trạng thái:** loading (Skeleton), rỗng ("Chưa có đánh giá — hãy là người đầu tiên"), lỗi 409 (inline "Bạn đã đánh giá phim này rồi").

## Phần 4 — Admin moderation

- **`src/pages/admin/AdminReviews.tsx`** (mới, dùng `Admin.css` `.adm-k`) dưới route `/admin/reviews`; thêm link vào sidebar `AdminLayout`.
- Bảng liệt kê **mọi** review: Phim (tra tên từ `useMovies`), Người dùng, Sao, Trích bình luận, "Đã xem", Ngày, nút **Xoá** (qua `ConfirmDialog` + `useDeleteReview`). Có tìm kiếm + lọc theo sao + phân trang như các bảng admin khác.
- **`src/queries/admin.ts`** thêm `useAllReviews` (key `qk.allReviews`).

## Phần 5 — Testing & CI

- **Unit (Vitest):**
  - `src/lib/reviewStats.test.ts` — trung bình/đếm/phân bố, làm tròn, mảng rỗng.
  - `src/components/ui/StarRating.test.tsx` — render readonly + tương tác bàn phím (input).
  - Bổ sung test `server/src/api/collections.test.ts` cho metadata `reviews` (filterable/writable/pickWritable chặn field ngoài whitelist).
  - `ownerOrAdmin` helper test (nếu tách được khỏi Prisma-fetch).
- **Playwright (`e2e/`):**
  - `smoke.spec.ts` (**chỉ-đọc**): thêm 1 test — MovieDetail có khu "Đánh giá của khán giả" + hiển thị điểm/danh sách (từ seed mẫu). KHÔNG ghi.
  - Test **ghi thật** riêng (kiểu `booking.spec.ts`): login user thường `a@cinema.vn/123456` → vào 1 phim → gửi review → thấy nó xuất hiện → **xoá review của chính mình trong `finally`** (own-delete qua API) để DB sạch. Chọn phim **user chưa review trong seed** để tránh 409.
- Giữ **6 cổng CI xanh** (typecheck · lint 0-warning · format:check · test:run · e2e · build) + job `docker`.
- Review demo trên điện thoại bằng screenshot headless Chrome (`--virtual-time-budget`), theo pattern phone-review.

## Cách chẻ lát (mỗi lát 1 commit, push thẳng main, 6 cổng xanh)

- **4a** — Schema `Review` + migration `reviews` + seed review mẫu (`db.json` + `seed.ts`) + `types/index.ts` + `collections.ts` metadata + test (nền dữ liệu, chưa UI).
- **4b** — Gateway nhánh `reviews` (GET/POST/PATCH/DELETE + validate + verified + ownerOrAdmin, import prisma) + `services/api.ts` + verify bằng curl (đọc công khai, POST ép userId/verified, 409 trùng, 403 sửa của người khác, 400 rating sai).
- **4c** — Query hooks (`queries/reviews.ts` + keys) + `StarRating` (ui) + `lib/reviewStats` (+ test).
- **4d** — MovieDetail: khu "Đánh giá của khán giả" (header + form + list + badge + trạng thái) — trọng tâm frontend-design.
- **4e** — AdminReviews + link sidebar + `useAllReviews`.
- **4f** — Playwright (smoke đọc + test ghi thật) + screenshot verify + cập nhật CLAUDE.md (model thứ 9, collection reviews, luật gateway, route admin, `/admin/reviews`).

## Ràng buộc & lưu ý

- **Hợp đồng HTTP giữ nguyên** cho collection mới: POST→201, DELETE→`{}`+200, id không có→404, list `orderBy:{id:"asc"}`, body lọc qua whitelist, P2002→409, P2025→404.
- `collections.ts` **không import Prisma** (giữ test không cần DB). `gateway.ts` được import prisma (không có unit test).
- File server có unit test thì **không import `env.ts`** (throw khi thiếu `DATABASE_URL`).
- Copy tiếng Việt; giá VND không liên quan. a11y cho StarRating (bàn phím). Responsive mobile-first (user review qua điện thoại).
- Windows: kill :4000 trước `npm install`/`prisma generate` (khoá Prisma client). Sửa `server/**` cần restart `npm run auth` (không watch). Đổi `.jsx`→`.tsx`/thêm file có thể trắng HMR → kill :3000 + `rm -rf node_modules/.vite` + `npm start`.
