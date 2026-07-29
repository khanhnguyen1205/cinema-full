# Lát T4 — test cho tầng dữ liệu phía client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phủ tầng nằm giữa UI và server — `services/*` (gọi mạng), `queries/*`
(cache + invalidate), `context/AuthContext` (phiên đăng nhập), hai route guard, và
`hooks/usePagination`.

**Architecture:** Dùng lại nguyên hạ tầng T1 — MSW chặn ở tầng HTTP nên test đi
qua `services/*` **thật**; `renderWithProviders` cho component; `renderHook` +
`QueryClientProvider` cho hook.

**Tech Stack:** Vitest 3 (project `client`, happy-dom) · MSW 2 ·
@testing-library/react (`renderHook`, `waitFor`) · TanStack Query v5.

## Global Constraints

- **7 cổng CI phải xanh mỗi commit**: `typecheck` · `lint` (**0 warning**) ·
  `format:check` · `test:run` · `e2e` · `build` · `docker`.
- **Kiểm exit code, đừng kiểm bằng mắt** — nối bằng `&&`, không dùng `;` rồi đọc
  output (bài học T2: một commit đã lọt vào lúc typecheck đỏ).
- **Không sửa hành vi app.** Test lòi ra bug thật thì dừng, báo người dùng, sửa ở
  commit riêng.
- URL trong handler MSW phải khớp `VITE_API_URL`/`VITE_AUTH_URL` đã ghim ở
  `vite.config.mjs` (`http://localhost:4000/api` và `http://localhost:4000`).
- Handler MSW **phải khớp hình dạng server thật** — đã cắn một lần ở T3
  (`occupied-seats` trả `{showtimeId, seats}`, `logout` trả 204).
- Copy hiển thị qua `t()`, test assert **chuỗi tiếng Việt** (setup init i18n `vi`).
- Prettier quét file mới ⇒ `npm run format` trước khi commit. Commit thẳng `main`,
  message tiếng Việt không dấu.

---

### Task 1: `services/auth.ts`

**Files:**

- Create: `src/services/auth.test.ts`

**Interfaces:**

- Consumes: `server` (MSW) từ `src/test/msw/server.ts`, `fx` từ `src/test/fixtures.ts`.

- [ ] **Step 1: Viết test**

```ts
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import {
  fetchMe,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
} from "./auth";

const AUTH = "http://localhost:4000";

describe("services/auth — đăng nhập", () => {
  it("gửi email/password/remember và trả user", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${AUTH}/auth/login`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(fx.user);
      }),
    );

    const user = await loginUser("a@cinema.vn", "123456", true);

    expect(user).toEqual(fx.user);
    expect(body).toEqual({
      email: "a@cinema.vn",
      password: "123456",
      remember: true,
    });
  });

  it("gửi kèm cookie phiên (credentials: include)", async () => {
    let credentials = "";
    server.use(
      http.post(`${AUTH}/auth/login`, ({ request }) => {
        credentials = request.credentials;
        return HttpResponse.json(fx.user);
      }),
    );

    await loginUser("a@cinema.vn", "123456");
    expect(credentials).toBe("include");
  });

  it("lỗi từ server được ném ra kèm ĐÚNG thông điệp của server", async () => {
    server.use(
      http.post(`${AUTH}/auth/login`, () =>
        HttpResponse.json(
          { error: "Email hoặc mật khẩu không đúng." },
          { status: 401 },
        ),
      ),
    );

    await expect(loginUser("a@cinema.vn", "sai")).rejects.toThrow(
      "Email hoặc mật khẩu không đúng.",
    );
  });

  it("server trả lỗi không phải JSON thì dùng thông điệp dự phòng", async () => {
    server.use(
      http.post(`${AUTH}/auth/login`, () =>
        HttpResponse.text("boom", { status: 500 }),
      ),
    );

    await expect(loginUser("a@cinema.vn", "123456")).rejects.toThrow(
      "Đăng nhập thất bại.",
    );
  });
});

describe("services/auth — đăng ký", () => {
  it("trả user khi thành công", async () => {
    server.use(
      http.post(`${AUTH}/auth/register`, () =>
        HttpResponse.json(fx.user, { status: 201 }),
      ),
    );

    const user = await registerUser({
      fullName: "Người Dùng",
      email: "a@cinema.vn",
      password: "123456",
    });
    expect(user).toEqual(fx.user);
  });

  it("email trùng: ném lỗi 409 của server", async () => {
    server.use(
      http.post(`${AUTH}/auth/register`, () =>
        HttpResponse.json({ error: "Email này đã được đăng ký." }, { status: 409 }),
      ),
    );

    await expect(
      registerUser({ fullName: "A", email: "a@cinema.vn", password: "123456" }),
    ).rejects.toThrow("Email này đã được đăng ký.");
  });
});

