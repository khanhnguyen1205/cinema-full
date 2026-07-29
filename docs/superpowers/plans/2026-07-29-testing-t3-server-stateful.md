# Lát T3 — test cho phần server có trạng thái Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phủ nốt phần server chưa có test: **phiên đăng nhập** (`auth/routes`),
**giữ ghế** (`holds`), **ghế đã chiếm** (`occupied`), **tiền** (`payments`), và lời
hứa **"email không bao giờ làm hỏng đơn"** (`email/send`).

**Architecture:** Tiếp tục khuôn đã dựng ở T1+T2 — `supertest` bắn vào app Express
thật, `prismaMock` thay tầng DB, không cần Postgres. Thêm hai kỹ thuật mới:
`vi.setSystemTime` để tua đồng hồ (TTL giữ ghế) và mock module `payments/stripe`
để không chạm mạng Stripe.

**Tech Stack:** Vitest 3 · supertest · bcryptjs (chạy thật) · express-rate-limit ·
jsonwebtoken.

## Global Constraints

- **Kill listener :4000 TRƯỚC mọi `npm install`** (Windows khoá Prisma client), bật
  lại ngay sau đó bằng `npm run auth`. Lát này **không cần cài gì mới**.
- **7 cổng CI phải xanh mỗi commit**: `typecheck` · `lint` (**0 warning**) ·
  `format:check` · `test:run` · `e2e` · `build` · `docker`.
- **Kiểm exit code, đừng kiểm bằng mắt.** Bài học từ T2: `npm run typecheck | tail`
  luôn trả 0 vì exit code là của `tail` — một commit đã lọt vào lúc typecheck đỏ.
  Nối bằng `&&`, hoặc in `echo "EXIT=$?"` ngay sau lệnh trần.
- **KHÔNG top-level `await`** trong test server (`server/tsconfig.json` không cho).
  Dùng `vi.mock` (tự hoist) + import tĩnh.
- **Không sửa hành vi app.** Test lòi ra bug thật thì dừng, báo người dùng, sửa ở
  commit riêng.
- Prettier quét file mới ⇒ `npm run format` trước khi commit. Commit thẳng `main`,
  message tiếng Việt không dấu.

---

### Task 1: Sửa hai handler MSW sai hình dạng (lỗi để lại từ T1)

**Files:**

- Modify: `src/test/msw/handlers.ts`

**Bối cảnh:** hai handler viết ở T1 **không khớp server thật**. Không sửa thì mọi
test ghế ở lát T7 sẽ thấy "không ghế nào bị chiếm" mà vẫn **xanh** — đúng kiểu
xanh giả mà `onUnhandledRequest:"error"` sinh ra để phòng.

- [ ] **Step 1: Sửa handler `occupied-seats`**

Server thật trả `{ showtimeId, seats }` (xem `server/src/api/occupied.ts:41`) và
client đọc `d.seats` (`src/services/api.ts:59-61`). Handler đang trả mảng trần.
Thay dòng `occupied-seats` bằng:

```ts
  http.get(`${API}/occupied-seats`, ({ request }) => {
    const showtimeId = new URL(request.url).searchParams.get("showtimeId");
    // Hình dạng PHẢI khớp server thật: { showtimeId, seats } — client đọc d.seats.
    return HttpResponse.json({ showtimeId, seats: ["A1", "A2"] });
  }),
```

- [ ] **Step 2: Sửa handler `logout`**

`POST /auth/logout` thật trả **204 không thân** (`auth/routes.ts:129-132`). Thay:

```ts
  http.post(`${AUTH}/logout`, () => new HttpResponse(null, { status: 204 })),
```

- [ ] **Step 3: Chạy lại toàn bộ + kiểm exit code**

```bash
npm run test:run && npm run typecheck && npm run lint && echo "OK"
```

Expected: 207 test xanh, in ra `OK`.

- [ ] **Step 4: Format + commit**

```bash
npm run format
git add src/test/msw/handlers.ts
git commit -m "fix(test): handler MSW tra dung hinh dang server that (occupied-seats + logout 204)"
```

---

### Task 2: `auth/routes.ts` — phiên đăng nhập

**Files:**

- Modify: `server/src/test/authCookie.ts` (thêm `refreshCookieFor`)
- Create: `server/src/auth/routes.test.ts`

**Interfaces:**

