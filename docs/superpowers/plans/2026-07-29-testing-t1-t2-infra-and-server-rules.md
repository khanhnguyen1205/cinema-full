# Lấp khoảng trống test — T1 (hạ tầng) + T2 (luật server) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng hạ tầng test dùng chung (MSW + supertest + fixtures + provider
wrapper) rồi dùng ngay để phủ hai thứ đắt nhất chưa có test: **luật phân quyền của
`api/gateway.ts`** và **hợp đồng HTTP của `api/repo.ts`**.

**Architecture:** Tách `vitest` thành hai project — `client` (happy-dom, MSW chặn
ở tầng HTTP) và `server` (node, `supertest` bắn vào app Express **thật**, chỉ thay
tầng Prisma bằng bản giả). Không mock module `services/*`, không cần Postgres.

**Tech Stack:** Vitest 3 (`test.projects`) · MSW 2 (`msw/node`) · supertest ·
@testing-library/react · @vitest/coverage-v8 · Express 5 · Prisma 6 (chỉ mock).

## Global Constraints

- **Kill listener :4000 TRƯỚC mọi `npm install`** — trên Windows server `tsx` đang
  chạy khoá file Prisma client, `postinstall: prisma generate` sẽ fail EPERM. Bật
  lại (`npm run auth`) ngay sau khi cài xong; quên bật là toàn bộ e2e đỏ hàng loạt
  trông như lỗi mã.
- **7 cổng CI phải xanh mỗi commit**: `typecheck` · `lint` (**0 warning** — warning
  cũng làm đỏ) · `format:check` · `test:run` · `e2e` · `build` · `docker`.
- **Không sửa hành vi app.** Nếu test lòi ra bug thật: dừng, báo người dùng, sửa ở
  commit riêng. Không hạ assertion cho vừa hành vi sai.
- **Không đụng** placeholder đăng nhập `your@email.com` / `••••••••` và nút
  **"Đăng nhập"** — bốn file e2e phụ thuộc.
- Copy hiển thị đi qua `t("area.key")`; test assert **chuỗi tiếng Việt** (setup đã
  init i18n mặc định `vi`).
- Prettier quét cả file mới ⇒ chạy `npm run format` trước khi commit.
- Commit thẳng `main`, mỗi task 1 commit, message tiếng Việt không dấu.
- Vitest hiện là `^3.2.7`, `test.projects` cần ≥3.2 — **không nâng version**.

---

### Task 1: Cài dependency + tách vitest thành 2 project

**Files:**

- Modify: `vite.config.mjs:84-88` (khối `test`)
- Modify: `package.json` (devDependencies + script `test:cov`)
- Create: `server/src/test/setup.ts`

**Interfaces:**

- Produces: hai project vitest tên `client` và `server`; biến môi trường
  `VITE_API_URL` / `VITE_AUTH_URL` được **ghim** cho project client nên handler
  MSW ở Task 2 có URL cố định, giống nhau giữa máy dev và CI.

- [ ] **Step 1: Tắt server :4000 rồi cài dep**

```bash
netstat -ano | grep ":4000" | grep LISTENING
# lấy PID ở cột cuối rồi:
taskkill //PID <pid> //F
npm install -D msw supertest @types/supertest @vitest/coverage-v8
```

- [ ] **Step 2: Bật lại server auth**

```bash
npm run auth &
```

- [ ] **Step 3: Tạo setup cho project server**

Tạo `server/src/test/setup.ts`. Phải đặt biến **trước** khi bất kỳ test file nào
import `app.ts`, vì `server/src/env.ts` **throw** khi thiếu `DATABASE_URL`
(setupFiles của vitest chạy trước test file nên chỗ này là đúng chỗ).

```ts
// Biến môi trường giả cho test server. Prisma bị mock nên chuỗi kết nối này
// không bao giờ được dùng để nối thật — nó chỉ để env.ts không throw.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
process.env.DIRECT_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
// Đặt secret riêng để env.ts không cảnh báo "đang dùng JWT_SECRET mặc định".
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-khong-dung-that";
```

- [ ] **Step 4: Tách `test` thành 2 project trong `vite.config.mjs`**

Thay nguyên khối `test: {...}` hiện tại bằng:

```js
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          environment: "happy-dom", // cần DOM cho test component
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          // Ghim URL để handler MSW cố định — CI không có .env, máy dev thì có.
          env: {
            VITE_API_URL: "http://localhost:4000/api",
            VITE_AUTH_URL: "http://localhost:4000",
          },
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          setupFiles: ["./server/src/test/setup.ts"],
          include: ["server/**/*.{test,spec}.ts"],
        },
      },
    ],
  },
```

- [ ] **Step 5: Thêm script `test:cov`**

Trong `package.json`, sau dòng `"test:run": "vitest run",`:

```json
    "test:cov": "vitest run --coverage",
```

- [ ] **Step 6: Chạy toàn bộ test cũ, phải xanh y như trước**

Run: `npm run test:run`
Expected: PASS — **164 test**, và output hiện tên project `client` / `server`.
Nếu test server đỏ vì `DATABASE_URL`, kiểm lại đường dẫn `setupFiles` ở Step 4.

