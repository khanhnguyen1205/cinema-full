# Movie Reviews (GĐ4-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép user đăng nhập chấm sao (1–5) + viết bình luận cho phim; hiển thị "Đánh giá của khán giả" trên MovieDetail với điểm trung bình; admin kiểm duyệt (xoá) review.

**Architecture:** Reviews là một collection REST đi qua catch-all `/api` sẵn có (`handleRest` trong `repo.ts`), với luật phân quyền riêng trong `gateway.ts` — y hệt pattern `bookings`. Model `Review` mới (FK tới Movie, cascade delete, unique `[movieId,userId]`). Điểm trung bình tính client-side. Không thêm route riêng → không đụng thứ tự mount trong `app.ts`.

**Tech Stack:** Prisma 6.19.3 + Postgres (Neon), Express 5 + TS, React 18 + TS, TanStack Query v5, Vitest (happy-dom), Playwright (chromium).

## Global Constraints

- **Hợp đồng HTTP giữ nguyên:** POST→201, DELETE→`{}`+200, id không có→404, list `orderBy:{id:"asc"}`, body lọc qua whitelist, Prisma P2002→409, P2025→404, P2003→409.
- **`server/src/api/collections.ts` KHÔNG import Prisma** (test chạy không cần DB). File server có unit test **KHÔNG import `env.ts`** (throw khi thiếu `DATABASE_URL`). `gateway.ts` được phép import prisma (không có unit test).
- **6 cổng CI phải xanh mỗi commit:** `typecheck` (tsc app + `tsc -p server/tsconfig.json`) · `lint` (ESLint 9, **0 warning**) · `format:check` (Prettier) · `test:run` (Vitest) · `e2e` (Playwright) · `build`. Cộng job `docker`.
- **Lint 0-warning:** react-refresh warning (export helper cạnh component) xử lý bằng `// eslint-disable-next-line` có chú thích, KHÔNG loosen rule. List dùng trong `useMemo` khác phải ổn định: `const xQ = useHook(); const x = useMemo(() => xQ.data ?? [], [xQ.data])`.
- **Prisma pin 6.19.3** — KHÔNG nâng 7.x (cảnh báo deprecated `package.json#prisma` bỏ qua).
- **Copy tiếng Việt.** Prices VND `.toLocaleString("vi-VN")` + `₫` (không liên quan tính năng này).
- **Windows:** kill listener :4000 trước `npm install`/`prisma generate` (khoá Prisma client). Sửa `server/**` cần restart `npm run auth` (tsx no-watch). Thêm/đổi file `.tsx` có thể trắng HMR → kill :3000 + `rm -rf node_modules/.vite` + `npm start`.
- **Absolute imports** từ `src` root (`import { qk } from "queries/keys"`), siblings dùng relative. Thêm thư mục `src/` mới phải đăng ký cả `tsconfig.json` paths lẫn `vite.config.mjs` alias (tính năng này KHÔNG thêm thư mục mới).
- **Seed data (`db.json`):** users id1 `Nguyen Van A` (a@cinema.vn), id2 `Quản trị viên` (admin), id3 `Dương Quang Minh`, id4 `Nguyễn Phong Kiên`. Bookings tồn tại: user1↔movie1 (×2), user1↔movie2. Movies id1 Avengers, id2 Spider-Man, id3 Interstellar, id4 Conjuring, id5 Dune 2, id6 Oppenheimer.

---

## Task 1 (lát 4a): Nền dữ liệu — model Review + migration + seed + type + collections metadata

**Files:**
- Modify: `server/prisma/schema.prisma` (thêm model `Review` + back-relation trong `Movie`)
- Modify: `db.json` (thêm mảng `reviews`)
- Modify: `server/prisma/seed.ts` (thêm Review vào wipe/insert/verify)
- Modify: `src/types/index.ts` (thêm interface `Review`)
- Modify: `server/src/api/collections.ts` (thêm `"reviews"` vào type + `COLLECTIONS`)
- Modify: `server/src/api/repo.ts:22-34` (thêm `reviews: prisma.review` vào `delegate()` map)
- Test: `server/src/api/collections.test.ts` (thêm ca cho `reviews`)

**Interfaces:**
- Produces: model Prisma `Review { id, movieId, userId, userName, rating, comment?, verified, createdAt }`; TS `interface Review` cùng shape; `COLLECTIONS.reviews` metadata; `db.reviews` seed array.

- [ ] **Step 1: Thêm ca test cho metadata `reviews` vào `collections.test.ts`**

Mở `server/src/api/collections.test.ts`, thêm (đặt cạnh các test hiện có):

```ts
import { COLLECTIONS, isCollection, pickWritable, parseFilters } from "./collections";

describe("reviews collection", () => {
  it("là collection hợp lệ", () => {
    expect(isCollection("reviews")).toBe(true);
  });
  it("chỉ nhận field writable (chặn id/field rác)", () => {
    const picked = pickWritable("reviews", {
      id: 99,
      rating: 5,
      comment: "hay",
      movieId: 3,
      userId: 1,
      userName: "X",
      verified: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      hacker: "drop",
    });
    expect(picked).toEqual({
      rating: 5,
      comment: "hay",
      movieId: 3,
      userId: 1,
      userName: "X",
      verified: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect("id" in picked).toBe(false);
    expect("hacker" in picked).toBe(false);
  });
  it("lọc được theo movieId (int)", () => {
    expect(parseFilters("reviews", { movieId: "5", bad: "x" })).toEqual({
      movieId: 5,
    });
  });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `npm run test:run -- collections`
Expected: FAIL (`isCollection("reviews")` false / type error `"reviews"` không thuộc `CollectionName`).

- [ ] **Step 3: Thêm `reviews` vào `collections.ts`**

Trong `server/src/api/collections.ts`, thêm `| "reviews"` vào `CollectionName` (sau `"users"`), và thêm entry vào `COLLECTIONS` (đặt sau `bookings`, trước `users`):

```ts
  reviews: {
    filterable: { id: "int", movieId: "int", userId: "int" },
    writable: [
      "movieId",
      "rating",
      "comment",
      "userId",
      "userName",
      "verified",
      "createdAt",
    ],
    json: [],
  },
```

- [ ] **Step 4: Thêm `reviews` vào delegate map trong `repo.ts`**

Trong `server/src/api/repo.ts`, hàm `delegate()` (dòng ~22), thêm vào object `map`:

```ts
    reviews: prisma.review,