- Consumes: `prismaMock`, `resetPrismaMock` (T1), `cookieFor` (T1).
- Produces: `refreshCookieFor(id: number, remember: boolean): string` — cookie `rt=`
  để test `POST /auth/refresh`.

**Lưu ý thiết kế — đọc trước khi viết:**

- `bcryptjs` chạy **thật** (không mock). Hash 10 vòng ~100ms/lần, chấp nhận được.
- `loginLimiter` giữ trạng thái **trong suốt file test** (10 lần đăng nhập SAI /
  IP / 15'). Vitest cô lập theo file nên file khác không bị ảnh hưởng, nhưng
  **trong file này thì có**: mọi lần login sai đều cộng dồn. Vì vậy khối test
  rate-limit phải nằm **CUỐI FILE** — sau khi nó chạy, không request login nào
  trong file còn qua được nữa.

- [ ] **Step 1: Thêm helper cookie refresh**

Thêm vào `server/src/test/authCookie.ts`:

```ts
import { signAccess, signRefresh } from "../auth/tokens";

// Gateway đọc user từ cookie "at" (xem auth/middleware.ts).
export const cookieFor = (id: number, role: string): string =>
  `at=${signAccess(id, role)}`;

// POST /auth/refresh đọc cookie "rt".
export const refreshCookieFor = (id: number, remember: boolean): string =>
  `rt=${signRefresh(id, remember)}`;
```

- [ ] **Step 2: Viết test đăng ký + đăng nhập**

Tạo `server/src/auth/routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";
import { cookieFor, refreshCookieFor } from "../test/authCookie";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});

const USER = {
  id: 2,
  fullName: "Người Dùng",
  email: "a@cinema.vn",
  role: "user",
};

beforeEach(() => resetPrismaMock());

describe("auth — đăng ký", () => {
  it("thiếu thông tin bị 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "x@y.z" });
    expect(res.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("mật khẩu dưới 6 ký tự bị 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ fullName: "A", email: "x@y.z", password: "123" });
    expect(res.status).toBe(400);
  });

  it("email đã tồn tại bị 409", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: "h" });
    const res = await request(app)
      .post("/auth/register")
      .send({ fullName: "A", email: "a@cinema.vn", password: "123456" });
    expect(res.status).toBe(409);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("đăng ký thành công: 201, mật khẩu ĐƯỢC HASH, thân KHÔNG chứa mật khẩu", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ ...USER, password: "hashed" });

    const res = await request(app)
      .post("/auth/register")
      .send({ fullName: "Người Dùng", email: "A@Cinema.VN ", password: "123456" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(USER);
    expect(res.body.password).toBeUndefined();

    const arg = prismaMock.user.create.mock.calls[0][0] as {
      data: Record<string, string>;
    };
    // Email được chuẩn hoá (trim + lowercase) và mật khẩu không bao giờ lưu thô.
    expect(arg.data.email).toBe("a@cinema.vn");
    expect(arg.data.password).not.toBe("123456");
    expect(arg.data.password.startsWith("$2")).toBe(true);
  });

  it("đăng ký xong có cookie phiên httpOnly", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ ...USER, password: "hashed" });

    const res = await request(app)
      .post("/auth/register")
      .send({ fullName: "A", email: "x@y.z", password: "123456" });

    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("at=") && /HttpOnly/i.test(c))).toBe(
      true,
    );
    expect(cookies.some((c) => c.startsWith("rt=") && /HttpOnly/i.test(c))).toBe(
      true,
    );
  });
});

describe("auth — đăng nhập", () => {
  it("email không tồn tại: 401 với thông báo CHUNG CHUNG", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "khong@co.vn", password: "123456" });
    expect(res.status).toBe(401);
    // Không được tiết lộ email có tồn tại hay không.
    expect(res.body.error).toBe("Email hoặc mật khẩu không đúng.");
  });

  it("sai mật khẩu: 401 cùng thông báo đó", async () => {
    const hash = await bcrypt.hash("dung-mat-khau", 10);
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: hash });
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@cinema.vn", password: "sai-mat-khau" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Email hoặc mật khẩu không đúng.");
  });

  it("đúng mật khẩu: 200 + user an toàn + cookie", async () => {
    const hash = await bcrypt.hash("123456", 10);
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: hash });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@cinema.vn", password: "123456" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(USER);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("remember=true thì cookie refresh có Max-Age (không phải cookie phiên)", async () => {
    const hash = await bcrypt.hash("123456", 10);
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: hash });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@cinema.vn", password: "123456", remember: true });

    const cookies = res.headers["set-cookie"] as unknown as string[];
    const rt = cookies.find((c) => c.startsWith("rt="))!;
    expect(rt).toMatch(/Max-Age=/i);
  });

  it("mật khẩu thô kiểu seed cũ được TỰ NÂNG CẤP sang bcrypt", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...USER,
      password: "123456", // plaintext, không bắt đầu bằng $2
    });
    prismaMock.user.update.mockResolvedValue({ ...USER });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@cinema.vn", password: "123456" });

    expect(res.status).toBe(200);
    const arg = prismaMock.user.update.mock.calls[0][0] as {
      data: { password: string };
    };
    expect(arg.data.password.startsWith("$2")).toBe(true);
  });
});
```

- [ ] **Step 3: Chạy**

Run: `npx vitest run server/src/auth/routes.test.ts`
Expected: PASS (10 test).

- [ ] **Step 4: Thêm test `/me`, `/refresh`, `/logout`**

Thêm vào cuối file (vẫn TRƯỚC khối rate-limit ở Step 6):

```ts
describe("auth — /me", () => {
  it("không cookie: 401", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("cookie hỏng: 401", async () => {
    const res = await request(app).get("/auth/me").set("Cookie", "at=rac");
    expect(res.status).toBe(401);
  });

  it("cookie hợp lệ: trả user an toàn (không có mật khẩu)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: "h" });
    const res = await request(app)
      .get("/auth/me")
      .set("Cookie", cookieFor(2, "user"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(USER);
    expect(res.body.password).toBeUndefined();
  });

  it("user đã bị xoá khỏi DB: 401 dù token còn hạn", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get("/auth/me")
      .set("Cookie", cookieFor(2, "user"));
    expect(res.status).toBe(401);
  });
});

describe("auth — /refresh", () => {
  it("không cookie rt: 401", async () => {
    const res = await request(app).post("/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("rt hợp lệ: cấp cookie mới + trả user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, password: "h" });
    const res = await request(app)
      .post("/auth/refresh")
      .set("Cookie", refreshCookieFor(2, false));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(USER);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rt của user đã bị xoá: 401", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post("/auth/refresh")
      .set("Cookie", refreshCookieFor(2, false));
    expect(res.status).toBe(401);
  });
});

describe("auth — /logout", () => {
  it("trả 204 và xoá cả hai cookie", async () => {
    const res = await request(app).post("/auth/logout");
    expect(res.status).toBe(204);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    // clearCookie => Set-Cookie với giá trị rỗng + Expires quá khứ
    expect(cookies.some((c) => c.startsWith("at="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("rt="))).toBe(true);
  });
});
```

- [ ] **Step 5: Chạy**

Run: `npx vitest run server/src/auth/routes.test.ts`
Expected: PASS (18 test).

- [ ] **Step 6: Thêm khối rate-limit — BẮT BUỘC ĐẶT CUỐI FILE**

```ts
// ⚠️ KHỐI NÀY PHẢI Ở CUỐI FILE. loginLimiter đếm theo IP và giữ trạng thái suốt
// file; sau khi nó chạm ngưỡng, MỌI request /auth/login sau đó đều bị 429 —
// kể cả request lẽ ra đăng nhập đúng.
describe("auth — chống dò mật khẩu (đặt cuối file, xem chú thích)", () => {
  it("quá 10 lần SAI trong cửa sổ thì bị 429", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null); // luôn sai

    let last = 0;
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "a@cinema.vn", password: "sai" });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
```

- [ ] **Step 7: Chạy + 3 cổng nhanh, kiểm exit code**

```bash
npx vitest run server/src/auth/routes.test.ts
npm run typecheck && npm run lint && echo "GATES_OK"
```

Expected: 19 test xanh, in `GATES_OK`.
Nếu một test đăng-nhập-đúng nào đó bỗng trả **429**, nghĩa là khối rate-limit đã
bị đặt sai chỗ — chuyển nó xuống cuối file.

- [ ] **Step 8: Format + commit**

```bash
npm run format
git add server/src/auth/routes.test.ts server/src/test/authCookie.ts
git commit -m "test(auth): dang ky/dang nhap/refresh/me/logout + hash bcrypt + tu nang cap mat khau thô + rate limit"
```

---

### Task 3: `api/holds.ts` — giữ ghế

**Files:**

- Create: `server/src/api/holds.test.ts`

**Lưu ý thiết kế:**

- Kho hold là **biến module** (`Map`), sống suốt file test. Vì vậy **mỗi test dùng
  một `showtimeId` riêng** (9001, 9002, …) để không rò trạng thái sang nhau.
- TTL 8 phút đọc bằng `Date.now()`. Dùng **`vi.setSystemTime`**, KHÔNG dùng
  `vi.useFakeTimers()` toàn phần — fake timers đầy đủ sẽ treo I/O của supertest.

- [ ] **Step 1: Viết test**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../app";
import { cookieFor } from "../test/authCookie";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});