- [ ] **Step 7: Format + commit**

```bash
npm run format
git add vite.config.mjs package.json package-lock.json server/src/test/setup.ts
git commit -m "test(ha-tang): tach vitest thanh 2 project client/server + cai msw, supertest, coverage-v8"
```

---

### Task 2: Fixtures + MSW server, có bài thử chứng minh MSW chặn được fetch

**Files:**

- Create: `src/test/fixtures.ts`
- Create: `src/test/msw/handlers.ts`
- Create: `src/test/msw/server.ts`
- Modify: `src/test/setup.ts`
- Create: `src/test/msw/msw.test.ts` (bài thử hạ tầng — **giữ lại** làm canary)

**Interfaces:**

- Produces:
  - `fx` — object fixtures, các khoá `cities`, `cinemas`, `rooms`, `movies`,
    `showtimes`, `concessions`, `bookings`, `reviews`, `user`, `admin`.
  - `server` từ `src/test/msw/server.ts` — instance `setupServer`; test riêng lẻ
    ghi đè bằng `server.use(...)`.
  - `handlers` — mảng handler mặc định.

- [ ] **Step 1: Viết fixtures**

Tạo `src/test/fixtures.ts`. Số liệu **nhỏ và cố ý**: phòng 5×6 có hàng VIP `C` và
hàng đôi `E`, một suất **tương lai** và một suất **quá khứ** (để test luật
`isUpcoming`).

```ts
import type {
  Booking,
  Cinema,
  City,
  Concession,
  Movie,
  Review,
  Room,
  Showtime,
  User,
} from "types";

// Mốc thời gian tính từ "bây giờ" để suất tương lai luôn là tương lai,
// bất kể chạy test lúc nào. Định dạng khớp DB: chuỗi giờ ĐỊA PHƯƠNG, không có "Z".
const shift = (hours: number): string => {
  const d = new Date(Date.now() + hours * 3600_000);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
};

export const fx = {
  cities: [
    { id: 1, name: "Hà Nội" },
    { id: 2, name: "Đà Nẵng" },
  ] as City[],

  cinemas: [
    { id: 1, cityId: 1, name: "Cinema Hoàn Kiếm", address: "1 Tràng Tiền" },
    { id: 2, cityId: 2, name: "Cinema Hải Châu", address: "5 Bạch Đằng" },
  ] as Cinema[],

  rooms: [
    {
      id: 1,
      cinemaId: 1,
      name: "Phòng 1",
      type: "2D",
      rows: 5,
      cols: 6,
      vipRows: ["C"],
      coupleRows: ["E"],
      aisleAfterCols: [3],
    },
    {
      id: 2,
      cinemaId: 2,
      name: "Phòng IMAX",
      type: "IMAX",
      rows: 4,
      cols: 6,
      vipRows: [],
      coupleRows: [],
      aisleAfterCols: [],
    },
  ] as Room[],

  movies: [
    {
      id: 1,
      title: "Điện Biên Phủ",
      poster: "",
      description: "Phim thử nghiệm số một.",
      duration: 120,
      genre: "Action",
      rating: 8.4,
    },
    {
      id: 2,
      title: "Endgame",
      poster: "",
      description: "Phim thử nghiệm số hai.",
      duration: 95,
      genre: "Sci-Fi",
      rating: 7.1,
    },
  ] as Movie[],

  showtimes: [
    // Suất TƯƠNG LAI — đặt vé được.
    {
      id: 1,
      movieId: 1,
      roomId: 1,
      time: shift(48),
      price: 90000,
      bookedSeats: ["A1", "A2"],
    },
    // Suất QUÁ KHỨ — không được chào bán.
    { id: 2, movieId: 1, roomId: 1, time: shift(-48), price: 90000, bookedSeats: [] },
    { id: 3, movieId: 2, roomId: 2, time: shift(72), price: 120000, bookedSeats: [] },
  ] as Showtime[],

  concessions: [
    {
      id: 1,
      name: "Bắp rang bơ",
      category: "popcorn",
      price: 45000,
      description: "Cỡ vừa",
      image: "🍿",
    },
    {
      id: 2,
      name: "Combo đôi",
      category: "combo",
      price: 89000,
      description: "2 bắp 2 nước",
      image: "🍟",
    },
  ] as Concession[],

  user: { id: 2, fullName: "Người Dùng", email: "a@cinema.vn", role: "user" } as User,
  admin: { id: 1, fullName: "Quản Trị", email: "admin@cinema.vn", role: "admin" } as User,

  bookings: [
    {
      id: 1,
      movieId: 1,
      showtimeId: 1,
      cinemaId: 1,
      roomId: 1,
      seats: ["B3"],
      seatTypes: { standard: 1, vip: 0, couple: 0 },
      concessions: [],
      paymentMethod: "counter",
      userId: 2,
      userName: "Người Dùng",
      seatTotal: 90000,
      fnbTotal: 0,
      serviceFee: 15000,
      totalPrice: 105000,
      createdAt: shift(-1),
      paymentRef: null,
    },
  ] as Booking[],

  reviews: [
    {
      id: 1,
      movieId: 1,
      userId: 2,
      userName: "Người Dùng",
      rating: 5,
      comment: "Rất hay.",
      verified: true,
      createdAt: shift(-2),
    },
  ] as Review[],
};
```