```

(Đặt sau `users: prisma.user,`.)

- [ ] **Step 5: Chạy test — kỳ vọng PASS**

Run: `npm run test:run -- collections`
Expected: PASS. (Nếu `tsc` server than `prisma.review` chưa tồn tại → tiếp Step 6 sinh client rồi chạy lại.)

- [ ] **Step 6: Thêm model `Review` vào schema + back-relation**

Trong `server/prisma/schema.prisma`, thêm model (cuối file):

```prisma
model Review {
  id        Int     @id @default(autoincrement())
  movieId   Int
  movie     Movie   @relation(fields: [movieId], references: [id], onDelete: Cascade)
  userId    Int
  userName  String
  rating    Int
  comment   String?
  verified  Boolean @default(false)
  createdAt String

  @@unique([movieId, userId])
}
```

Và trong model `Movie`, thêm dòng back-relation (Prisma bắt buộc khi có `@relation`):

```prisma
  reviews Review[]
```

- [ ] **Step 7: Thêm interface `Review` vào types client**

Trong `src/types/index.ts`, thêm (sau `Concession` hoặc cuối file):

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

- [ ] **Step 8: Thêm mảng `reviews` vào `db.json`**

Thêm key `"reviews"` (đặt sau `"bookings"` hoặc `"concessions"`) với 9 bản ghi (distinct `[movieId,userId]`, 2 bản verified khớp booking user1↔movie1/movie2):

```json
"reviews": [
  { "id": 1, "movieId": 1, "userId": 1, "userName": "Nguyen Van A", "rating": 5, "comment": "Cái kết quá xứng đáng cho cả hành trình. Xem ngoài rạp nổi da gà!", "verified": true, "createdAt": "2026-06-01T10:00:00.000Z" },
  { "id": 2, "movieId": 1, "userId": 3, "userName": "Dương Quang Minh", "rating": 4, "comment": "Hoành tráng, nhiều cảm xúc. Hơi dài nhưng đáng.", "verified": false, "createdAt": "2026-06-03T14:30:00.000Z" },
  { "id": 3, "movieId": 1, "userId": 4, "userName": "Nguyễn Phong Kiên", "rating": 5, "comment": "Tuyệt phẩm khép lại Vũ trụ Điện ảnh Marvel giai đoạn 3.", "verified": false, "createdAt": "2026-06-05T20:15:00.000Z" },
  { "id": 4, "movieId": 2, "userId": 1, "userName": "Nguyen Van A", "rating": 5, "comment": "Ba đời Người Nhện hội tụ, quá đã!", "verified": true, "createdAt": "2026-06-02T09:00:00.000Z" },
  { "id": 5, "movieId": 2, "userId": 4, "userName": "Nguyễn Phong Kiên", "rating": 4, "comment": "Fan service đỉnh cao, nhưng nhịp giữa phim hơi chậm.", "verified": false, "createdAt": "2026-06-06T18:45:00.000Z" },
  { "id": 6, "movieId": 3, "userId": 3, "userName": "Dương Quang Minh", "rating": 5, "comment": "Vẫn là kiệt tác. Nhạc Hans Zimmer ám ảnh tới tận bây giờ.", "verified": false, "createdAt": "2026-06-04T21:00:00.000Z" },
  { "id": 7, "movieId": 5, "userId": 3, "userName": "Dương Quang Minh", "rating": 4, "comment": "Hình ảnh choáng ngợp, đúng chất phải xem ở IMAX.", "verified": false, "createdAt": "2026-06-07T13:20:00.000Z" },
  { "id": 8, "movieId": 6, "userId": 4, "userName": "Nguyễn Phong Kiên", "rating": 5, "comment": "Nolan chưa bao giờ làm thất vọng. Cillian Murphy xuất thần.", "verified": false, "createdAt": "2026-06-08T19:30:00.000Z" },
  { "id": 9, "movieId": 4, "userId": 1, "userName": "Nguyen Van A", "rating": 3, "comment": "Hù dọa ổn nhưng mô-típ hơi quen thuộc.", "verified": false, "createdAt": "2026-06-09T22:10:00.000Z" }
]
```

- [ ] **Step 9: Cập nhật `seed.ts` — thêm Review vào TABLES, insert, EXPECTED, verify**

Trong `server/prisma/seed.ts`:
1. Thêm `"Review"` vào cuối mảng `TABLES` (sau `"Booking"`).
2. Trong `seed()`, sau khối `prisma.booking.createMany`, thêm:

```ts
  await prisma.review.createMany({ data: db.reviews });
```

3. Thêm `Review: db.reviews.length` vào object `EXPECTED`.
4. Thêm `Review: await prisma.review.count(),` vào object `counts` trong `verify()`.

- [ ] **Step 10: Chạy migration lên Neon dev + seed**

Run:
```bash
npm run prisma:migrate -- --name reviews
npm run prisma:seed
```
Expected: migration `*_reviews` tạo + áp; seed in `console.table` có dòng `Review 9`, kết `✅ Seed khớp db.json`. (Nếu :4000 đang chạy khoá Prisma client → kill :4000 trước, sau đó `npm run auth` lại sau seed.)

- [ ] **Step 11: 6 cổng cục bộ**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`
Expected: tất cả PASS, 0 warning. (Chưa chạy e2e ở lát này — không có UI mới; e2e vẫn xanh vì không đổi luồng.)

- [ ] **Step 12: Commit + push**

```bash
git add server/prisma/schema.prisma server/prisma/migrations db.json server/prisma/seed.ts src/types/index.ts server/src/api/collections.ts server/src/api/collections.test.ts server/src/api/repo.ts
git commit -m "feat(GD4a): model Review + migration + seed review mau + collections metadata

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

---

## Task 2 (lát 4b): Gateway nhánh `reviews` + validate helper + services/api.ts

**Files:**
- Create: `server/src/api/reviews-validate.ts` (helper thuần validate + ownerOrAdmin, KHÔNG import Prisma/env)
- Test: `server/src/api/reviews-validate.test.ts`
- Modify: `server/src/api/gateway.ts` (thêm nhánh `reviews`, import prisma + helper)
- Modify: `src/services/api.ts` (thêm review helpers + `postOrThrow` cho 409)

**Interfaces:**
- Consumes: `COLLECTIONS.reviews`, `handleRest`, `getUserFromReq`, `prisma`.
- Produces (server): `validateReviewInput(body): { ok: true; rating: number; comment?: string } | { ok: false; message: string }`; `ownerOrAdmin(reviewUserId: number, user: {id:number;role:string}|null): boolean`.
- Produces (client): `getReviews(movieId)`, `createReview({movieId,rating,comment})`, `updateReview(id,{rating,comment})`, `deleteReview(id)`.

- [ ] **Step 1: Viết test cho `reviews-validate.ts` (FAIL trước)**

Create `server/src/api/reviews-validate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateReviewInput, ownerOrAdmin } from "./reviews-validate";