const U2 = cookieFor(2, "user");
const U3 = cookieFor(3, "user");

afterEach(() => vi.useRealTimers());

describe("holds — giữ ghế", () => {
  it("chưa đăng nhập: 401", async () => {
    const res = await request(app)
      .post("/api/holds")
      .send({ showtimeId: 9001, seats: ["A1"] });
    expect(res.status).toBe(401);
  });

  it("thiếu showtimeId: 400", async () => {
    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ seats: ["A1"] });
    expect(res.status).toBe(400);
  });

  it("giữ được ghế trống và trả về mốc hết hạn", async () => {
    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9002, seats: ["A1", "A2"] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.expiresAt).toBeGreaterThan(Date.now());
  });

  it("người khác giữ rồi: 409 kèm danh sách ghế xung đột", async () => {
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9003, seats: ["B1", "B2"] });

    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U3)
      .send({ showtimeId: 9003, seats: ["B2", "B3"] });

    expect(res.status).toBe(409);
    expect(res.body.conflicts).toEqual(["B2"]);
  });

  it("giữ lại chính ghế mình đang giữ thì KHÔNG bị coi là xung đột", async () => {
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9004, seats: ["C1"] });

    // Heartbeat: gửi lại cùng ghế + thêm ghế mới
    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9004, seats: ["C1", "C2"] });

    expect(res.status).toBe(200);
  });

  it("gửi danh sách mới sẽ THAY THẾ danh sách cũ (bỏ chọn thì nhả ghế)", async () => {
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9005, seats: ["D1", "D2"] });
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9005, seats: ["D1"] }); // bỏ D2

    // D2 phải trống cho người khác
    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U3)
      .send({ showtimeId: 9005, seats: ["D2"] });
    expect(res.status).toBe(200);
  });

  it("DELETE nhả toàn bộ ghế của mình", async () => {
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9006, seats: ["E1"] });

    const del = await request(app)
      .delete("/api/holds?showtimeId=9006")
      .set("Cookie", U2);
    expect(del.status).toBe(204);

    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U3)
      .send({ showtimeId: 9006, seats: ["E1"] });
    expect(res.status).toBe(200);
  });

  it("DELETE thiếu showtimeId: 400", async () => {
    const res = await request(app).delete("/api/holds").set("Cookie", U2);
    expect(res.status).toBe(400);
  });

  it("hold TỰ HẾT HẠN sau 8 phút", async () => {
    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9007, seats: ["F1"] });

    // Tua đồng hồ hệ thống 9 phút (TTL là 8) — chỉ đổi Date.now(),
    // không đụng timer I/O của supertest.
    vi.setSystemTime(new Date(Date.now() + 9 * 60 * 1000));

    const res = await request(app)
      .post("/api/holds")
      .set("Cookie", U3)
      .send({ showtimeId: 9007, seats: ["F1"] });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Chạy**