describe("services/auth — đăng xuất", () => {
  it("server lỗi vẫn KHÔNG ném (mất mạng vẫn cho đăng xuất phía client)", async () => {
    server.use(
      http.post(`${AUTH}/auth/logout`, () =>
        HttpResponse.json({ error: "die" }, { status: 500 }),
      ),
    );

    await expect(logoutUser()).resolves.toBeUndefined();
  });
});

describe("services/auth — phiên", () => {
  it("refreshSession trả null khi refresh hết hạn", async () => {
    await expect(refreshSession()).resolves.toBeNull(); // handler mặc định: 401
  });

  it("fetchMe trả user khi cookie còn hạn", async () => {
    server.use(http.get(`${AUTH}/auth/me`, () => HttpResponse.json(fx.user)));
    await expect(fetchMe()).resolves.toEqual(fx.user);
  });

  it("fetchMe gặp 401 thì TỰ THỬ refresh MỘT LẦN rồi trả user", async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${AUTH}/auth/refresh`, () => {
        refreshCalls++;
        return HttpResponse.json(fx.user);
      }),
    );

    // handler mặc định của /auth/me là 401
    await expect(fetchMe()).resolves.toEqual(fx.user);
    expect(refreshCalls).toBe(1);
  });

  it("cả /me lẫn /refresh đều 401 thì trả null", async () => {
    await expect(fetchMe()).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Chạy**

Run: `npx vitest run src/services/auth.test.ts`
Expected: PASS (10 test).
Nếu `request.credentials` không có trong MSW 2, bỏ **riêng** test đó và ghi chú lý
do — đừng đổi sang mock `fetch` thủ công.

- [ ] **Step 3: Format + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add src/services/auth.test.ts
git commit -m "test(services/auth): dang nhap/dang ky/dang xuat + fetchMe tu refresh mot lan khi 401"
```

---

### Task 2: `services/api.ts`

**Files:**

- Create: `src/services/api.test.ts`

- [ ] **Step 1: Viết test**

```ts
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import {
  createBooking,
  getMovies,
  getOccupiedSeats,
  getShowtimesByCinema,
  holdSeats,
  releaseSeats,
} from "./api";

const API = "http://localhost:4000/api";

describe("services/api — đọc catalog", () => {
  it("getMovies gọi đúng đường dẫn và kèm cookie", async () => {
    let credentials = "";
    server.use(
      http.get(`${API}/movies`, ({ request }) => {
        credentials = request.credentials;
        return HttpResponse.json(fx.movies);
      }),
    );

    const movies = await getMovies();
    expect(movies).toHaveLength(2);
    expect(credentials).toBe("include");
  });

  it("getShowtimesByCinema: lấy phòng của rạp rồi gom suất theo từng phòng", async () => {
    const roomIds: string[] = [];
    server.use(
      http.get(`${API}/rooms`, ({ request }) => {
        const cityFilter = new URL(request.url).searchParams.get("cinemaId");
        expect(cityFilter).toBe("1");
        return HttpResponse.json([{ id: 1 }, { id: 2 }]);
      }),
      http.get(`${API}/showtimes`, ({ request }) => {
        const roomId = new URL(request.url).searchParams.get("roomId");
        if (roomId) roomIds.push(roomId);
        return HttpResponse.json([{ id: Number(roomId) * 10 }]);
      }),
    );

    const list = await getShowtimesByCinema(1);

    expect(roomIds.sort()).toEqual(["1", "2"]);
    expect(list.map((s) => s.id).sort()).toEqual([10, 20]);
  });
});

describe("services/api — ghế", () => {
  it("getOccupiedSeats bóc mảng seats ra khỏi phong bì {showtimeId, seats}", async () => {
    await expect(getOccupiedSeats(1)).resolves.toEqual(["A1", "A2"]);
  });

  it("server không trả seats thì ra mảng rỗng, không nổ", async () => {
    server.use(
      http.get(`${API}/occupied-seats`, () => HttpResponse.json({})),
    );
    await expect(getOccupiedSeats(1)).resolves.toEqual([]);
  });

  it("holdSeats POST kèm showtimeId + seats, TRẢ NGUYÊN Response để đọc 409", async () => {
    server.use(
      http.post(`${API}/holds`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toEqual({ showtimeId: 1, seats: ["B3"] });
        return HttpResponse.json(
          { error: "Ghế vừa bị người khác giữ.", conflicts: ["B3"] },
          { status: 409 },
        );
      }),
    );

    const res = await holdSeats(1, ["B3"]);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.conflicts).toEqual(["B3"]);
  });

  it("releaseSeats gọi DELETE kèm showtimeId", async () => {
    let method = "";
    let showtimeId: string | null = null;
    server.use(
      http.delete(`${API}/holds`, ({ request }) => {
        method = request.method;
        showtimeId = new URL(request.url).searchParams.get("showtimeId");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await releaseSeats(7);
    expect(method).toBe("DELETE");
    expect(showtimeId).toBe("7");
  });
});

describe("services/api — đặt vé", () => {
  it("gửi header x-lang để server chọn ngôn ngữ email vé", async () => {
    let lang: string | null = null;
    server.use(
      http.post(`${API}/bookings`, ({ request }) => {
        lang = request.headers.get("x-lang");
        return HttpResponse.json({ id: 1 }, { status: 201 });
      }),
    );

    await createBooking({ showtimeId: 1, seats: ["B3"] });
    expect(lang).toBe("vi"); // i18n mặc định trong test
  });

  it("gateway từ chối (409) thì NÉM LỖI, không trả thân lỗi như thể là Booking", async () => {
    server.use(
      http.post(`${API}/bookings`, () =>
        HttpResponse.json(
          { error: "Ghế vừa bị người khác giữ." },
          { status: 409 },
        ),
      ),
    );

    await expect(createBooking({ showtimeId: 1 })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Chạy**

Run: `npx vitest run src/services/api.test.ts`
Expected: PASS (8 test).

- [ ] **Step 3: Format + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add src/services/api.test.ts
git commit -m "test(services/api): duong dan + credentials, gom suat theo phong, boc seats, x-lang, 409 nem loi"
```

---

### Task 3: `queries/*` — cache và invalidate

**Files:**

- Create: `src/test/queryWrapper.tsx`
- Create: `src/queries/booking.test.tsx`

**Interfaces:**

- Produces: `renderQueryHook(hook)` — bọc `QueryClientProvider` cho `renderHook`,
  trả thêm `queryClient` để test kiểm invalidate.

- [ ] **Step 1: Viết wrapper cho hook**

Tạo `src/test/queryWrapper.tsx`:

```tsx
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";

// Bọc hook Query mà không cần Router/Auth — dùng cho test tầng queries/*.
export function renderQueryHook<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(hook, { wrapper }), queryClient };
}
```

- [ ] **Step 2: Viết test**

Tạo `src/queries/booking.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "test/msw/server";
import { renderQueryHook } from "test/queryWrapper";
import { qk } from "./keys";
import { useConcessions, useCreateBooking, useOccupiedSeats } from "./booking";

const API = "http://localhost:4000/api";

describe("queries/booking", () => {
  it("useOccupiedSeats trả danh sách ghế đã chiếm", async () => {
    const { result } = renderQueryHook(() => useOccupiedSeats(1));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(["A1", "A2"]);
  });

  it("useOccupiedSeats KHÔNG gọi mạng khi enabled=false", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/occupied-seats`, () => {
        calls++;
        return HttpResponse.json({ seats: [] });
      }),
    );

    const { result } = renderQueryHook(() =>
      useOccupiedSeats(1, { enabled: false }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(0);
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useConcessions trả danh mục bắp nước", async () => {
    const { result } = renderQueryHook(() => useConcessions());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("useCreateBooking đặt xong thì LÀM MỚI vé của tôi + ghế của suất đó", async () => {
    server.use(
      http.post(`${API}/bookings`, () =>
        HttpResponse.json({ id: 99 }, { status: 201 }),
      ),
    );

    const { result, queryClient } = renderQueryHook(() => useCreateBooking());
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    await result.current.mutateAsync({ showtimeId: 1, seats: ["B3"] });

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.myBookings });
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.occupiedSeats(1) });
  });
});
```

- [ ] **Step 3: Chạy**

Run: `npx vitest run src/queries/booking.test.tsx`
Expected: PASS (4 test).

- [ ] **Step 4: Format + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add src/test/queryWrapper.tsx src/queries/booking.test.tsx
git commit -m "test(queries): useOccupiedSeats/useConcessions + useCreateBooking invalidate dung key"
```