- [ ] **Step 2: Viết handlers**

Tạo `src/test/msw/handlers.ts`. URL khớp `VITE_API_URL` / `VITE_AUTH_URL` đã ghim
ở Task 1.

```ts
import { http, HttpResponse } from "msw";
import { fx } from "../fixtures";

const API = "http://localhost:4000/api";
const AUTH = "http://localhost:4000";

// Mặc định: KHÁCH (chưa đăng nhập). Test nào cần user thì server.use(...) đè lại.
export const handlers = [
  http.get(`${AUTH}/auth/me`, () =>
    HttpResponse.json({ error: "Chưa đăng nhập." }, { status: 401 }),
  ),
  http.post(`${AUTH}/auth/refresh`, () =>
    HttpResponse.json({ error: "Phiên hết hạn." }, { status: 401 }),
  ),
  http.post(`${AUTH}/auth/logout`, () => HttpResponse.json({})),

  http.get(`${API}/cities`, () => HttpResponse.json(fx.cities)),
  http.get(`${API}/cinemas`, () => HttpResponse.json(fx.cinemas)),
  http.get(`${API}/rooms`, () => HttpResponse.json(fx.rooms)),
  http.get(`${API}/movies`, () => HttpResponse.json(fx.movies)),
  http.get(`${API}/showtimes`, () => HttpResponse.json(fx.showtimes)),
  http.get(`${API}/concessions`, () => HttpResponse.json(fx.concessions)),
  http.get(`${API}/reviews`, () => HttpResponse.json(fx.reviews)),
  http.get(`${API}/occupied-seats`, () => HttpResponse.json(["A1", "A2"])),
  http.get(`${API}/payments/config`, () =>
    HttpResponse.json({ enabled: false, publishableKey: null }),
  ),
  http.get(`${API}/emails/config`, () => HttpResponse.json({ enabled: false })),
];
```

- [ ] **Step 3: Viết `server.ts`**

```ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

- [ ] **Step 4: Nối MSW vào setup client**

Thay `src/test/setup.ts` bằng:

```ts
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "i18n"; // khởi tạo i18next (mặc định vi) để useTranslation trả chuỗi trong test
import { server } from "./msw/server";

// onUnhandledRequest:"error" — request nào chưa khai báo handler thì test ĐỎ.
// Không có nó, một lời gọi mạng bị bỏ quên sẽ lặng lẽ treo rồi test vẫn xanh.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup(); // dọn DOM sau mỗi test (do dùng globals: false)
});
afterAll(() => server.close());
```

- [ ] **Step 5: Viết bài thử hạ tầng (canary)**

Tạo `src/test/msw/msw.test.ts`. Bài này gọi **service thật**, nên nó chứng minh
đúng thứ ta cần: MSW chặn được `fetch` mà `services/api.ts` dùng.

```ts
import { describe, expect, it } from "vitest";
import { getMovies } from "services/api";