Run: `npx vitest run server/src/api/holds.test.ts`
Expected: PASS (9 test).

- [ ] **Step 3: Format + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add server/src/api/holds.test.ts
git commit -m "test(holds): giu/gia han/nha ghe, 409 kem conflicts, tu het han sau 8 phut"
```

---

### Task 4: `api/occupied.ts` — ghế đã chiếm

**Files:**

- Create: `server/src/api/occupied.test.ts`

- [ ] **Step 1: Viết test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../app";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";
import { cookieFor } from "../test/authCookie";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});

const U2 = cookieFor(2, "user");
const U3 = cookieFor(3, "user");

beforeEach(() => resetPrismaMock());

describe("occupied-seats", () => {
  it("chưa đăng nhập: 401", async () => {
    const res = await request(app).get("/api/occupied-seats?showtimeId=1");
    expect(res.status).toBe(401);
  });

  it("thiếu showtimeId: 400", async () => {
    const res = await request(app)
      .get("/api/occupied-seats")
      .set("Cookie", U2);
    expect(res.status).toBe(400);
  });

  it("showtimeId không phải số: 400", async () => {
    const res = await request(app)
      .get("/api/occupied-seats?showtimeId=abc")
      .set("Cookie", U2);
    expect(res.status).toBe(400);
  });

  it("hợp nhất ba nguồn: bookedSeats + ghế trong đơn + ghế người khác đang giữ", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({ bookedSeats: ["A1"] });
    prismaMock.booking.findMany.mockResolvedValue([{ seats: ["B2"] }]);

    // U3 giữ C3 -> với U2 thì C3 là ghế "người khác đang giữ"
    await request(app)
      .post("/api/holds")
      .set("Cookie", U3)
      .send({ showtimeId: 9101, seats: ["C3"] });

    const res = await request(app)
      .get("/api/occupied-seats?showtimeId=9101")
      .set("Cookie", U2);

    expect(res.status).toBe(200);
    expect([...res.body.seats].sort()).toEqual(["A1", "B2", "C3"]);
  });

  it("KHÔNG tính ghế do CHÍNH mình đang giữ (nếu không sẽ tự chặn mình)", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({ bookedSeats: [] });
    prismaMock.booking.findMany.mockResolvedValue([]);

    await request(app)
      .post("/api/holds")
      .set("Cookie", U2)
      .send({ showtimeId: 9102, seats: ["D4"] });

    const res = await request(app)
      .get("/api/occupied-seats?showtimeId=9102")
      .set("Cookie", U2);

    expect(res.body.seats).toEqual([]);
  });

  it("chỉ trả số ghế, KHÔNG kèm thông tin cá nhân của đơn", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({ bookedSeats: ["A1"] });
    prismaMock.booking.findMany.mockResolvedValue([{ seats: ["B2"] }]);

    const res = await request(app)
      .get("/api/occupied-seats?showtimeId=9103")
      .set("Cookie", U2);

    expect(Object.keys(res.body).sort()).toEqual(["seats", "showtimeId"]);
    // Truy vấn cũng chỉ select đúng cột ghế.
    const arg = prismaMock.booking.findMany.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(arg.select).toEqual({ seats: true });
  });
});
```