describe("validateReviewInput", () => {
  it("nhận rating 1..5 + comment tùy chọn", () => {
    expect(validateReviewInput({ rating: 5 })).toEqual({ ok: true, rating: 5 });
    expect(validateReviewInput({ rating: 3, comment: "ổn" })).toEqual({
      ok: true,
      rating: 3,
      comment: "ổn",
    });
  });
  it("từ chối rating ngoài 1..5 hoặc không nguyên", () => {
    expect(validateReviewInput({ rating: 0 }).ok).toBe(false);
    expect(validateReviewInput({ rating: 6 }).ok).toBe(false);
    expect(validateReviewInput({ rating: 3.5 }).ok).toBe(false);
    expect(validateReviewInput({}).ok).toBe(false);
  });
  it("từ chối comment quá 500 ký tự", () => {
    expect(validateReviewInput({ rating: 4, comment: "a".repeat(501) }).ok).toBe(
      false,
    );
  });
  it("bỏ comment rỗng/whitespace (coi như không có)", () => {
    expect(validateReviewInput({ rating: 4, comment: "   " })).toEqual({
      ok: true,
      rating: 4,
    });
  });
});

describe("ownerOrAdmin", () => {
  it("true cho chủ sở hữu", () => {
    expect(ownerOrAdmin(7, { id: 7, role: "user" })).toBe(true);
  });
  it("true cho admin dù không phải chủ", () => {
    expect(ownerOrAdmin(7, { id: 2, role: "admin" })).toBe(true);
  });
  it("false cho user khác / chưa đăng nhập", () => {
    expect(ownerOrAdmin(7, { id: 3, role: "user" })).toBe(false);
    expect(ownerOrAdmin(7, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test — FAIL**

Run: `npm run test:run -- reviews-validate`
Expected: FAIL (module chưa tồn tại).

- [ ] **Step 3: Viết `reviews-validate.ts`**

Create `server/src/api/reviews-validate.ts`:

```ts
// Thuần — KHÔNG import Prisma/env (test chạy không cần DB).
export type ReviewInput =
  | { ok: true; rating: number; comment?: string }
  | { ok: false; message: string };

export function validateReviewInput(body: {
  rating?: unknown;
  comment?: unknown;
}): ReviewInput {
  const rating = body.rating;
  if (
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return { ok: false, message: "Điểm đánh giá phải từ 1 đến 5 sao." };
  }
  let comment: string | undefined;
  if (body.comment != null) {
    if (typeof body.comment !== "string") {
      return { ok: false, message: "Bình luận không hợp lệ." };
    }
    const trimmed = body.comment.trim();
    if (trimmed.length > 500) {
      return { ok: false, message: "Bình luận tối đa 500 ký tự." };
    }
    if (trimmed.length > 0) comment = trimmed;
  }
  return comment === undefined
    ? { ok: true, rating }
    : { ok: true, rating, comment };
}

export function ownerOrAdmin(
  reviewUserId: number,
  user: { id: number; role: string } | null,
): boolean {
  if (!user) return false;
  return user.role === "admin" || user.id === reviewUserId;
}
```

- [ ] **Step 4: Chạy test — PASS**

Run: `npm run test:run -- reviews-validate`
Expected: PASS.

- [ ] **Step 5: Thêm nhánh `reviews` vào `gateway.ts`**

Trong `server/src/api/gateway.ts`, thêm import ở đầu:

```ts
import { prisma } from "../db/prisma";
import { validateReviewInput, ownerOrAdmin } from "./reviews-validate";
```

Thêm khối xử lý `reviews` **trước** khối `catalog` (`if (PUBLIC_READ.has(collection))`) và sau khối `bookings`:

```ts
    // reviews: đọc công khai; tạo cần đăng nhập; sửa/xoá = chủ-hoặc-admin
    if (collection === "reviews") {
      if (isRead) {
        await handleRest(req, res, rest); // ?movieId= lọc qua filterable
        return;
      }
      if (!user) {
        deny(401, "Vui lòng đăng nhập.");
        return;
      }
      if (req.method === "POST") {
        const v = validateReviewInput(req.body ?? {});
        if (!v.ok) {
          deny(400, v.message);
          return;
        }
        const movieId = Number((req.body ?? {}).movieId);
        if (!Number.isFinite(movieId)) {
          deny(400, "Thiếu movieId hợp lệ.");
          return;
        }
        const movie = await prisma.movie.findUnique({ where: { id: movieId } });
        if (!movie) {
          deny(404, "Phim không tồn tại.");
          return;
        }
        const bookedCount = await prisma.booking.count({
          where: { movieId, userId: user.id },
        });
        // ReqUser chỉ có {id, role} (JWT không mang tên) -> lấy fullName từ DB.
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        req.body = {
          movieId,
          rating: v.rating,
          comment: v.comment ?? null,
          userId: user.id,
          userName: dbUser?.fullName ?? "Người dùng",
          verified: bookedCount > 0,
          createdAt: new Date().toISOString(),
        };
        await handleRest(req, res, rest);
        return;
      }
      // PATCH / DELETE /reviews/:id
      const rid = Number(rest.split("/")[1]);
      if (!Number.isFinite(rid)) {
        deny(404, "Không tìm thấy.");
        return;
      }
      const existing = await prisma.review.findUnique({ where: { id: rid } });
      if (!existing) {
        deny(404, "Không tìm thấy đánh giá.");
        return;
      }
      if (!ownerOrAdmin(existing.userId, user)) {
        deny(403, "Không có quyền.");
        return;
      }
      if (req.method === "PATCH") {
        const v = validateReviewInput(req.body ?? {});
        if (!v.ok) {
          deny(400, v.message);
          return;
        }
        req.body = { rating: v.rating, comment: v.comment ?? null }; // chủ chỉ sửa rating/comment
      }
      await handleRest(req, res, rest);
      return;
    }
```

Lưu ý: `getUserFromReq` trả `ReqUser` có `fullName` (kiểm bằng đọc `server/src/auth/middleware.ts` / `types.ts`; nếu field tên khác thì dùng đúng field). `req.body.comment = null` để ghi đè comment cũ khi sửa (Prisma nhận null cho cột String? nullable).

- [ ] **Step 6: Thêm review helpers vào `services/api.ts`**

Trong `src/services/api.ts`: thêm `Review` vào import types; thêm sau nhóm booking helpers:

```ts
// --- Reviews ---
export const getReviews = (movieId: Id) =>
  get<Review[]>(`/reviews?movieId=${movieId}`);
export const getAllReviews = () => get<Review[]>(`/reviews`);

// POST/PATCH review: ném lỗi kèm message tiếng Việt khi non-ok (vd 409 đã đánh giá).
const sendReview = async <T>(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<T> => {
  const r = await req(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const msg = await r
      .json()
      .then((d: { error?: string }) => d.error)
      .catch(() => undefined);
    throw new Error(msg || "Không thể lưu đánh giá.");
  }
  return r.json() as Promise<T>;
};

export const createReview = (b: {
  movieId: Id;
  rating: number;
  comment?: string;
}) => sendReview<Review>("/reviews", "POST", b);
export const updateReview = (
  id: Id,
  b: { rating: number; comment?: string },
) => sendReview<Review>(`/reviews/${id}`, "PATCH", b);
export const deleteReview = (id: Id) => del(`/reviews/${id}`);
```

- [ ] **Step 7: Restart server + verify bằng curl**

Kill listener :4000, `npm run auth` (nền). Rồi:

```bash
BASE=http://localhost:4000; JAR=$(mktemp)
# đọc công khai
curl -s "$BASE/api/reviews?movieId=1" | grep -o '"id"' | wc -l          # kỳ vọng 3
# tạo khi chưa login -> 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/reviews" -H "Content-Type: application/json" -d '{"movieId":3,"rating":5}'  # 401
# login user thường
curl -s -c "$JAR" -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"a@cinema.vn","password":"123456"}' >/dev/null
# rating sai -> 400
curl -s -b "$JAR" -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/reviews" -H "Content-Type: application/json" -d '{"movieId":3,"rating":9}'  # 400
# tạo hợp lệ cho phim user1 CHƯA review (vd movie 7) -> 201, verified=false (user1 ko book movie7)
curl -s -b "$JAR" -X POST "$BASE/api/reviews" -H "Content-Type: application/json" -d '{"movieId":7,"rating":4,"comment":"test"}' -w "\n%{http_code}\n"
# trùng (đã review movie1) -> 409
curl -s -b "$JAR" -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/reviews" -H "Content-Type: application/json" -d '{"movieId":1,"rating":2}'  # 409
# sửa review của người khác (id 2 = user3) -> 403
curl -s -b "$JAR" -o /dev/null -w "%{http_code}\n" -X PATCH "$BASE/api/reviews/2" -H "Content-Type: application/json" -d '{"rating":1}'  # 403
rm -f "$JAR"
```
Expected: 3, 401, 400, (json + 201), 409, 403. **Dọn review test vừa tạo** (login admin xoá, hoặc lấy id rồi DELETE) để DB về 9 bản; rồi `npm run prisma:seed` cho chắc. Xoá cookie jar khỏi repo nếu rơi vào đó.

- [ ] **Step 8: 6 cổng (trừ e2e) + commit**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`
Expected: PASS, 0 warning.

```bash
git add server/src/api/reviews-validate.ts server/src/api/reviews-validate.test.ts server/src/api/gateway.ts src/services/api.ts
git commit -m "feat(GD4b): gateway nhanh reviews (validate/verified/ownerOrAdmin) + services api

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

---

## Task 3 (lát 4c): Query hooks + StarRating + reviewStats

**Files:**
- Modify: `src/queries/keys.ts` (thêm `reviews(movieId)`, `allReviews`)
- Create: `src/queries/reviews.ts`
- Create: `src/lib/reviewStats.ts`
- Test: `src/lib/reviewStats.test.ts`
- Create: `src/components/ui/StarRating.tsx`
- Test: `src/components/ui/StarRating.test.tsx`
- Modify: `src/components/ui/index.ts` (barrel export StarRating)
- Modify: `src/components/ui/ui.css` (style `.ui-stars*`)

**Interfaces:**
- Consumes: `getReviews`, `createReview`, `updateReview`, `deleteReview`, `getAllReviews`, `Review`, `qk`.
- Produces: `useMovieReviews(movieId)`, `useCreateReview()`, `useUpdateReview()`, `useDeleteReview()`; `reviewStats(reviews): { average, count, distribution }`; `<StarRating value onChange? readonly? size? />`.

- [ ] **Step 1: Test `reviewStats` (FAIL trước)**

Create `src/lib/reviewStats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { reviewStats } from "./reviewStats";
import type { Review } from "types";

const mk = (rating: number): Review => ({
  id: rating,
  movieId: 1,
  userId: rating,
  userName: "U",
  rating,
  verified: false,
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("reviewStats", () => {
  it("mảng rỗng -> average 0, count 0", () => {
    expect(reviewStats([])).toEqual({
      average: 0,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });
  it("tính trung bình (làm tròn 1 chữ số) + phân bố", () => {
    const s = reviewStats([mk(5), mk(4), mk(5)]);
    expect(s.count).toBe(3);
    expect(s.average).toBe(4.7); // 14/3 = 4.666...
    expect(s.distribution[5]).toBe(2);
    expect(s.distribution[4]).toBe(1);
  });
});
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npm run test:run -- reviewStats`
Expected: FAIL (module chưa có).

- [ ] **Step 3: Viết `reviewStats.ts`**

Create `src/lib/reviewStats.ts`:

```ts
import type { Review } from "types";

export type RatingKey = 1 | 2 | 3 | 4 | 5;
export interface ReviewStats {
  average: number;
  count: number;
  distribution: Record<RatingKey, number>;
}

export function reviewStats(reviews: Review[]): ReviewStats {
  const distribution: Record<RatingKey, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of reviews) {
    const k = Math.min(5, Math.max(1, Math.round(r.rating))) as RatingKey;
    distribution[k] += 1;
    sum += r.rating;
  }
  const count = reviews.length;
  const average = count ? Math.round((sum / count) * 10) / 10 : 0;
  return { average, count, distribution };
}
```

- [ ] **Step 4: Chạy — PASS**

Run: `npm run test:run -- reviewStats`
Expected: PASS.

- [ ] **Step 5: Thêm keys**

Trong `src/queries/keys.ts`, thêm vào object `qk`:

```ts
  reviews: (movieId: number | string) => ["reviews", movieId] as const,
  allReviews: ["reviews", "all"] as const,
```

- [ ] **Step 6: Viết `queries/reviews.ts`**

Create `src/queries/reviews.ts`:

```ts
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
} from "services/api";
import type { Review } from "types";
import { qk } from "./keys";

type Id = number | string;

export const useMovieReviews = (
  movieId: Id,
): UseQueryResult<Review[]> =>
  useQuery({
    queryKey: qk.reviews(movieId),
    queryFn: () => getReviews(movieId),
  });

export const useCreateReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { movieId: Id; rating: number; comment?: string }) =>
      createReview(v),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.reviews(v.movieId) });
      qc.invalidateQueries({ queryKey: qk.allReviews });
    },
  });
};

export const useUpdateReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      id: Id;
      movieId: Id;
      rating: number;
      comment?: string;
    }) => updateReview(v.id, { rating: v.rating, comment: v.comment }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.reviews(v.movieId) });
      qc.invalidateQueries({ queryKey: qk.allReviews });
    },
  });
};

export const useDeleteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: Id; movieId?: Id }) => deleteReview(v.id),
    onSuccess: (_d, v) => {
      if (v.movieId != null)
        qc.invalidateQueries({ queryKey: qk.reviews(v.movieId) });
      qc.invalidateQueries({ queryKey: qk.allReviews });
    },
  });
};
```

- [ ] **Step 7: Test `StarRating` (FAIL trước)**

Create `src/components/ui/StarRating.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StarRating } from "./StarRating";

describe("StarRating", () => {
  it("readonly: hiển thị đúng aria-label điểm, không phải radiogroup", () => {
    render(<StarRating value={4} readonly />);
    expect(screen.getByLabelText(/4/)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
  it("input: click sao gọi onChange", () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    const stars = screen.getAllByRole("radio");
    fireEvent.click(stars[2]); // sao thứ 3
    expect(onChange).toHaveBeenCalledWith(3);
  });
  it("input: phím mũi tên phải tăng điểm", () => {
    const onChange = vi.fn();
    render(<StarRating value={2} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
```

- [ ] **Step 8: Chạy — FAIL**

Run: `npm run test:run -- StarRating`
Expected: FAIL (chưa có component).

- [ ] **Step 9: Viết `StarRating.tsx`**

Create `src/components/ui/StarRating.tsx`:

```tsx
import { cx } from "lib/cx";

interface StarRatingProps {
  value: number; // 0..5 (0 = chưa chọn); readonly cho phép số thập phân
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
}

const STARS = [1, 2, 3, 4, 5];

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
  ariaLabel,
}: StarRatingProps) {
  if (readonly) {
    return (
      <span
        className={cx("ui-stars", `ui-stars--${size}`)}
        aria-label={ariaLabel ?? `${value} trên 5 sao`}
        role="img"
      >
        {STARS.map((s) => (
          <span
            key={s}
            className={cx("ui-stars__star", value >= s - 0.5 && "is-on")}
            aria-hidden="true"
          >
            ★
          </span>
        ))}
      </span>
    );
  }

  const move = (delta: number) => {
    const next = Math.min(5, Math.max(1, (value || 0) + delta));
    onChange?.(next);
  };

  return (
    <span
      className={cx("ui-stars", "ui-stars--input", `ui-stars--${size}`)}
      role="radiogroup"
      aria-label={ariaLabel ?? "Chấm điểm từ 1 đến 5 sao"}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          move(-1);
        } else if (/^[1-5]$/.test(e.key)) {
          e.preventDefault();
          onChange?.(Number(e.key));
        }
      }}
    >
      {STARS.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          aria-label={`${s} sao`}
          className={cx("ui-stars__star", "ui-stars__btn", value >= s && "is-on")}
          tabIndex={-1}
          onClick={() => onChange?.(s)}
        >
          ★
        </button>
      ))}
    </span>
  );
}
```

- [ ] **Step 10: Barrel export + CSS**

Trong `src/components/ui/index.ts`, thêm: `export { StarRating } from "./StarRating";`

Trong `src/components/ui/ui.css`, thêm (accent đỏ, viền cứng Kinetic):

```css
.ui-stars {
  display: inline-flex;
  gap: 2px;
  line-height: 1;
}
.ui-stars__star {
  color: var(--border, #444);
  font-size: 1.1rem;
}
.ui-stars--sm .ui-stars__star { font-size: 0.9rem; }
.ui-stars--lg .ui-stars__star { font-size: 1.6rem; }
.ui-stars__star.is-on { color: var(--red); }
.ui-stars--input { cursor: pointer; }
.ui-stars__btn {
  background: none;
  border: none;
  padding: 0 1px;
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.ui-stars--input:focus-visible {
  outline: 2px solid var(--red);
  outline-offset: 2px;
}
```

(Nếu biến `--border` không tồn tại trong tokens, dùng giá trị màu xám cứng phù hợp — kiểm `src/styles/tokens.css`.)

- [ ] **Step 11: Chạy test StarRating — PASS**

Run: `npm run test:run -- StarRating`
Expected: PASS.

- [ ] **Step 12: 6 cổng (trừ e2e) + commit**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`
Expected: PASS, 0 warning.

```bash
git add src/queries/keys.ts src/queries/reviews.ts src/lib/reviewStats.ts src/lib/reviewStats.test.ts src/components/ui/StarRating.tsx src/components/ui/StarRating.test.tsx src/components/ui/index.ts src/components/ui/ui.css
git commit -m "feat(GD4c): query hooks reviews + StarRating (a11y) + reviewStats

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

---

## Task 4 (lát 4d): MovieDetail — khu "Đánh giá của khán giả"

**Files:**
- Modify: `src/pages/MovieDetail.tsx` (thêm 1 component `ReviewsSection` + render trong mạch N°)
- Modify: `src/pages/MovieDetail.css` (class `.rev-k*`)

**Interfaces:**
- Consumes: `useMovieReviews`, `useCreateReview`, `useUpdateReview`, `useDeleteReview`, `reviewStats`, `StarRating`, `useAuth`, `Reveal`, `Section`, `Skeleton`, `Button`.
- Produces: khu review hiển thị + form; không export gì mới cho task sau.

- [ ] **Step 1: Đọc cấu trúc MovieDetail hiện tại**

Run: đọc `src/pages/MovieDetail.tsx` để tìm (a) số N° hiện có (N°01/02/03) để chèn khu review N° tiếp theo, (b) cách import `Reveal`/`Section`, (c) biến `movie`/`id`. Đọc `useAuth` từ `context/AuthContext`.

- [ ] **Step 2: Thêm component `ReviewsSection` trong `MovieDetail.tsx`**

Thêm (cùng file, dưới component chính hoặc tách nội bộ) một component nhận `movieId: number`:

```tsx
function ReviewsSection({ movieId }: { movieId: number }) {
  const { user } = useAuth();
  const reviewsQ = useMovieReviews(movieId);
  const reviews = useMemo(
    () => [...(reviewsQ.data ?? [])].sort((a, b) => b.id - a.id),
    [reviewsQ.data],
  );
  const stats = useMemo(() => reviewStats(reviews), [reviews]);
  const mine = useMemo(
    () => reviews.find((r) => r.userId === user?.id),
    [reviews, user],
  );

  const createM = useCreateReview();
  const updateM = useUpdateReview();
  const deleteM = useDeleteReview();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Nạp sẵn khi vào chế độ sửa review của mình.
  useEffect(() => {
    if (editing && mine) {
      setRating(mine.rating);
      setComment(mine.comment ?? "");
    }
  }, [editing, mine]);

  const submit = async () => {
    setError(null);
    if (rating < 1) {
      setError("Vui lòng chọn số sao.");
      return;
    }
    try {
      if (mine && editing) {
        await updateM.mutateAsync({
          id: mine.id,
          movieId,
          rating,
          comment: comment.trim() || undefined,
        });
        setEditing(false);
      } else {
        await createM.mutateAsync({
          movieId,
          rating,
          comment: comment.trim() || undefined,
        });
        setRating(0);
        setComment("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu đánh giá.");
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Xoá đánh giá này?")) return;
    await deleteM.mutateAsync({ id, movieId });
    if (mine?.id === id) {
      setEditing(false);
      setRating(0);
      setComment("");
    }
  };

  return (
    <Section>
      <Reveal>
        <div className="rev-k">
          <div className="rev-k__head">
            <div className="rev-k__score">
              <span className="rev-k__avg">{stats.average.toFixed(1)}</span>
              <StarRating value={stats.average} readonly size="lg" />
              <span className="rev-k__count">{stats.count} đánh giá</span>
            </div>
          </div>

          {/* Form: đã đăng nhập */}
          {user ? (
            mine && !editing ? (
              <div className="rev-k__mine">
                <span className="rev-k__mine-label">Đánh giá của bạn:</span>
                <StarRating value={mine.rating} readonly />
                {mine.comment && <p className="rev-k__mine-cmt">{mine.comment}</p>}
                <div className="rev-k__actions">
                  <Button variant="ghost" onClick={() => setEditing(true)}>
                    Sửa
                  </Button>
                  <Button variant="ghost" onClick={() => remove(mine.id)}>
                    Xoá
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rev-k__form">
                <StarRating value={rating} onChange={setRating} size="lg" />
                <textarea
                  className="rev-k__textarea"
                  maxLength={500}
                  placeholder="Chia sẻ cảm nhận của bạn (tùy chọn)…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="rev-k__form-foot">
                  <span className="rev-k__counter">{comment.length}/500</span>
                  <Button
                    onClick={submit}
                    disabled={createM.isPending || updateM.isPending}
                  >
                    {mine ? "Cập nhật" : "Gửi đánh giá"}
                  </Button>
                </div>
                {error && <p className="rev-k__error">{error}</p>}
              </div>
            )
          ) : (
            <p className="rev-k__login">
              <Link to="/login">Đăng nhập</Link> để viết đánh giá.
            </p>
          )}

          {/* Danh sách */}
          {reviewsQ.isLoading ? (
            <Skeleton />
          ) : reviews.length === 0 ? (
            <p className="rev-k__empty">
              Chưa có đánh giá — hãy là người đầu tiên!
            </p>
          ) : (
            <ul className="rev-k__list">
              {reviews.map((r) => (
                <li key={r.id} className="rev-k__item">
                  <div className="rev-k__item-top">
                    <span className="rev-k__name">{r.userName}</span>
                    {r.verified && <span className="rev-k__badge">Đã xem</span>}
                    <StarRating value={r.rating} readonly size="sm" />
                  </div>
                  {r.comment && <p className="rev-k__cmt">{r.comment}</p>}
                  <div className="rev-k__item-foot">
                    <time>{new Date(r.createdAt).toLocaleDateString("vi-VN")}</time>
                    {(r.userId === user?.id || user?.role === "admin") && (
                      <button
                        type="button"
                        className="rev-k__del"
                        onClick={() => remove(r.id)}
                      >
                        Xoá
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Reveal>
    </Section>
  );
}
```

Thêm imports cần thiết ở đầu file: `useState`, `useEffect`, `useMemo` (nếu chưa), `Link` (react-router-dom), `useAuth` (context/AuthContext), `useMovieReviews`/`useCreateReview`/`useUpdateReview`/`useDeleteReview` (queries/reviews), `reviewStats` (lib/reviewStats), `StarRating`/`Button`/`Section`/`Reveal`/`Skeleton` (components/ui). Render `<ReviewsSection movieId={movie.id} />` trong JSX chính, sau khu N° cuối cùng (đánh nhãn `N°04` nếu trang dùng số N° — dùng component `Numbered` giống các khu khác nếu có).

- [ ] **Step 3: CSS `.rev-k`**

Thêm vào `src/pages/MovieDetail.css` (bám Kinetic: viền cứng, mono label, accent đỏ, badge bone). Ví dụ tối thiểu:

```css
.rev-k { display: flex; flex-direction: column; gap: 20px; }
.rev-k__score { display: flex; align-items: center; gap: 12px; }
.rev-k__avg { font-family: var(--font-display, "Bebas Neue"); font-size: 3rem; color: var(--red); line-height: 1; }
.rev-k__count { font-family: var(--font-mono, "Space Mono"); font-size: 0.8rem; opacity: 0.7; }
.rev-k__form, .rev-k__mine { border: var(--bw-1, 1px) solid currentColor; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.rev-k__textarea { width: 100%; min-height: 80px; background: transparent; border: 1px solid currentColor; color: inherit; padding: 8px; font: inherit; resize: vertical; }
.rev-k__form-foot { display: flex; align-items: center; justify-content: space-between; }
.rev-k__counter { font-family: var(--font-mono, "Space Mono"); font-size: 0.75rem; opacity: 0.6; }
.rev-k__error { color: var(--red); font-size: 0.85rem; }
.rev-k__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px; }
.rev-k__item { border-top: 1px solid currentColor; padding-top: 12px; }
.rev-k__item-top { display: flex; align-items: center; gap: 10px; }
.rev-k__name { font-weight: 700; }
.rev-k__badge { background: var(--surface-invert); color: var(--text-invert); font-family: var(--font-mono, "Space Mono"); font-size: 0.65rem; padding: 2px 6px; text-transform: uppercase; }
.rev-k__cmt { margin: 6px 0; }
.rev-k__item-foot { display: flex; gap: 12px; font-family: var(--font-mono, "Space Mono"); font-size: 0.75rem; opacity: 0.7; }
.rev-k__del { background: none; border: none; color: var(--red); cursor: pointer; font: inherit; }
.rev-k__login a { color: var(--red); }
@media (max-width: 640px) { .rev-k__avg { font-size: 2.2rem; } }
```

(Điều chỉnh tên biến token cho khớp `tokens.css` thực tế — kiểm trước khi dùng `--bw-1`, `--surface-invert`, `--text-invert`, `--font-display`, `--font-mono`.)

- [ ] **Step 4: Verify UI bằng screenshot headless**

Restart web nếu cần (`rm -rf node_modules/.vite` khi trắng). Dùng script screenshot `.mjs` trong project (import `chromium` từ `@playwright/test`, `--virtual-time-budget` không áp dụng — chờ networkidle + cuộn cho `Reveal` fire), chụp `/movie/1` desktop + mobile: kỳ vọng khu "Đánh giá của khán giả" hiện điểm trung bình (movie1 = 4.7), 3 review, badge "Đã xem" ở review user1, form chấm sao khi đã login. Xoá script trước `format:check`. Review qua Artifact gallery (nhúng PNG base64) để mở trên điện thoại.

- [ ] **Step 5: 6 cổng (trừ e2e) + commit**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`
Expected: PASS, 0 warning. (Chú ý exhaustive-deps: `reviews`/`stats`/`mine` đã bọc `useMemo`.)

```bash
git add src/pages/MovieDetail.tsx src/pages/MovieDetail.css
git commit -m "feat(GD4d): MovieDetail khu Danh gia cua khan gia (form + list + badge Da xem)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

---

## Task 5 (lát 4e): AdminReviews + link sidebar + useAllReviews

**Files:**
- Modify: `src/queries/admin.ts` (thêm `useAllReviews`, import `getAllReviews`, `deleteReview` đã có ở reviews hook — dùng `useDeleteReview` từ `queries/reviews`)
- Create: `src/pages/admin/AdminReviews.tsx`
- Modify: `src/App.tsx` (route `/admin/reviews`)
- Modify: `src/pages/admin/AdminLayout.tsx` (link nav "Đánh giá")

**Interfaces:**
- Consumes: `getAllReviews`, `useMovies`, `useDeleteReview`, `ConfirmDialog`, `Pagination`, `Review`.
- Produces: trang admin quản lý review.

- [ ] **Step 1: Thêm `useAllReviews` vào `queries/admin.ts`**

Thêm import `getAllReviews` từ `services/api`, và:

```ts
import type { Review } from "types";
// ...
export const useAllReviews = (): UseQueryResult<Review[]> =>
  useQuery({ queryKey: qk.allReviews, queryFn: getAllReviews });
```

- [ ] **Step 2: Viết `AdminReviews.tsx`**

Create `src/pages/admin/AdminReviews.tsx` theo pattern các trang admin khác (dùng `Admin.css` `.adm-k`, `useMovies` để tra tên phim, `usePagination`, `ConfirmDialog`). Bảng: Phim | Người dùng | Sao | Bình luận (trích) | Đã xem | Ngày | Xoá. Có ô search + lọc theo sao.

```tsx
import { useMemo, useState } from "react";
import { useAllReviews } from "queries/admin";
import { useDeleteReview } from "queries/reviews";
import { useMovies } from "queries/catalog";
import { usePagination } from "hooks/usePagination";
import ConfirmDialog from "components/admin/ConfirmDialog";
import Pagination from "components/admin/Pagination";
import { StarRating } from "components/ui";
import "./Admin.css";

export default function AdminReviews() {
  const reviewsQ = useAllReviews();
  const moviesQ = useMovies();
  const reviews = useMemo(() => reviewsQ.data ?? [], [reviewsQ.data]);
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const del = useDeleteReview();

  const [q, setQ] = useState("");
  const [star, setStar] = useState("all");
  const [toDelete, setToDelete] = useState<number | null>(null);

  const movieTitle = useMemo(() => {
    const m = new Map(movies.map((mv) => [mv.id, mv.title]));
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [movies]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...reviews]
      .sort((a, b) => b.id - a.id)
      .filter((r) => (star === "all" ? true : r.rating === Number(star)))
      .filter(
        (r) =>
          !needle ||
          r.userName.toLowerCase().includes(needle) ||
          movieTitle(r.movieId).toLowerCase().includes(needle) ||
          (r.comment ?? "").toLowerCase().includes(needle),
      );
  }, [reviews, q, star, movieTitle]);

  const { page, setPage, pageItems, totalPages } = usePagination(filtered, 10);

  return (
    <div className="adm-k">
      <div className="adm-k__bar">
        <h1 className="adm-k__title">Đánh giá</h1>
        <input
          className="adm-k__search"
          placeholder="Tìm phim / người dùng / nội dung…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={star} onChange={(e) => setStar(e.target.value)}>
          <option value="all">Tất cả sao</option>
          {[5, 4, 3, 2, 1].map((s) => (
            <option key={s} value={s}>
              {s} sao
            </option>
          ))}
        </select>
      </div>

      <table className="adm-k__table">
        <thead>
          <tr>
            <th>Phim</th>
            <th>Người dùng</th>
            <th>Sao</th>
            <th>Bình luận</th>
            <th>Đã xem</th>
            <th>Ngày</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((r) => (
            <tr key={r.id}>
              <td>{movieTitle(r.movieId)}</td>
              <td>{r.userName}</td>
              <td>
                <StarRating value={r.rating} readonly size="sm" />
              </td>
              <td>{r.comment ?? "—"}</td>
              <td>{r.verified ? "✓" : ""}</td>
              <td>{new Date(r.createdAt).toLocaleDateString("vi-VN")}</td>
              <td>
                <button
                  type="button"
                  className="adm-k__del"
                  onClick={() => setToDelete(r.id)}
                >
                  Xoá
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      <ConfirmDialog
        open={toDelete != null}
        title="Xoá đánh giá?"
        message="Hành động này không thể hoàn tác."
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete != null) {
            const r = reviews.find((x) => x.id === toDelete);
            await del.mutateAsync({ id: toDelete, movieId: r?.movieId });
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}
```

**Lưu ý:** kiểm chữ ký thật của `usePagination`, `ConfirmDialog`, `Pagination` (props tên có thể khác — đọc file trước, khớp đúng). Nếu khác, sửa cho khớp; đừng bịa prop.

- [ ] **Step 3: Route + nav link**

Trong `src/App.tsx`, thêm route con dưới `/admin` (cạnh `bookings`):

```tsx
<Route path="reviews" element={<AdminReviews />} />
```
(import `AdminReviews from "pages/admin/AdminReviews"`.)

Trong `src/pages/admin/AdminLayout.tsx`, thêm link nav (cạnh "Đơn đặt vé"): `<NavLink to="/admin/reviews">Đánh giá</NavLink>` (khớp cách các link khác viết, class `.adm-k__nav*`).

- [ ] **Step 4: Verify + screenshot admin**

Login admin, vào `/admin/reviews`: bảng liệt kê 9 review, search + lọc sao chạy, nút Xoá mở ConfirmDialog. Screenshot verify (desktop). **Không xoá thật** review seed khi verify (hoặc seed lại sau).

- [ ] **Step 5: 6 cổng (trừ e2e) + commit**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`
Expected: PASS, 0 warning.

```bash
git add src/queries/admin.ts src/pages/admin/AdminReviews.tsx src/App.tsx src/pages/admin/AdminLayout.tsx
git commit -m "feat(GD4e): trang AdminReviews (kiem duyet/xoa) + useAllReviews + nav

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

---

## Task 6 (lát 4f): Playwright (smoke đọc + test ghi thật) + docs

**Files:**
- Modify: `e2e/smoke.spec.ts` (thêm 1 test chỉ-đọc)
- Create: `e2e/reviews.spec.ts` (test ghi thật, tự dọn)
- Modify: `CLAUDE.md` (ghi model thứ 9, collection reviews, luật gateway, route admin)

**Interfaces:**
- Consumes: app đã chạy (webServer `npm run dev`), seed reviews.

- [ ] **Step 1: Thêm smoke test chỉ-đọc**

Trong `e2e/smoke.spec.ts`, thêm (không login, không ghi):

```ts
test("MovieDetail hiển thị khu đánh giá của khán giả", async ({ page }) => {
  await page.goto("/movie/1");
  await expect(
    page.getByText("Đánh giá của khán giả", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".rev-k__item").first()).toBeVisible();
});
```

(Nếu tiêu đề khu dùng chữ khác trong Task 4, khớp đúng chuỗi đó.)

- [ ] **Step 2: Chạy smoke test mới**

Run: `npm run e2e -- smoke`
Expected: PASS (kể cả test mới).

- [ ] **Step 3: Viết `reviews.spec.ts` — luồng ghi thật, tự dọn**

Create `e2e/reviews.spec.ts` (mẫu theo `booking.spec.ts`): login user thường `a@cinema.vn/123456`, vào một phim **user1 CHƯA review trong seed** (user1 đã review movie 1,2,4 → chọn phim khác, ví dụ mở `/movie/7`), chấm sao + gửi review, khẳng định nó xuất hiện, rồi **xoá review của chính mình** trong `finally` (own-delete qua UI nút "Xoá" hoặc API):

```ts
import { test, expect } from "@playwright/test";

test("user viết & xoá đánh giá phim (ghi thật, tự dọn)", async ({ page, request }) => {
  // login
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill("a@cinema.vn");
  await page.getByPlaceholder("••••••••").fill("123456");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.locator(".user-avatar")).toBeVisible();

  await page.goto("/movie/7"); // phim user1 chưa review trong seed
  const section = page.locator(".rev-k");
  await section.scrollIntoViewIfNeeded();

  // chọn 4 sao trong form input rồi gửi
  await section.locator(".ui-stars--input .ui-stars__btn").nth(3).click();
  await section.locator(".rev-k__textarea").fill("E2E review test — sẽ xoá.");
  await section.getByRole("button", { name: /Gửi đánh giá|Cập nhật/ }).click();

  // review của mình xuất hiện (khối .rev-k__mine hoặc trong list)
  await expect(section.getByText("E2E review test", { exact: false })).toBeVisible();

  // dọn: xoá review của chính mình (chấp nhận confirm dialog)
  page.on("dialog", (d) => d.accept());
  await section.getByRole("button", { name: "Xoá" }).first().click();
  await expect(
    section.getByText("E2E review test", { exact: false }),
  ).toHaveCount(0);
});
```

**Bổ sung an toàn:** vì test có thể fail giữa chừng để lại review, thêm cleanup cứng trong `test.afterEach` hoặc `finally`: login admin qua `request.post('/auth/login')` rồi `request.get('/api/reviews?movieId=7')`, lọc review userName "Nguyen Van A" có comment chứa "E2E", `request.delete('/api/reviews/:id')`. (Theo đúng pattern dọn của `booking.spec.ts`.)

- [ ] **Step 4: Chạy reviews e2e 2 lần liên tiếp**

Run: `npm run e2e -- reviews` (hai lần)
Expected: PASS cả hai; DB về đúng 9 review sau mỗi lần (verify bằng `curl .../api/reviews?movieId=7` = 0, hoặc `npm run prisma:seed`).

- [ ] **Step 5: Chạy TOÀN BỘ e2e**

Run: `npm run e2e`
Expected: tất cả smoke + booking + reviews PASS.

- [ ] **Step 6: Cập nhật CLAUDE.md**

Sửa `CLAUDE.md`:
- Mục schema: "8 models" → **"9 models"**, thêm mô tả `Review` (FK→Movie cascade, unique[movieId,userId], verified đóng dấu lúc tạo, createdAt String).
- `api/collections.ts` / `gateway.ts`: thêm `reviews` vào danh sách collection + luật (đọc công khai, POST cần đăng nhập ép userId/verified, PATCH/DELETE chủ-hoặc-admin).
- Routing admin: thêm `/admin/reviews` `AdminReviews`.
- `src/queries/`: thêm `reviews.ts` hooks + `useAllReviews`.
- Testing: `e2e/` giờ có 3 file (smoke đọc + booking ghi + reviews ghi).
- `src/lib/`: thêm `reviewStats.ts`. `components/ui/`: thêm `StarRating`.

- [ ] **Step 7: 6 cổng đầy đủ + commit**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run e2e && npm run build`
Expected: tất cả PASS, 0 warning.

```bash
git add e2e/smoke.spec.ts e2e/reviews.spec.ts CLAUDE.md
git commit -m "test(GD4f): e2e review (smoke doc + ghi that tu don) + cap nhat CLAUDE.md

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 8: (Tùy chọn) Seed review lên DB prod**

Nếu muốn prod có review mẫu: `$env:DATABASE_URL="<pooled-production>"; $env:DIRECT_URL="<direct-production>"; npm run prisma:deploy; npm run prisma:seed` (biến inline, không đụng `.env` dev). Không bắt buộc để CI/app xanh.

---

## Self-review (đã thực hiện khi viết plan)

- **Spec coverage:** Phần 1 (data)→Task1; Phần 2 (gateway/backend)→Task2; Phần 3 (frontend hooks/StarRating/reviewStats/MovieDetail)→Task3+Task4; Phần 4 (admin)→Task5; Phần 5 (testing/docs)→Task6. Seed mẫu→Task1 Step8. verified→Task2 Step5. Cascade delete→Task1 Step6. 409/403/400→Task2 Step7.
- **Placeholder scan:** không có TBD/TODO; code cụ thể ở mỗi step. Các chỗ "khớp chữ ký thật" (usePagination/ConfirmDialog/Pagination props, tên token CSS, số N° MovieDetail) là **chỉ dẫn kiểm-trước-khi-dùng** có chủ đích, không phải placeholder — người thực thi phải đọc file để khớp, tránh bịa API.
- **Type consistency:** `Review` shape thống nhất (schema ↔ types ↔ seed ↔ collections.writable). Hook names `useMovieReviews/useCreateReview/useUpdateReview/useDeleteReview` dùng nhất quán Task3→4→5. `reviewStats` trả `{average,count,distribution}` dùng ở Task4. `validateReviewInput`/`ownerOrAdmin` định nghĩa Task2 dùng trong gateway cùng task.