describe("hạ tầng MSW", () => {
  it("chặn được fetch của services/api.ts và trả fixtures", async () => {
    const movies = await getMovies();
    expect(movies).toHaveLength(2);
    expect(movies[0].title).toBe("Điện Biên Phủ");
  });
});
```

- [ ] **Step 6: Chạy bài thử**

Run: `npx vitest run src/test/msw/msw.test.ts`
Expected: PASS.

**Nếu FAIL vì MSW không chặn được** (lỗi kiểu `connect ECONNREFUSED
127.0.0.1:4000` hoặc `onUnhandledRequest` không kêu): happy-dom cài `fetch` riêng
mà interceptor của MSW không vá. Áp phương án dự phòng — thêm vào **đầu**
`src/test/setup.ts`, trước `server.listen`:

```ts
// happy-dom thay globalThis.fetch bằng bản của nó; MSW chỉ vá được fetch của
// undici (Node). Ép dùng lại bản Node để interceptor bắt được.
import { fetch as undiciFetch } from "undici";
globalThis.fetch = undiciFetch as unknown as typeof globalThis.fetch;
```

Chạy lại Step 6. Nếu **vẫn** fail, dừng lại và báo người dùng — đừng chuyển sang
phương án `vi.mock` cho `services/*`, vì làm thế là bỏ đúng tầng cần phủ (quyết
định số 2 trong spec).

- [ ] **Step 7: Chạy toàn bộ, format, commit**

```bash
npm run test:run   # 165 test
npm run format
git add src/test package.json package-lock.json
git commit -m "test(ha-tang): fixtures + MSW server chan tang HTTP + bai thu canary"
```

---

### Task 3: `renderWithProviders`

**Files:**

- Create: `src/test/renderWithProviders.tsx`
- Create: `src/test/renderWithProviders.test.tsx`

**Interfaces:**

- Consumes: `server` + `fx` từ Task 2.
- Produces:
  `renderWithProviders(ui: ReactElement, opts?: { route?: string; user?: User | null }): RenderResult & { queryClient: QueryClient }`
  — bọc `QueryClientProvider` + `MemoryRouter` + `AuthProvider`. Truyền `user` thì
  helper tự cài handler `/auth/me` trả user đó **trước khi** render.

- [ ] **Step 1: Viết helper**

```tsx
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { AuthProvider } from "context/AuthContext";
import type { User } from "types";
import { server } from "./msw/server";

interface Options {
  route?: string;
  user?: User | null;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", user = null }: Options = {},
): RenderResult & { queryClient: QueryClient } {
  // AuthProvider hydrate bằng fetchMe() lúc mount -> phải cài handler TRƯỚC render.
  if (user) {
    server.use(
      http.get("http://localhost:4000/auth/me", () => HttpResponse.json(user)),
    );
  }

  // retry:false để test không phải chờ 1 lần thử lại; gcTime:0 để cache không
  // rò từ test này sang test khác.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { ...render(ui, { wrapper: Wrapper }), queryClient };
}
```

- [ ] **Step 2: Viết test cho chính helper**

```tsx
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { useAuth } from "context/AuthContext";
import { fx } from "./fixtures";
import { renderWithProviders } from "./renderWithProviders";

function Probe(): React.ReactElement {
  const { user, loading } = useAuth();
  if (loading) return <p>đang tải</p>;
  return <p>{user ? `xin chào ${user.fullName}` : "khách"}</p>;
}

describe("renderWithProviders", () => {
  it("mặc định là khách khi /auth/me trả 401", async () => {
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByText("khách")).toBeInTheDocument());
  });

  it("nạp sẵn user khi truyền opts.user", async () => {
    renderWithProviders(<Probe />, { user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("xin chào Người Dùng")).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 3: Chạy**

Run: `npx vitest run src/test/renderWithProviders.test.tsx`
Expected: PASS (2 test).
Nếu lỗi `BroadcastChannel is not defined`, thêm vào `src/test/setup.ts` trước
`server.listen`:

```ts
// happy-dom chưa có BroadcastChannel — AuthContext dùng để đồng bộ cross-tab.
if (typeof globalThis.BroadcastChannel === "undefined") {
  class NoopChannel {
    onmessage: ((e: MessageEvent) => void) | null = null;
    postMessage(): void {}
    close(): void {}
  }
  globalThis.BroadcastChannel = NoopChannel as unknown as typeof BroadcastChannel;
}
```

- [ ] **Step 4: Format + commit**

```bash
npm run test:run   # 167 test
npm run format
git add src/test
git commit -m "test(ha-tang): renderWithProviders (Query + Router + Auth) kem test cho chinh no"
```

---

### Task 4: Prisma giả + bài thử supertest

**Files:**

- Create: `server/src/test/prismaMock.ts`
- Create: `server/src/test/authCookie.ts`
- Create: `server/src/api/gateway.test.ts` (chỉ bài thử ở task này, mở rộng ở Task 5-7)

**Interfaces:**

- Produces:
  - `prismaMock` — object có 9 delegate (`movie`, `showtime`, `cinema`, `city`,
    `room`, `concession`, `booking`, `review`, `user`), mỗi cái có `findMany`,
    `findUnique`, `create`, `update`, `delete`, `count` là `vi.fn()`.
  - `resetPrismaMock(): void` — xoá mọi lời gọi + giá trị trả về đã cài.
  - `cookieFor(id: number, role: string): string` — chuỗi cookie `at=<jwt>` để
    gắn vào `.set("Cookie", ...)` của supertest.

- [ ] **Step 1: Viết `prismaMock.ts`**

```ts
import { vi } from "vitest";

const delegate = () => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
});

export const prismaMock = {
  movie: delegate(),
  showtime: delegate(),
  cinema: delegate(),
  city: delegate(),
  room: delegate(),
  concession: delegate(),
  booking: delegate(),
  review: delegate(),
  user: delegate(),
};

export function resetPrismaMock(): void {
  for (const d of Object.values(prismaMock)) {
    for (const fn of Object.values(d)) fn.mockReset();
  }
}
```

- [ ] **Step 2: Viết `authCookie.ts`**

```ts
import { signAccess } from "../auth/tokens";

// Gateway đọc user từ cookie "at" (xem auth/middleware.ts).
export const cookieFor = (id: number, role: string): string =>
  `at=${signAccess(id, role)}`;
```

- [ ] **Step 3: Viết bài thử supertest**

Tạo `server/src/api/gateway.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Mock TRƯỚC khi app.ts được import (vi.mock được hoisted).
vi.mock("../db/prisma", async () => {
  const { prismaMock } = await import("../test/prismaMock");
  return { prisma: prismaMock };
});
// Email chạy ở nền sau khi đặt vé — chặn để test không chạm mạng.
vi.mock("../email/send", () => ({ sendTicketEmail: vi.fn() }));

const { app } = await import("../app");
const { prismaMock, resetPrismaMock } = await import("../test/prismaMock");

beforeEach(() => resetPrismaMock());

describe("gateway — bài thử hạ tầng", () => {
  it("GET /api/cities không cần đăng nhập và trả đúng dữ liệu", async () => {
    prismaMock.city.findMany.mockResolvedValue([{ id: 1, name: "Hà Nội" }]);

    const res = await request(app).get("/api/cities");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: "Hà Nội" }]);
    // Thứ tự id tăng dần là hợp đồng: bỏ đi thì thứ tự phim ở Home loạn.
    expect(prismaMock.city.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { id: "asc" },
    });
  });
});
```

- [ ] **Step 4: Chạy bài thử**

Run: `npx vitest run server/src/api/gateway.test.ts`
Expected: PASS (1 test).
Nếu lỗi `Thiếu DATABASE_URL` ⇒ `setupFiles` của project `server` chưa chạy, xem
lại Task 1 Step 4. Nếu lỗi `PrismaClient is unable to run in this browser` ⇒ file
test đang bị project `client` nhặt, kiểm `include` của hai project.

- [ ] **Step 5: Format + commit**

```bash
npm run test:run   # 168 test
npm run format
git add server/src/test server/src/api/gateway.test.ts
git commit -m "test(server): prisma gia + cookie helper + bai thu supertest vao app that"
```

---

### Task 5: Gateway — catalog và `users`

**Files:**

- Modify: `server/src/api/gateway.test.ts`

**Interfaces:**

- Consumes: `prismaMock`, `resetPrismaMock`, `cookieFor` (Task 4).

- [ ] **Step 1: Thêm test cho catalog + users**

Thêm vào `server/src/api/gateway.test.ts` (import `cookieFor` ở đầu file):

```ts
const { cookieFor } = await import("../test/authCookie");

describe("gateway — catalog: đọc công khai, ghi chỉ admin", () => {
  it("khách GET /api/movies được 200", async () => {
    prismaMock.movie.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/movies");
    expect(res.status).toBe(200);
  });

  it("khách POST /api/movies bị 403", async () => {
    const res = await request(app).post("/api/movies").send({ title: "X" });
    expect(res.status).toBe(403);
    expect(prismaMock.movie.create).not.toHaveBeenCalled();
  });

  it("user thường POST /api/movies bị 403", async () => {
    const res = await request(app)
      .post("/api/movies")
      .set("Cookie", cookieFor(2, "user"))
      .send({ title: "X" });
    expect(res.status).toBe(403);
    expect(prismaMock.movie.create).not.toHaveBeenCalled();
  });

  it("admin POST /api/movies được 201", async () => {
    prismaMock.movie.create.mockResolvedValue({ id: 9, title: "X" });
    const res = await request(app)
      .post("/api/movies")
      .set("Cookie", cookieFor(1, "admin"))
      .send({ title: "X", duration: 100, genre: "Action" });
    expect(res.status).toBe(201);
  });

  it("admin DELETE /api/rooms/3 được 200 và thân trả {}", async () => {
    prismaMock.room.delete.mockResolvedValue({ id: 3 });
    const res = await request(app)
      .delete("/api/rooms/3")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });
});

describe("gateway — users: chỉ admin", () => {
  it("khách bị 403", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(403);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("user thường bị 403 (email + hash không được lộ)", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Cookie", cookieFor(2, "user"));
    expect(res.status).toBe(403);
  });

  it("admin được 200", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/users")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
  });
});

describe("gateway — collection lạ bị chặn mặc định", () => {
  it("GET /api/secrets bị 403 dù là admin", async () => {
    const res = await request(app)
      .get("/api/secrets")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Chạy**

Run: `npx vitest run server/src/api/gateway.test.ts`
Expected: PASS (10 test).

- [ ] **Step 3: Format + commit**

```bash
npm run test:run
npm run format
git add server/src/api/gateway.test.ts
git commit -m "test(gateway): ma tran phan quyen catalog + users + collection la"
```

---

### Task 6: Gateway — `bookings`

**Files:**

- Modify: `server/src/api/gateway.test.ts`

- [ ] **Step 1: Thêm test cho bookings**

```ts
describe("gateway — bookings: giới hạn theo chủ sở hữu", () => {
  it("khách GET /api/bookings bị 401", async () => {
    const res = await request(app).get("/api/bookings");
    expect(res.status).toBe(401);
  });

  it("user thường chỉ thấy đơn của chính mình", async () => {
    prismaMock.booking.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/bookings")
      .set("Cookie", cookieFor(2, "user"));
    expect(res.status).toBe(200);
    expect(prismaMock.booking.findMany).toHaveBeenCalledWith({
      where: { userId: 2 },
      orderBy: { id: "asc" },
    });
  });

  it("admin thấy tất cả (không kèm bộ lọc userId)", async () => {
    prismaMock.booking.findMany.mockResolvedValue([]);
    await request(app).get("/api/bookings").set("Cookie", cookieFor(1, "admin"));
    expect(prismaMock.booking.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { id: "asc" },
    });
  });

  it("user thường KHÔNG đọc được đơn lẻ của người khác", async () => {
    const res = await request(app)
      .get("/api/bookings/7")
      .set("Cookie", cookieFor(2, "user"));
    expect(res.status).toBe(403);
    expect(prismaMock.booking.findUnique).not.toHaveBeenCalled();
  });

  it("POST ép userId về chính người gọi dù client gửi userId giả", async () => {
    prismaMock.booking.create.mockResolvedValue({ id: 5 });
    const res = await request(app)
      .post("/api/bookings")
      .set("Cookie", cookieFor(2, "user"))
      .send({
        userId: 999, // giả mạo
        movieId: 1,
        showtimeId: 1,
        cinemaId: 1,
        roomId: 1,
        seats: ["B3"],
        seatTypes: { standard: 1, vip: 0, couple: 0 },
        totalPrice: 105000,
      });

    expect(res.status).toBe(201);
    const arg = prismaMock.booking.create.mock.calls[0][0];
    expect(arg.data.userId).toBe(2);
  });

  it("POST không phải thẻ thì paymentRef bị tước", async () => {
    prismaMock.booking.create.mockResolvedValue({ id: 6 });
    await request(app)
      .post("/api/bookings")
      .set("Cookie", cookieFor(2, "user"))
      .send({
        paymentMethod: "counter",
        paymentRef: "pi_gia_mao",
        movieId: 1,
        showtimeId: 1,
        cinemaId: 1,
        roomId: 1,
        seats: ["B3"],
        seatTypes: { standard: 1, vip: 0, couple: 0 },
        totalPrice: 105000,
      });

    const arg = prismaMock.booking.create.mock.calls[0][0];
    expect(arg.data.paymentRef ?? null).toBeNull();
  });

  it("user thường không được PATCH đơn", async () => {
    const res = await request(app)
      .patch("/api/bookings/1")
      .set("Cookie", cookieFor(2, "user"))
      .send({ seats: ["A1"] });
    expect(res.status).toBe(403);
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("admin được DELETE đơn", async () => {
    prismaMock.booking.delete.mockResolvedValue({ id: 1 });
    const res = await request(app)
      .delete("/api/bookings/1")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Chạy**

Run: `npx vitest run server/src/api/gateway.test.ts`
Expected: PASS (18 test).

- [ ] **Step 3: Format + commit**

```bash
npm run test:run
npm run format
git add server/src/api/gateway.test.ts
git commit -m "test(gateway): bookings gioi han theo chu so huu + ep userId + tuoc paymentRef"
```

---

### Task 7: Gateway — `reviews`

**Files:**

- Modify: `server/src/api/gateway.test.ts`

- [ ] **Step 1: Thêm test cho reviews**

```ts
describe("gateway — reviews: đọc công khai, sửa/xoá là chủ-hoặc-admin", () => {
  it("khách đọc được", async () => {
    prismaMock.review.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/reviews?movieId=1");
    expect(res.status).toBe(200);
    expect(prismaMock.review.findMany).toHaveBeenCalledWith({
      where: { movieId: 1 },
      orderBy: { id: "asc" },
    });
  });

  it("khách POST bị 401", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .send({ movieId: 1, rating: 5 });
    expect(res.status).toBe(401);
  });

  it("rating ngoài 1..5 bị 400", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .set("Cookie", cookieFor(2, "user"))
      .send({ movieId: 1, rating: 9 });
    expect(res.status).toBe(400);
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it("phim không tồn tại bị 404", async () => {
    prismaMock.movie.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/reviews")
      .set("Cookie", cookieFor(2, "user"))
      .send({ movieId: 99, rating: 5 });
    expect(res.status).toBe(404);
  });

  it("server tự đóng dấu userId/userName/verified, không tin client", async () => {
    prismaMock.movie.findUnique.mockResolvedValue({ id: 1 });
    prismaMock.booking.count.mockResolvedValue(1); // đã đặt vé -> verified
    prismaMock.user.findUnique.mockResolvedValue({ id: 2, fullName: "Người Dùng" });
    prismaMock.review.create.mockResolvedValue({ id: 10 });

    const res = await request(app)
      .post("/api/reviews")
      .set("Cookie", cookieFor(2, "user"))
      .send({ movieId: 1, rating: 4, comment: "Ổn", userId: 999, verified: true, userName: "Kẻ giả mạo" });

    expect(res.status).toBe(201);
    const arg = prismaMock.review.create.mock.calls[0][0];
    expect(arg.data.userId).toBe(2);
    expect(arg.data.userName).toBe("Người Dùng");
    expect(arg.data.verified).toBe(true);
  });

  it("chưa đặt vé thì verified = false", async () => {
    prismaMock.movie.findUnique.mockResolvedValue({ id: 1 });
    prismaMock.booking.count.mockResolvedValue(0);
    prismaMock.user.findUnique.mockResolvedValue({ id: 3, fullName: "Người Lạ" });
    prismaMock.review.create.mockResolvedValue({ id: 11 });

    await request(app)
      .post("/api/reviews")
      .set("Cookie", cookieFor(3, "user"))
      .send({ movieId: 1, rating: 3 });

    expect(prismaMock.review.create.mock.calls[0][0].data.verified).toBe(false);
  });

  it("người khác KHÔNG xoá được review của mình", async () => {
    prismaMock.review.findUnique.mockResolvedValue({ id: 1, userId: 2 });
    const res = await request(app)
      .delete("/api/reviews/1")
      .set("Cookie", cookieFor(3, "user"));
    expect(res.status).toBe(403);
    expect(prismaMock.review.delete).not.toHaveBeenCalled();
  });

  it("chủ review xoá được", async () => {
    prismaMock.review.findUnique.mockResolvedValue({ id: 1, userId: 2 });
    prismaMock.review.delete.mockResolvedValue({ id: 1 });
    const res = await request(app)
      .delete("/api/reviews/1")
      .set("Cookie", cookieFor(2, "user"));
    expect(res.status).toBe(200);
  });

  it("admin xoá được review của người khác", async () => {
    prismaMock.review.findUnique.mockResolvedValue({ id: 1, userId: 2 });
    prismaMock.review.delete.mockResolvedValue({ id: 1 });
    const res = await request(app)
      .delete("/api/reviews/1")
      .set("Cookie", cookieFor(1, "admin"));
    expect(res.status).toBe(200);
  });

  it("PATCH của chủ chỉ ghi được rating/comment", async () => {
    prismaMock.review.findUnique.mockResolvedValue({ id: 1, userId: 2 });
    prismaMock.review.update.mockResolvedValue({ id: 1 });
    await request(app)
      .patch("/api/reviews/1")
      .set("Cookie", cookieFor(2, "user"))
      .send({ rating: 2, comment: "Đổi ý", verified: true, userId: 999 });

    const arg = prismaMock.review.update.mock.calls[0][0];
    expect(arg.data).toEqual({ rating: 2, comment: "Đổi ý" });
  });
});
```

- [ ] **Step 2: Chạy**

Run: `npx vitest run server/src/api/gateway.test.ts`
Expected: PASS (28 test).

- [ ] **Step 3: Format + commit**

```bash
npm run test:run
npm run format
git add server/src/api/gateway.test.ts
git commit -m "test(gateway): reviews cong khai doc, server dong dau userId/verified, chu-hoac-admin"
```

---

### Task 8: `repo.ts` — hợp đồng HTTP

**Files:**

- Create: `server/src/api/repo.test.ts`

**Interfaces:**

- Consumes: `prismaMock`, `resetPrismaMock`, `cookieFor`.
- Đi qua gateway bằng đường **catalog admin** (`/api/movies`) để chạm được mọi
  nhánh của `handleRest` mà không phải gọi hàm trực tiếp.

- [ ] **Step 1: Viết test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";

vi.mock("../db/prisma", async () => {
  const { prismaMock } = await import("../test/prismaMock");
  return { prisma: prismaMock };
});
vi.mock("../email/send", () => ({ sendTicketEmail: vi.fn() }));

const { app } = await import("../app");
const { prismaMock, resetPrismaMock } = await import("../test/prismaMock");
const { cookieFor } = await import("../test/authCookie");

const ADMIN = cookieFor(1, "admin");

beforeEach(() => resetPrismaMock());

describe("repo — hợp đồng HTTP giữ y hệt json-server", () => {
  it("GET danh sách sắp theo id tăng dần", async () => {
    prismaMock.movie.findMany.mockResolvedValue([]);
    await request(app).get("/api/movies");
    expect(prismaMock.movie.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { id: "asc" },
    });
  });

  it("GET id không tồn tại trả 404 với thân {}", async () => {
    prismaMock.movie.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/movies/404");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({});
  });

  it("GET id không phải số trả 404", async () => {
    const res = await request(app).get("/api/movies/abc");
    expect(res.status).toBe(404);
    expect(prismaMock.movie.findUnique).not.toHaveBeenCalled();
  });

  it("đường dẫn lồng sâu trả 404", async () => {
    const res = await request(app).get("/api/movies/1/reviews");
    expect(res.status).toBe(404);
  });

  it("POST trả 201", async () => {
    prismaMock.movie.create.mockResolvedValue({ id: 3 });
    const res = await request(app)
      .post("/api/movies")
      .set("Cookie", ADMIN)
      .send({ title: "A", duration: 100, genre: "Action" });
    expect(res.status).toBe(201);
  });

  it("body lọc qua whitelist: id và field rác không ghi được", async () => {
    prismaMock.movie.create.mockResolvedValue({ id: 3 });
    await request(app)
      .post("/api/movies")
      .set("Cookie", ADMIN)
      .send({ id: 999, title: "A", duration: 100, genre: "Action", hacked: true });

    const data = prismaMock.movie.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("hacked");
    expect(data.title).toBe("A");
  });

  it("DELETE trả {} + 200", async () => {
    prismaMock.movie.delete.mockResolvedValue({ id: 3 });
    const res = await request(app).delete("/api/movies/3").set("Cookie", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it("P2025 (sửa/xoá bản ghi không tồn tại) thành 404", async () => {
    prismaMock.movie.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("not found", {
        code: "P2025",
        clientVersion: "6",
      }),
    );
    const res = await request(app)
      .patch("/api/movies/77")
      .set("Cookie", ADMIN)
      .send({ title: "B" });
    expect(res.status).toBe(404);
  });

  it("P2002 (trùng khoá duy nhất) thành 409", async () => {
    prismaMock.movie.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "6",
      }),
    );
    const res = await request(app)
      .post("/api/movies")
      .set("Cookie", ADMIN)
      .send({ title: "A", duration: 100, genre: "Action" });
    expect(res.status).toBe(409);
  });

  it("P2003 (đang bị tham chiếu) thành 409", async () => {
    prismaMock.movie.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", {
        code: "P2003",
        clientVersion: "6",
      }),
    );
    const res = await request(app).delete("/api/movies/1").set("Cookie", ADMIN);
    expect(res.status).toBe(409);
  });

  it("lọc theo query được ép kiểu số", async () => {
    prismaMock.showtime.findMany.mockResolvedValue([]);
    await request(app).get("/api/showtimes?movieId=2");
    expect(prismaMock.showtime.findMany).toHaveBeenCalledWith({
      where: { movieId: 2 },
      orderBy: { id: "asc" },
    });
  });

  it("query không nằm trong danh sách lọc được bị bỏ qua", async () => {
    prismaMock.movie.findMany.mockResolvedValue([]);
    await request(app).get("/api/movies?title=A");
    expect(prismaMock.movie.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { id: "asc" },
    });
  });
});
```

- [ ] **Step 2: Chạy**

Run: `npx vitest run server/src/api/repo.test.ts`
Expected: PASS (12 test).
Nếu constructor `PrismaClientKnownRequestError` báo sai tham số, kiểm chữ ký của
Prisma 6: `new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion })`.

- [ ] **Step 3: Format + commit**

```bash
npm run test:run
npm run format
git add server/src/api/repo.test.ts
git commit -m "test(repo): hop dong HTTP 201/{}200/404/orderBy id asc/whitelist/P2025-P2002-P2003"
```

---

### Task 9: Đo coverage lần đầu (chưa đặt ngưỡng) + ghi lại số liệu

**Files:**

- Modify: `vite.config.mjs` (khối `coverage` trong `test`)
- Create: `docs/superpowers/plans/2026-07-29-testing-coverage-baseline.md`

**Interfaces:**

- Produces: số liệu nền để lát **T9** (plan sau) chốt ngưỡng. **Chưa** đặt
  `thresholds` ở task này — đặt bây giờ sẽ chặn chính các lát T3-T8 đang làm dở.

- [ ] **Step 1: Cấu hình coverage**

Trong `vite.config.mjs`, thêm `coverage` vào khối `test` (ngang hàng `projects`):

```js
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}", "server/src/**/*.ts"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "src/test/**",
        "server/src/test/**",
        "src/pages/dev/**",
        "src/types/**",
        "src/vite-env.d.ts",
        "server/src/index.ts",
      ],
    },
```

- [ ] **Step 2: Đo**

Run: `npm run test:cov`
Expected: PASS + bảng coverage. Ghi lại 4 con số tổng (statements / branches /
functions / lines).

- [ ] **Step 3: Ghi số liệu nền**

Tạo `docs/superpowers/plans/2026-07-29-testing-coverage-baseline.md` với nội dung
(thay `<...>` bằng số đo thật ở Step 2):

```markdown
# Coverage nền — sau T1 + T2 (2026-07-29)

Đo bằng `npm run test:cov`, **chưa đặt ngưỡng** (ngưỡng chốt ở lát T9).

| Chỉ số     | Sau T1+T2 |
| ---------- | --------- |
| statements | <...>%    |
| branches   | <...>%    |
| functions  | <...>%    |
| lines      | <...>%    |

Dùng bảng này để đối chiếu ở các lát sau: mỗi lát phải làm số đi lên.
```

- [ ] **Step 4: Kiểm `coverage/` không lọt vào git**

Run: `grep -n coverage .gitignore`
Nếu chưa có, thêm dòng `/coverage` vào `.gitignore`.

- [ ] **Step 5: Chạy đủ 7 cổng trước khi commit**

```bash
npm run typecheck
npm run lint          # phải 0 warning
npm run format:check
npm run test:run
npm run build
npm run e2e
```

- [ ] **Step 6: Commit**

```bash
git add vite.config.mjs .gitignore docs/superpowers/plans/2026-07-29-testing-coverage-baseline.md
git commit -m "test(coverage): cau hinh do do phu + ghi so lieu nen sau T1-T2"
```

---

## Sau plan này

T1 + T2 xong ⇒ hạ tầng đã được chứng minh chạy thật, và hai chỗ đắt nhất
(phân quyền + hợp đồng HTTP) đã có lưới. Plan tiếp theo phủ **T3** (`auth/routes`,
`holds`, `occupied`, `payments`, `email/send`) — viết sau khi plan này chạy xong,
để tận dụng những gì học được về `prismaMock` và fake timers.