- [ ] **Step 2: Chạy**

Run: `npx vitest run server/src/api/occupied.test.ts`
Expected: PASS (6 test).

- [ ] **Step 3: Format + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add server/src/api/occupied.test.ts
git commit -m "test(occupied): hop nhat 3 nguon, bo qua hold cua chinh minh, khong lo du lieu ca nhan"
```

---

### Task 5: `payments` — server tự quyết số tiền

**Files:**

- Create: `server/src/payments/routes.test.ts`

**Lưu ý thiết kế:** mock module `./stripe` để không chạm mạng. Số tiền dùng trong
test lấy từ hằng số thật: `SERVICE_FEE = 15000` (`payments/quote.ts:4`), ghế
thường giá `showtime.price`. Một ghế thường giá 90.000 ⇒ **tổng 105.000**.

- [ ] **Step 1: Viết test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../app";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";
import { cookieFor } from "../test/authCookie";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});

// Không chạm mạng Stripe. create/retrieve do từng test cài giá trị.
const stripeMock = {
  paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
};
vi.mock("./stripe", () => ({
  isStripeEnabled: vi.fn(() => true),
  publishableKey: vi.fn(() => "pk_test_gia"),
  getStripe: vi.fn(() => stripeMock),
}));

const U2 = cookieFor(2, "user");

// Phòng không có hàng VIP/đôi -> mọi ghế đều là ghế thường.
const ROOM = { id: 1, vipRows: [], coupleRows: [] };
const SHOWTIME = { id: 1, roomId: 1, price: 90000, bookedSeats: [] };

beforeEach(() => {
  resetPrismaMock();
  stripeMock.paymentIntents.create.mockReset();
  stripeMock.paymentIntents.retrieve.mockReset();
});

describe("payments — /config", () => {
  it("công khai, trả publishable key nhưng KHÔNG BAO GIỜ secret key", async () => {
    const res = await request(app).get("/api/payments/config");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: true, publishableKey: "pk_test_gia" });
    expect(JSON.stringify(res.body)).not.toContain("sk_");
  });
});

describe("payments — /intent", () => {
  it("chưa đăng nhập: 401", async () => {
    const res = await request(app)
      .post("/api/payments/intent")
      .send({ showtimeId: 1, seats: ["B3"] });
    expect(res.status).toBe(401);
  });

  it("không có ghế: 400", async () => {
    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({ showtimeId: 1, seats: [] });
    expect(res.status).toBe(400);
  });

  it("quá 8 ghế: 400", async () => {
    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({
        showtimeId: 1,
        seats: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9"],
      });
    expect(res.status).toBe(400);
  });

  it("suất không tồn tại: 404", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({ showtimeId: 999, seats: ["B3"] });
    expect(res.status).toBe(404);
  });

  it("ghế đã bán: 409 kèm conflicts, và KHÔNG tạo giao dịch", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue({
      ...SHOWTIME,
      bookedSeats: ["B3"],
    });
    prismaMock.room.findUnique.mockResolvedValue(ROOM);
    prismaMock.booking.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({ showtimeId: 1, seats: ["B3"] });

    expect(res.status).toBe(409);
    expect(res.body.conflicts).toEqual(["B3"]);
    expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
  });

  it("SỐ TIỀN do server tính từ DB, không lấy số client gửi", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue(SHOWTIME);
    prismaMock.room.findUnique.mockResolvedValue(ROOM);
    prismaMock.booking.findMany.mockResolvedValue([]);
    prismaMock.concession.findMany.mockResolvedValue([]);
    stripeMock.paymentIntents.create.mockResolvedValue({
      client_secret: "cs_test_1",
      amount: 105000,
    });

    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({
        showtimeId: 1,
        seats: ["B3"],
        concessions: [],
        amount: 1, // client cố tình gửi 1 đồng
        totalPrice: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBe("cs_test_1");
    // 90.000 (ghế thường) + 15.000 (phí dịch vụ) = 105.000. VND zero-decimal:
    // KHÔNG nhân 100.
    const arg = stripeMock.paymentIntents.create.mock.calls[0][0] as {
      amount: number;
      currency: string;
      payment_method_types: string[];
      metadata: Record<string, string>;
    };
    expect(arg.amount).toBe(105000);
    expect(arg.currency).toBe("vnd");
    // Ghim thẻ: phương thức chuyển hướng sẽ rời SPA = mất vé.
    expect(arg.payment_method_types).toEqual(["card"]);
    expect(arg.metadata.userId).toBe("2");
  });

  it("giá bắp nước LẤY TỪ DB, không lấy giá client gửi", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue(SHOWTIME);
    prismaMock.room.findUnique.mockResolvedValue(ROOM);
    prismaMock.booking.findMany.mockResolvedValue([]);
    prismaMock.concession.findMany.mockResolvedValue([{ id: 1, price: 45000 }]);
    stripeMock.paymentIntents.create.mockResolvedValue({
      client_secret: "cs_test_2",
      amount: 150000,
    });

    await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({
        showtimeId: 1,
        seats: ["B3"],
        concessions: [{ id: 1, qty: 1, price: 1 }], // giá bịa
      });

    const arg = stripeMock.paymentIntents.create.mock.calls[0][0] as {
      amount: number;
    };
    // 90.000 + 45.000 (giá thật trong DB) + 15.000 = 150.000
    expect(arg.amount).toBe(150000);
  });

  it("Stripe lỗi: 502, không làm sập server", async () => {
    prismaMock.showtime.findUnique.mockResolvedValue(SHOWTIME);
    prismaMock.room.findUnique.mockResolvedValue(ROOM);
    prismaMock.booking.findMany.mockResolvedValue([]);
    prismaMock.concession.findMany.mockResolvedValue([]);
    stripeMock.paymentIntents.create.mockRejectedValue(new Error("stripe die"));

    const res = await request(app)
      .post("/api/payments/intent")
      .set("Cookie", U2)
      .send({ showtimeId: 1, seats: ["B3"] });

    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Chạy**

Run: `npx vitest run server/src/payments/routes.test.ts`
Expected: PASS (9 test).
Nếu `/config` trả `{enabled:false}`: đường dẫn `vi.mock("./stripe", …)` sai —
phải là đường dẫn **mà `routes.ts` dùng** (`./stripe`), không phải đường dẫn từ
file test.

- [ ] **Step 3: Format + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add server/src/payments/routes.test.ts
git commit -m "test(payments): server tu tinh tien tu DB, ghim the, 409 truoc khi charge, stripe loi -> 502"
```