---

### Task 4: `context/AuthContext`

**Files:**

- Create: `src/context/AuthContext.test.tsx`

**Lưu ý thiết kế — đọc trước khi viết:**

- `AuthProvider` có ba hiệu ứng theo thời gian: **silent refresh 13'**, **idle
  logout 30'**, và `BroadcastChannel`. Test dùng
  **`vi.useFakeTimers({ shouldAdvanceTime: true })`** — timer giả nhưng vẫn để
  promise thật chạy tiếp; `vi.useFakeTimers()` trần sẽ **treo** vì MSW không bao
  giờ hoàn thành.
- `renderWithProviders` đã bọc sẵn `AuthProvider`, nên test ở đây render thẳng một
  component thăm dò.

- [ ] **Step 1: Viết test**

```tsx
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "test/msw/server";
import { fx } from "test/fixtures";
import { renderWithProviders } from "test/renderWithProviders";
import { useAuth } from "./AuthContext";

const AUTH = "http://localhost:4000";

function Probe(): ReactElement {
  const { user, loading, logout } = useAuth();
  if (loading) return <p>đang tải</p>;
  return (
    <div>
      <p>{user ? `chào ${user.fullName}` : "khách"}</p>
      <button onClick={() => void logout()}>Đăng xuất</button>
    </div>
  );
}

describe("AuthContext — nạp phiên", () => {
  it("hiện trạng thái đang tải rồi mới ra kết quả", async () => {
    renderWithProviders(<Probe />);
    expect(screen.getByText("đang tải")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("khách")).toBeInTheDocument());
  });

  it("cookie còn hạn: nạp được user", async () => {
    renderWithProviders(<Probe />, { user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("chào Người Dùng")).toBeInTheDocument(),
    );
  });
});

describe("AuthContext — đăng xuất", () => {
  it("bấm đăng xuất thì user về null", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Probe />, { user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("chào Người Dùng")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));

    await waitFor(() => expect(screen.getByText("khách")).toBeInTheDocument());
  });
});

describe("AuthContext — hiệu ứng theo thời gian", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("cứ 13 phút thì xoay token; refresh hỏng thì kết thúc phiên", async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${AUTH}/auth/refresh`, () => {
        refreshCalls++;
        return HttpResponse.json({ error: "hết hạn" }, { status: 401 });
      }),
    );

    renderWithProviders(<Probe />, { user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("chào Người Dùng")).toBeInTheDocument(),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(13 * 60 * 1000 + 100);
    });

    expect(refreshCalls).toBeGreaterThanOrEqual(1);
    await waitFor(() => expect(screen.getByText("khách")).toBeInTheDocument());
  });

  it("không thao tác 30 phút thì tự đăng xuất", async () => {
    server.use(
      http.post(`${AUTH}/auth/refresh`, () => HttpResponse.json(fx.user)),
    );

    renderWithProviders(<Probe />, { user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("chào Người Dùng")).toBeInTheDocument(),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 100);
    });

    await waitFor(() => expect(screen.getByText("khách")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Chạy**

Run: `npx vitest run src/context/AuthContext.test.tsx`
Expected: PASS (5 test).
**Nếu test thời gian treo hoặc chập chờn:** kiểm lại đã dùng
`vi.useFakeTimers({ shouldAdvanceTime: true })` chưa. Nếu vẫn chập chờn, **dừng và
báo người dùng** — đừng nới lỏng assertion cho qua.

- [ ] **Step 3: Format + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add src/context/AuthContext.test.tsx
git commit -m "test(auth-context): nap phien, dang xuat, silent refresh 13', idle logout 30'"
```

---

### Task 5: Hai route guard + `usePagination`

**Files:**

- Create: `src/routes/guards.test.tsx`
- Create: `src/hooks/usePagination.test.ts`

- [ ] **Step 1: Viết test cho guard**

```tsx
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { fx } from "test/fixtures";
import { renderWithProviders } from "test/renderWithProviders";
import PrivateRoute from "./PrivateRoute";
import AdminRoute from "./AdminRoute";

// Hiện đường dẫn hiện tại + nơi vừa bị đá đi, để khẳng định chuyển hướng.
function LoginProbe(): ReactElement {
  const location = useLocation() as { state?: { from?: { pathname: string } } };
  return <p>login từ {location.state?.from?.pathname ?? "(không rõ)"}</p>;
}

const tree = (
  <Routes>
    <Route path="/login" element={<LoginProbe />} />
    <Route path="/" element={<p>trang chủ</p>} />
    <Route
      path="/tickets"
      element={
        <PrivateRoute>
          <p>vé của tôi</p>
        </PrivateRoute>
      }
    />
    <Route
      path="/admin"
      element={
        <AdminRoute>
          <p>bảng quản trị</p>
        </AdminRoute>
      }
    />
  </Routes>
);

describe("PrivateRoute", () => {
  it("khách bị đá về /login và GIỮ LẠI nơi định đến", async () => {
    renderWithProviders(tree, { route: "/tickets" });
    await waitFor(() =>
      expect(screen.getByText("login từ /tickets")).toBeInTheDocument(),
    );
  });

  it("đã đăng nhập thì vào được", async () => {
    renderWithProviders(tree, { route: "/tickets", user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("vé của tôi")).toBeInTheDocument(),
    );
  });
});

describe("AdminRoute", () => {
  it("khách bị đá về /login", async () => {
    renderWithProviders(tree, { route: "/admin" });
    await waitFor(() =>
      expect(screen.getByText("login từ /admin")).toBeInTheDocument(),
    );
  });

  it("user thường bị đá về trang chủ, KHÔNG phải trang đăng nhập", async () => {
    renderWithProviders(tree, { route: "/admin", user: fx.user });
    await waitFor(() =>
      expect(screen.getByText("trang chủ")).toBeInTheDocument(),
    );
  });

  it("admin vào được", async () => {
    renderWithProviders(tree, { route: "/admin", user: fx.admin });
    await waitFor(() =>
      expect(screen.getByText("bảng quản trị")).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Viết test cho `usePagination`**

```ts
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import usePagination from "./usePagination";

const items = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

describe("usePagination", () => {
  it("cắt đúng trang đầu và đếm đúng tổng số trang", () => {
    const { result } = renderHook(() => usePagination(items(25), 10));
    expect(result.current.pageItems).toHaveLength(10);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.from).toBe(1);
    expect(result.current.to).toBe(10);
    expect(result.current.total).toBe(25);
  });

  it("trang cuối chỉ lấy phần còn lại", () => {
    const { result } = renderHook(() => usePagination(items(25), 10));
    act(() => result.current.setPage(3));
    expect(result.current.pageItems).toEqual([21, 22, 23, 24, 25]);
    expect(result.current.from).toBe(21);
    expect(result.current.to).toBe(25);
  });

  it("danh sách rỗng: 1 trang, from = 0", () => {
    const { result } = renderHook(() => usePagination<number>([], 10));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.from).toBe(0);
    expect(result.current.to).toBe(0);
  });

  it("danh sách co lại (sau khi tìm kiếm/xoá) thì nhảy về trang 1", () => {
    const { result, rerender } = renderHook(
      ({ list }) => usePagination(list, 10),
      { initialProps: { list: items(25) } },
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ list: items(5) }); // còn 1 trang
    expect(result.current.page).toBe(1);
  });
});
```

- [ ] **Step 3: Chạy**

Run: `npx vitest run src/routes/guards.test.tsx src/hooks/usePagination.test.ts`
Expected: PASS (9 test).

- [ ] **Step 4: Format + commit**

```bash
npm run typecheck && npm run lint && npm run format
git add src/routes/guards.test.tsx src/hooks/usePagination.test.ts
git commit -m "test(routes+hooks): PrivateRoute giu state.from, AdminRoute da user thuong ve trang chu, usePagination"
```

---

### Task 6: Đo lại coverage + đủ cổng + push

**Files:**

- Modify: `docs/superpowers/plans/2026-07-29-testing-coverage-baseline.md`

- [ ] **Step 1: Đo lại**

Run: `npm run test:cov`
Ghi lại 4 con số tổng + các dòng `src/services`, `src/queries`, `src/context`,
`src/hooks`, `src/routes`.

- [ ] **Step 2: Thêm cột "Sau T4" vào cả hai bảng**

Sửa `docs/superpowers/plans/2026-07-29-testing-coverage-baseline.md`, điền số thật
ở Step 1.

- [ ] **Step 3: Chạy đủ cổng, kiểm exit code**

```bash
npm run typecheck && echo "G1=OK" && \
npm run lint && echo "G2=OK" && \
npm run format:check && echo "G3=OK" && \
npm run test:run && echo "G4=OK" && \
npm run build && echo "G5=OK" && \
npm run e2e && echo "G6=OK"
```

- [ ] **Step 4: Commit + push + xác nhận CI**

```bash
git add docs/superpowers/plans/2026-07-29-testing-coverage-baseline.md
git commit -m "docs(test): cap nhat do phu sau T4"
git push origin main
curl -s "https://api.github.com/repos/khanhnguyen1205/cinema-full/actions/runs?per_page=1"
```

Expected: `conclusion: success`.

---

## Sau plan này

T4 xong ⇒ tầng dữ liệu client đã có lưới. Còn **T5** (components có logic) ·
**T6-T7** (pages) · **T8** (admin) · **T9** (chốt ngưỡng coverage + CI + docs).