---

### Task 6: `email/send.ts` — không bao giờ làm hỏng đơn

**Files:**

- Create: `server/src/email/send.test.ts`

**Bối cảnh:** đây là lời hứa cốt lõi của module email — `gateway.ts` gọi nó bằng
`void` **sau khi** đã trả đơn cho client, nên nếu nó throw thì lỗi sẽ nổi lên như
unhandled rejection. Test này khoá lời hứa đó.

- [ ] **Step 1: Viết test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});

// Không gọi mạng Resend.
const sendMailMock = vi.fn();
vi.mock("./resend", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
  isEmailEnabled: () => true,
}));

import { sendTicketEmail } from "./send";

beforeEach(() => {
  resetPrismaMock();
  sendMailMock.mockReset();
});

describe("email/send — không bao giờ throw", () => {
  it("đơn không tồn tại: trả kết quả lỗi, KHÔNG throw", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null);
    await expect(sendTicketEmail(999, "vi")).resolves.toMatchObject({
      ok: false,
    });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("DB ném lỗi: nuốt lại thành {ok:false}, KHÔNG throw", async () => {
    prismaMock.booking.findUnique.mockRejectedValue(new Error("db die"));
    await expect(sendTicketEmail(1, "vi")).resolves.toMatchObject({
      ok: false,
    });
  });
});
```

- [ ] **Step 2: Chạy**

Run: `npx vitest run server/src/email/send.test.ts`
Expected: PASS (2 test).
(Đã kiểm: `send.ts:7` import đúng `{ isEmailEnabled, sendMail }` từ `./resend`,
nên đường dẫn mock ở trên là chính xác. `send.ts` cũng import `WEB_ORIGIN` từ
`../env` — chạy được vì `server/src/test/setup.ts` đã đặt `DATABASE_URL` giả.)

- [ ] **Step 3: Format + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add server/src/email/send.test.ts
git commit -m "test(email): sendTicketEmail khong bao gio throw du don khong ton tai hay DB loi"
```

---

### Task 7: Đo lại coverage + đủ 7 cổng + push

**Files:**

- Modify: `docs/superpowers/plans/2026-07-29-testing-coverage-baseline.md`

- [ ] **Step 1: Đo lại**

Run: `npm run test:cov`
Ghi lại 4 con số tổng và các dòng `server/src/auth`, `server/src/api`,
`server/src/payments`, `server/src/email`.

- [ ] **Step 2: Thêm cột "Sau T3" vào bảng baseline**

Sửa `docs/superpowers/plans/2026-07-29-testing-coverage-baseline.md`: thêm cột
`Sau T3` vào cả bảng tổng lẫn bảng theo khu vực, điền số đo thật ở Step 1.

- [ ] **Step 3: Chạy đủ 7 cổng, kiểm exit code từng cái**

```bash
npm run typecheck && echo "G1=OK" && \
npm run lint && echo "G2=OK" && \
npm run format:check && echo "G3=OK" && \
npm run test:run && echo "G4=OK" && \
npm run build && echo "G5=OK" && \
npm run e2e && echo "G6=OK"
```

(Cổng thứ 7 là `docker`, chỉ chạy trên CI — máy này không có Docker.)

- [ ] **Step 4: Commit + push + xác nhận CI**

```bash
git add docs/superpowers/plans/2026-07-29-testing-coverage-baseline.md
git commit -m "docs(test): cap nhat do phu sau T3"
git push origin main
```

Rồi kiểm CI:

```bash
curl -s "https://api.github.com/repos/khanhnguyen1205/cinema-full/actions/runs?per_page=1"
```

Expected: `conclusion: success`.

---

## Sau plan này

T3 xong ⇒ **toàn bộ server có lưới**. Còn lại là phía client: **T4** (services ·
queries · AuthContext · 2 route guard · usePagination) — plan viết sau, dùng lại
`renderWithProviders` + MSW đã dựng ở T1.
