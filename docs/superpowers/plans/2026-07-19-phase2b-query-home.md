# GĐ2b — Query Infra + Home Cờ Đầu (Kinetic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng tầng dữ liệu TanStack Query (hạ tầng dùng chung) và redesign trang Home + Navbar + Footer theo ngôn ngữ Kinetic Cinematic, wired vào Query hooks.

**Architecture:** Thêm `QueryClientProvider` bọc trong `ErrorBoundary`, ngoài `AuthProvider`. Registry query-key `qk.*` + hook Home có kiểu ở `src/queries/`. Home/Navbar/Footer convert `.jsx→.tsx`, dùng primitive `ui/` + token, wired Query. Card phim tách ra `MovieCard.tsx` để tái dùng.

**Tech Stack:** React 18 + TypeScript 5.7 (strict), Vite 6, **@tanstack/react-query v5** (+ devtools), Vitest 3 (+ happy-dom, @testing-library), ESLint 9 flat, Prettier, plain CSS + token.

## Global Constraints

- Node 22, Vite 6, TypeScript `~5.7` strict, React 18 — không nâng major.
- Absolute imports qua alias/paths (`components/…`, `queries/…`, `lib/…`, `types`); sibling cùng thư mục dùng `./`.
- Mọi commit giữ **6 gate xanh**: `npm run typecheck`, `npm run lint` (0 warning), `npm run format:check`, `npm run test:run`, `npm run e2e`, `npm run build`.
- **KHÔNG đổi giá trị token màu cũ** (chỉ tiêu thụ token từ `tokens.css`, không hardcode màu/spacing).
- Mọi animation phải có nhánh `@media (prefers-reduced-motion: reduce)`. Chỉ animate `transform`/`opacity`.
- Không dùng `any` (`@typescript-eslint/no-explicit-any` = error). CSS custom property trong `style` dùng kiểu `CSSProperties & Record<string, string>`.
- react-refresh warning (export non-component cạnh component) xử lý bằng **disable có chú thích**; luôn kiểm output lint, giữ **0 warning**.
- UI copy tiếng Việt. Giá VND `.toLocaleString("vi-VN")` + `₫` (nếu hiển thị giá — Home không có).
- **KHÔNG** sửa/commit `CLAUDE.md` và `README.md` (để lát 2h).
- **Navbar phải giữ prop `back?: string`** (BookingWizard/CinemaDetail/MovieDetail truyền vào).
- Commit mỗi task; push thẳng `main` khi kết thúc lát (repo cá nhân).
- Verify UI bằng screenshot headless Chrome/Playwright (người dùng review qua điện thoại). Script `.mjs` đặt **trong project** (không phải scratchpad, để resolve `node_modules`), import `chromium` từ `@playwright/test`.

## File Structure

- `src/queries/keys.ts` — registry query-key `qk.*` (hằng có kiểu).
- `src/queries/keys.test.ts` — test cấu trúc key.
- `src/queries/client.ts` — tạo `QueryClient` với default.
- `src/queries/catalog.ts` — hook Home: `useMovies`/`useCinemas`/`useCities`/`useAllShowtimes`.
- `src/App.tsx` — thêm `QueryClientProvider` + devtools DEV.
- `src/components/MovieCard.tsx` + `src/components/MovieCard.css` — card phim tái dùng.
- `src/components/MovieCard.test.tsx` — test render/fallback.
- `src/components/Navbar.tsx` (thay `Navbar.jsx`) + `src/components/Navbar.css` — shell điều hướng kinetic, menu mobile.
- `src/components/Footer.tsx` (thay `Footer.jsx`) + `src/components/Footer.css` — footer kinetic.
- `src/pages/Home.tsx` (thay `Home.jsx`) — redesign kinetic wired Query; sửa `src/pages/Home.css`.
- `e2e/smoke.spec.ts` — mở rộng smoke Home.

---

### Task 1: Query-key registry `qk` + test

**Files:**
- Create: `src/queries/keys.ts`
- Test: `src/queries/keys.test.ts`

**Interfaces:**
- Produces: `qk` — object hằng `as const` với các key mảng: `qk.movies`, `qk.cinemas`, `qk.cities`, `qk.showtimes` (mỗi cái `readonly [string]`).

- [ ] **Step 1: Viết test thất bại**

Create `src/queries/keys.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { qk } from "./keys";

describe("qk (query-key registry)", () => {
  it("khai báo key ổn định cho các collection Home", () => {
    expect(qk.movies).toEqual(["movies"]);
    expect(qk.cinemas).toEqual(["cinemas"]);
    expect(qk.cities).toEqual(["cities"]);
    expect(qk.showtimes).toEqual(["showtimes"]);
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx vitest run src/queries/keys.test.ts`
Expected: FAIL (`Failed to resolve import "./keys"`).

- [ ] **Step 3: Cài đặt `keys.ts`**

Create `src/queries/keys.ts`:

```ts
// Registry query-key tập trung — một nguồn sự thật cho cache & invalidate.
// Key có tham số (movie(id), occupiedSeats(id)...) thêm ở lát sau khi cần.
export const qk = {
  movies: ["movies"] as const,
  cinemas: ["cinemas"] as const,
  cities: ["cities"] as const,
  showtimes: ["showtimes"] as const,
};
```

- [ ] **Step 4: Chạy để thấy pass**

Run: `npx vitest run src/queries/keys.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: typecheck + lint + commit**

Run: `npm run typecheck && npm run lint`
Expected: cả hai xanh.

```bash
git add src/queries/keys.ts src/queries/keys.test.ts
git commit -m "feat(GD2b/1): registry query-key qk + test"
```

---

### Task 2: QueryClient + Provider + hook Home (không đổi UI)

**Files:**
- Create: `src/queries/client.ts`
- Create: `src/queries/catalog.ts`
- Modify: `src/App.tsx`
- Modify: `package.json` (dependency)

**Interfaces:**
- Consumes: `qk` từ `queries/keys`; các hàm `getMovies`/`getCinemas`/`getCities`/`getAllShowtimes` từ `services/api`; kiểu `Movie`/`Cinema`/`City`/`Showtime` từ `types`.
- Produces:
  - `queryClient: QueryClient` (default: `staleTime 60000`, `retry 1`, `refetchOnWindowFocus false`).
  - `useMovies(): UseQueryResult<Movie[]>`, `useCinemas(): UseQueryResult<Cinema[]>`, `useCities(): UseQueryResult<City[]>`, `useAllShowtimes(): UseQueryResult<Showtime[]>`.

- [ ] **Step 1: Cài dependency**

```bash
npm install @tanstack/react-query
npm install -D @tanstack/react-query-devtools
```

Expected: thêm `@tanstack/react-query` vào dependencies, devtools vào devDependencies.

- [ ] **Step 2: Tạo `client.ts`**

Create `src/queries/client.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";

// Catalog ít đổi trong một phiên → staleTime 60s, không refetch khi focus.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

- [ ] **Step 3: Tạo hook Home `catalog.ts`**

Create `src/queries/catalog.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import {
  getMovies,
  getCinemas,
  getCities,
  getAllShowtimes,
} from "services/api";
import { qk } from "./keys";

export const useMovies = () =>
  useQuery({ queryKey: qk.movies, queryFn: getMovies });

export const useCinemas = () =>
  useQuery({ queryKey: qk.cinemas, queryFn: () => getCinemas() });

export const useCities = () =>
  useQuery({ queryKey: qk.cities, queryFn: getCities });

export const useAllShowtimes = () =>
  useQuery({ queryKey: qk.showtimes, queryFn: getAllShowtimes });
```

(`getCinemas` nhận `cityId?` optional nên bọc arrow để không truyền tham số thừa.)

- [ ] **Step 4: Bọc `QueryClientProvider` trong `App.tsx`**

Modify `src/App.tsx` — thêm import ở đầu:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "queries/client";
```

Đổi hàm `App` (bọc QueryClient trong ErrorBoundary, ngoài AuthProvider):

```tsx
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 5: Gate đầy đủ (app vẫn chạy, UI chưa đổi)**

Run: `npm run typecheck && npm run lint && npm run test:run && npm run build`
Expected: tất cả xanh (Home cũ vẫn dùng fetch trực tiếp — chưa wired Query, không sao).

- [ ] **Step 6: Verify app tải được (e2e smoke cũ)**

Run: `npm run e2e`
Expected: 3 smoke test cũ xanh (provider không phá vỡ gì).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/queries/client.ts src/queries/catalog.ts src/App.tsx
git commit -m "feat(GD2b/2): QueryClientProvider + hook Home + devtools (chua doi UI)"
```

---

### Task 3: `MovieCard` component (tái dùng) + test

**Files:**
- Create: `src/components/MovieCard.tsx`
- Create: `src/components/MovieCard.css`
- Test: `src/components/MovieCard.test.tsx`

**Interfaces:**
- Consumes: kiểu `Movie` từ `types`; `Badge`/`Tag` từ `components/ui`; `cx` từ `lib/cx`; `useNavigate` từ `react-router-dom`.
- Produces: `MovieCard` (default) — props `{ movie: Movie }`. Render `<button class="movie-k">` chứa poster (fallback chữ cái đầu khi thiếu poster), `Badge` rating (khi có), `Tag` genre, tên (`.movie-k__title`), meta (`.movie-k__meta`). Click → `/movie/${movie.id}`.

- [ ] **Step 1: Viết test thất bại**

Create `src/components/MovieCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MovieCard from "./MovieCard";
import type { Movie } from "types";

const movie: Movie = {
  id: 7,
  title: "Dune",
  genre: "Sci-Fi",
  duration: 155,
  rating: 8.4,
};

function renderCard(m: Movie) {
  return render(
    <MemoryRouter>
      <MovieCard movie={m} />
    </MemoryRouter>,
  );
}

describe("MovieCard", () => {
  it("hiển thị tên, thể loại, rating", () => {
    renderCard(movie);
    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Sci-Fi")).toBeInTheDocument();
    expect(screen.getByText(/8\.4/)).toBeInTheDocument();
  });

  it("không có poster thì hiện chữ cái đầu", () => {
    renderCard({ ...movie, poster: undefined });
    expect(screen.getByText("D")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx vitest run src/components/MovieCard.test.tsx`
Expected: FAIL (`Failed to resolve import "./MovieCard"`).

- [ ] **Step 3: Tạo `MovieCard.css`**

Create `src/components/MovieCard.css`:

```css
.movie-k {
  display: flex;
  flex-direction: column;
  text-align: left;
  background: var(--surface);
  border: var(--bw-1) solid var(--border);
  border-radius: var(--r-sm);
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  transition:
    transform var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast),
    border-color var(--dur-fast);
}
.movie-k:hover {
  transform: translate(-3px, -3px);
  box-shadow: var(--shadow-hard);
  border-color: var(--border-strong);
}
.movie-k:focus-visible {
  outline: var(--bw-2) solid var(--focus);
  outline-offset: 2px;
}
.movie-k__media {
  position: relative;
  aspect-ratio: 2 / 3;
  background: var(--surface-2);
}
.movie-k__poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.movie-k__initial {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: var(--fs-2xl);
  color: var(--text-dim);
}
.movie-k__badge {
  position: absolute;
  top: var(--sp-2);
  right: var(--sp-2);
}
.movie-k__tag {
  position: absolute;
  bottom: var(--sp-2);
  left: var(--sp-2);
}
.movie-k__info {
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.movie-k__title {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: var(--fs-base);
  color: var(--text);
  line-height: 1.15;
}
.movie-k__meta {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: var(--tr-wide);
  text-transform: uppercase;
  color: var(--text-muted);
}
@media (prefers-reduced-motion: reduce) {
  .movie-k {
    transition: border-color var(--dur-fast);
  }
  .movie-k:hover {
    transform: none;
    box-shadow: none;
  }
}
```

- [ ] **Step 4: Tạo `MovieCard.tsx`**

Create `src/components/MovieCard.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Movie } from "types";
import { Badge, Tag } from "components/ui";
import "./MovieCard.css";

export default function MovieCard({ movie }: { movie: Movie }) {
  const navigate = useNavigate();
  const [imgOk, setImgOk] = useState(true);
  return (
    <button className="movie-k" onClick={() => navigate(`/movie/${movie.id}`)}>
      <span className="movie-k__media">
        {movie.poster && imgOk ? (
          <img
            className="movie-k__poster"
            src={movie.poster}
            alt={movie.title}
            loading="lazy"
            onError={() => setImgOk(false)}
          />
        ) : (
          <span className="movie-k__initial">{movie.title[0]}</span>
        )}
        {movie.rating != null && (
          <Badge className="movie-k__badge">
            ★ {movie.rating.toFixed(1)}
          </Badge>
        )}
        <Tag className="movie-k__tag">{movie.genre}</Tag>
      </span>
      <span className="movie-k__info">
        <span className="movie-k__title">{movie.title}</span>
        <span className="movie-k__meta">
          {movie.genre} · {movie.duration} phút
        </span>
      </span>
    </button>
  );
}
```

- [ ] **Step 5: Chạy test + gate**

Run: `npx vitest run src/components/MovieCard.test.tsx`
Expected: PASS (2 test).
Run: `npm run typecheck && npm run lint`
Expected: xanh.

- [ ] **Step 6: Commit**

```bash
git add src/components/MovieCard.tsx src/components/MovieCard.css src/components/MovieCard.test.tsx
git commit -m "feat(GD2b/3): MovieCard component tai dung + test"
```

---

### Task 4: Redesign `Navbar` (tsx, menu mobile, giữ logic)

**Files:**
- Create: `src/components/Navbar.tsx`
- Create: `src/components/Navbar.css`
- Delete: `src/components/Navbar.jsx`

**Interfaces:**
- Consumes: `useAuth` từ `context/AuthContext`; `Link`/`useLocation`/`useNavigate` từ `react-router-dom`; `cx` từ `lib/cx`.
- Produces: `Navbar` (default) — props `{ back?: string }`. Sticky top; logo "CINEMA"; link Trang chủ/Phim/Rạp/Vé; menu hamburger mobile (`aria-expanded`/`aria-controls`, đóng khi chọn link hoặc Esc); vùng phải: avatar+dropdown (Vé của tôi / Quản trị nếu admin / Đăng xuất) khi có `user`, nút "Đăng nhập" khi không. **Giữ nguyên logic `logout`/điều hướng.**

- [ ] **Step 1: Tạo `Navbar.css`** (kinetic, có breakpoint mobile)

Create `src/components/Navbar.css`:

```css
.nav-k {
  position: sticky;
  top: 0;
  z-index: var(--z-nav);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  height: 64px;
  padding-inline: var(--gutter);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: var(--bw-1) solid var(--border);
}
.nav-k__left {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}
.nav-k__logo {
  font-family: var(--font-display);
  font-size: var(--fs-lg);
  letter-spacing: var(--tr-wide);
  color: var(--text);
}
.nav-k__logo b {
  color: var(--red);
  font-weight: inherit;
}
.nav-k__back {
  display: inline-flex;
  color: var(--text-muted);
}
.nav-k__links {
  display: flex;
  gap: var(--sp-5);
}
.nav-k__link {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: var(--tr-wide);
  text-transform: uppercase;
  color: var(--text-muted);
  padding-block: var(--sp-2);
  border-bottom: var(--bw-2) solid transparent;
}
.nav-k__link:hover {
  color: var(--text);
}
.nav-k__link.is-active {
  color: var(--text);
  border-bottom-color: var(--red);
}
.nav-k__right {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.nav-k__login {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: var(--tr-wide);
  text-transform: uppercase;
  color: #fff;
  background: var(--red);
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--r-sm);
}
.nav-k__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface-2);
  border: var(--bw-1) solid var(--border-strong);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  font-weight: 700;
  cursor: pointer;
}
.nav-k__menu {
  position: relative;
}
.nav-k__dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + var(--sp-2));
  min-width: 200px;
  background: var(--surface-2);
  border: var(--bw-1) solid var(--border-strong);
  border-radius: var(--r-sm);
  padding: var(--sp-2);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.nav-k__item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  color: var(--text-muted);
  background: none;
  border: 0;
  cursor: pointer;
  text-align: left;
}
.nav-k__item:hover {
  color: var(--text);
  background: var(--surface);
}
.nav-k__hamburger {
  display: none;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: var(--bw-1) solid var(--border);
  border-radius: var(--r-sm);
  color: var(--text);
  font-size: 20px;
  cursor: pointer;
}
.nav-k__mobile {
  display: none;
}
@media (max-width: 720px) {
  .nav-k__links {
    display: none;
  }
  .nav-k__hamburger {
    display: inline-flex;
  }
  .nav-k__mobile.is-open {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    position: fixed;
    top: 64px;
    left: 0;
    right: 0;
    z-index: var(--z-dropdown);
    background: var(--surface-2);
    border-bottom: var(--bw-1) solid var(--border-strong);
    padding: var(--sp-4) var(--gutter);
  }
  .nav-k__mobile .nav-k__link {
    font-size: var(--fs-md);
    border-bottom: 0;
  }
}
```

- [ ] **Step 2: Tạo `Navbar.tsx`**

Create `src/components/Navbar.tsx`:

```tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "context/AuthContext";
import { cx } from "lib/cx";
import "./Navbar.css";

const LINKS = [
  { to: "/", label: "Trang chủ", match: (p: string) => p === "/" },
  { to: "/movies", label: "Phim", match: (p: string) => p === "/movies" },
  { to: "/cinemas", label: "Rạp", match: (p: string) => p.startsWith("/cinema") },
  { to: "/tickets", label: "Vé", match: (p: string) => p === "/tickets" },
];

export default function Navbar({ back }: { back?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [dropOpen, setDropOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setDropOpen(false);
    navigate("/");
  };

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((w) => w[0])
        .slice(-2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <nav className="nav-k">
      <div className="nav-k__left">
        {back && (
          <Link to={back} className="nav-k__back" aria-label="Quay lại">
            ←
          </Link>
        )}
        <Link to="/" className="nav-k__logo">
          CINE<b>MA</b>
        </Link>
      </div>

      <div className="nav-k__links">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={cx("nav-k__link", l.match(location.pathname) && "is-active")}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div className="nav-k__right">
        {user ? (
          <div className="nav-k__menu" ref={dropRef}>
            <button
              className="nav-k__avatar"
              onClick={() => setDropOpen((v) => !v)}
              title={user.fullName}
              aria-label="Tài khoản"
            >
              {initials}
            </button>
            {dropOpen && (
              <div className="nav-k__dropdown">
                <Link
                  to="/tickets"
                  className="nav-k__item"
                  onClick={() => setDropOpen(false)}
                >
                  Vé của tôi
                </Link>
                {user.role === "admin" && (
                  <Link
                    to="/admin"
                    className="nav-k__item"
                    onClick={() => setDropOpen(false)}
                  >
                    Quản trị
                  </Link>
                )}
                <button className="nav-k__item" onClick={handleLogout}>
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="nav-k__login">
            Đăng nhập
          </Link>
        )}
        <button
          className="nav-k__hamburger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="nav-mobile"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      <div
        id="nav-mobile"
        className={cx("nav-k__mobile", menuOpen && "is-open")}
      >
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={cx("nav-k__link", l.match(location.pathname) && "is-active")}
            onClick={() => setMenuOpen(false)}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Xoá `Navbar.jsx`**

```bash
git rm src/components/Navbar.jsx
```

(Các import `components/Navbar` không đuôi vẫn resolve sang `.tsx`.)

- [ ] **Step 4: Gate + verify các trang cũ vẫn render Navbar**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: xanh (Home/Movies/CinemaDetail/MovieDetail/MyTickets/Cinemas/AdminLayout/BookingWizard import `components/Navbar` vẫn hoạt động; `back` prop giữ nguyên).

- [ ] **Step 5: Chụp ảnh Navbar (desktop + mobile) xác minh**

Tạo `_shot_tmp.mjs` (trong project) chụp `http://localhost:3000/` desktop 1440 và mobile 390 (mở/không mở menu), xem để xác nhận. Xoá script + ảnh sau khi xem. (Chi tiết script: import `chromium` từ `@playwright/test`, `page.setViewportSize`, screenshot.)

- [ ] **Step 6: Commit**

```bash
git add src/components/Navbar.tsx src/components/Navbar.css
git commit -m "feat(GD2b/4): redesign Navbar kinetic (tsx, menu mobile, giu logic)"
```

---

### Task 5: Redesign `Footer` (tsx)

**Files:**
- Create: `src/components/Footer.tsx`
- Create: `src/components/Footer.css`
- Delete: `src/components/Footer.jsx`

**Interfaces:**
- Produces: `Footer` (default) — không props. Bố cục mono, cột đánh `N°`, rule, bản quyền. Dùng `Numbered`/`Rule` từ `components/ui` nếu hợp.

- [ ] **Step 1: Tạo `Footer.css`**

Create `src/components/Footer.css`:

```css
.foot-k {
  border-top: var(--bw-1) solid var(--border);
  padding: var(--sp-12) var(--gutter) var(--sp-8);
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
}
.foot-k__top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--sp-6);
}
.foot-k__brand {
  font-family: var(--font-display);
  font-size: var(--fs-lg);
  letter-spacing: var(--tr-wide);
  color: var(--text);
}
.foot-k__brand b {
  color: var(--red);
  font-weight: inherit;
}
.foot-k__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-5);
}
.foot-k__links a {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: var(--tr-wide);
  text-transform: uppercase;
  color: var(--text-muted);
}
.foot-k__links a:hover {
  color: var(--text);
}
.foot-k__copy {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: var(--tr-wide);
  color: var(--text-dim);
}
```

- [ ] **Step 2: Tạo `Footer.tsx`**

Create `src/components/Footer.tsx`:

```tsx
import { Rule } from "components/ui";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="foot-k">
      <div className="foot-k__top">
        <div className="foot-k__brand">
          CINE<b>MA</b> — THE CINEMATIC EDITORIAL
        </div>
        <div className="foot-k__links">
          <a href="#">Chính sách bảo mật</a>
          <a href="#">Điều khoản dịch vụ</a>
          <a href="#">Trung tâm trợ giúp</a>
        </div>
      </div>
      <Rule />
      <div className="foot-k__copy">
        N°2026 · © THE CINEMATIC EDITORIAL · BẢO LƯU MỌI QUYỀN
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Xoá `Footer.jsx` + gate**

```bash
git rm src/components/Footer.jsx
```

Run: `npm run typecheck && npm run lint && npm run build`
Expected: xanh.

- [ ] **Step 4: Commit**

```bash
git add src/components/Footer.tsx src/components/Footer.css
git commit -m "feat(GD2b/5): redesign Footer kinetic (tsx)"
```

---

### Task 6: Redesign `Home` (tsx, wired Query, kinetic)

**Files:**
- Create: `src/pages/Home.tsx`
- Delete: `src/pages/Home.jsx`
- Modify: `src/pages/Home.css` (viết lại theo token)

**Interfaces:**
- Consumes: `useMovies`/`useCinemas`/`useCities`/`useAllShowtimes` từ `queries/catalog`; `MovieCard` từ `components/MovieCard`; `Navbar`/`Footer`; `Container`/`Section`/`Grid`/`Marquee`/`KineticHeading`/`Button`/`Skeleton`/`Numbered` từ `components/ui`; `useNavigate` từ `react-router-dom`; kiểu từ `types`.
- Produces: trang Home mặc định (`export default function Home`).

Ghi chú craft: task này là "wow" trực quan — **dùng skill `frontend-design`** khi tinh chỉnh CSS; lặp qua screenshot desktop+mobile. Cấu trúc JSX + wiring Query dưới đây là bộ khung chuẩn; CSS token hoá, polish theo ảnh.

- [ ] **Step 1: Tạo `Home.tsx` (khung + wiring Query)**

Create `src/pages/Home.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import MovieCard from "components/MovieCard";
import {
  Container,
  Section,
  Grid,
  Marquee,
  KineticHeading,
  Button,
  Skeleton,
} from "components/ui";
import {
  useMovies,
  useCinemas,
  useCities,
  useAllShowtimes,
} from "queries/catalog";
import "./Home.css";

const AUTOPLAY_MS = 6000;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export default function Home() {
  const navigate = useNavigate();
  const moviesQ = useMovies();
  const cinemasQ = useCinemas();
  const citiesQ = useCities();
  const showtimesQ = useAllShowtimes();

  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const cinemas = cinemasQ.data ?? [];
  const cities = citiesQ.data ?? [];
  const showtimeCount = showtimesQ.data?.length ?? 0;

  const featured = useMemo(() => movies.slice(0, 5), [movies]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Tự xoay hero; tắt khi reduced-motion hoặc đang hover.
  useEffect(() => {
    if (paused || featured.length <= 1 || prefersReducedMotion()) return;
    const t = setInterval(
      () => setHeroIndex((i) => (i + 1) % featured.length),
      AUTOPLAY_MS,
    );
    return () => clearInterval(t);
  }, [paused, featured.length]);

  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );
  const genreStats = useMemo(() => {
    const map = new Map<string, number>();
    movies.forEach((m) => map.set(m.genre, (map.get(m.genre) ?? 0) + 1));
    return [...map.entries()].map(([genre, count]) => ({ genre, count }));
  }, [movies]);

  if (moviesQ.isError) {
    return (
      <div className="page home-page">
        <Navbar />
        <Container>
          <div className="home-error">
            <p>Không tải được dữ liệu.</p>
            <Button onClick={() => moviesQ.refetch()}>Thử lại</Button>
          </div>
        </Container>
        <Footer />
      </div>
    );
  }

  if (moviesQ.isLoading || !featured.length) {
    return (
      <div className="page home-page">
        <Navbar />
        <Container>
          <div className="home-hero-skeleton">
            <Skeleton height="360px" />
          </div>
          <Grid min="200px">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height="320px" />
            ))}
          </Grid>
        </Container>
        <Footer />
      </div>
    );
  }

  const active = featured[heroIndex];
  const prev = () =>
    setHeroIndex((i) => (i - 1 + featured.length) % featured.length);
  const next = () => setHeroIndex((i) => (i + 1) % featured.length);

  return (
    <div className="page home-page">
      <Navbar />

      {/* HERO — kinetic carousel */}
      <section
        className="hero-k"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="hero-k__poster"
          key={"bg" + active.id}
          style={
            active.poster
              ? {
                  backgroundImage: `linear-gradient(to left, rgba(10,10,10,0) 0%, rgba(10,10,10,0.65) 45%, rgba(10,10,10,1) 82%), url(${active.poster})`,
                }
              : undefined
          }
        />
        <div className="hero-k__scanline" aria-hidden="true" />
        <Container>
          <div className="hero-k__content" key={active.id}>
            <div className="hero-k__meta">
              <span className="hero-k__label">Phim nổi bật</span>
              {active.rating != null && (
                <span className="hero-k__rating">
                  ★ {active.rating.toFixed(1)}
                </span>
              )}
              <span className="hero-k__genre">
                {active.genre} · {active.duration} PHÚT
              </span>
            </div>
            <h1 className="hero-k__title">
              <KineticHeading text={active.title} />
            </h1>
            <p className="hero-k__desc">{active.description}</p>
            <div className="hero-k__actions">
              <Button size="lg" onClick={() => navigate(`/movie/${active.id}`)}>
                ▶ Đặt vé
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate(`/movie/${active.id}`)}
              >
                Chi tiết
              </Button>
            </div>
            <div className="hero-k__tabs">
              {featured.map((m, i) => (
                <button
                  key={m.id}
                  className={
                    "hero-k__tab" + (i === heroIndex ? " is-active" : "")
                  }
                  aria-label={`Phim nổi bật ${i + 1}`}
                  onClick={() => setHeroIndex(i)}
                >
                  N°{String(i + 1).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </Container>
        <button
          className="hero-k__arrow hero-k__arrow--prev"
          aria-label="Phim trước"
          onClick={prev}
        >
          ‹
        </button>
        <button
          className="hero-k__arrow hero-k__arrow--next"
          aria-label="Phim sau"
          onClick={next}
        >
          ›
        </button>
      </section>

      {/* Marquee ticker */}
      <div className="home-ticker">
        <Marquee speed={26}>
          <span className="home-ticker__inner">
            {movies.map((m) => (
              <span key={m.id}>{m.title} ·&nbsp;</span>
            ))}
          </span>
        </Marquee>
      </div>

      <Container>
        {/* Phim đang chiếu */}
        <Section label="Suất chiếu hôm nay" index={1}>
          <div className="home-head">
            <h2 className="home-head__title">Phim đang chiếu</h2>
            <button className="home-head__all" onClick={() => navigate("/movies")}>
              Xem tất cả →
            </button>
          </div>
          <Grid min="200px">
            {movies.slice(0, 8).map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </Grid>
        </Section>

        {/* Duyệt theo thể loại */}
        <Section label="Khám phá" index={2}>
          <h2 className="home-head__title">Duyệt theo thể loại</h2>
          <div className="genre-k-grid">
            {genreStats.map(({ genre, count }) => (
              <button
                key={genre}
                className="genre-k"
                onClick={() => navigate("/movies", { state: { genre } })}
              >
                <span className="genre-k__name">{genre}</span>
                <span className="genre-k__count">{count} phim</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Thống kê */}
        <div className="stats-k">
          {[
            { n: movies.length, l: "Phim" },
            { n: cinemas.length, l: "Rạp chiếu" },
            { n: cities.length, l: "Thành phố" },
            { n: showtimeCount, l: "Suất chiếu" },
          ].map((s) => (
            <div className="stats-k__item" key={s.l}>
              <span className="stats-k__num">{s.n}</span>
              <span className="stats-k__label">{s.l}</span>
            </div>
          ))}
        </div>

        {/* Hệ thống rạp */}
        <Section label="Toàn quốc" index={3}>
          <div className="home-head">
            <h2 className="home-head__title">Hệ thống rạp</h2>
            <button
              className="home-head__all"
              onClick={() => navigate("/cinemas")}
            >
              Tất cả rạp →
            </button>
          </div>
          <div className="cinema-k-grid">
            {cinemas.map((c, i) => (
              <button
                key={c.id}
                className="cinema-k"
                onClick={() => navigate(`/cinema/${c.id}`)}
              >
                <span className="cinema-k__no">
                  N°{String(i + 1).padStart(2, "0")}
                </span>
                <span className="cinema-k__body">
                  <span className="cinema-k__name">{c.name}</span>
                  <span className="cinema-k__city">
                    {cityName[c.cityId] ?? "—"}
                  </span>
                </span>
                <span className="cinema-k__arrow">→</span>
              </button>
            ))}
          </div>
        </Section>

        {/* CTA bone */}
        <div className="cta-k u-invert">
          <div>
            <h2 className="cta-k__title">Sẵn sàng cho suất chiếu tiếp theo?</h2>
            <p className="cta-k__sub">
              Chọn phim, chọn ghế và đặt vé chỉ trong vài bước.
            </p>
          </div>
          <Button size="lg" onClick={() => navigate("/movies")}>
            Đặt vé ngay
          </Button>
        </div>
      </Container>

      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Xoá `Home.jsx`**

```bash
git rm src/pages/Home.jsx
```

- [ ] **Step 3: Viết lại `Home.css` theo token**

Thay toàn bộ `src/pages/Home.css` bằng style token-hoá cho các class mới: `.home-page`, `.hero-k` (+ `__poster/__scanline/__content/__meta/__label/__rating/__genre/__title/__desc/__actions/__tabs/__tab/__arrow`), `.home-ticker`, `.home-head` (+ `__title/__all`), `.genre-k-grid`/`.genre-k`, `.stats-k`, `.cinema-k-grid`/`.cinema-k`, `.cta-k`, `.home-error`, `.home-hero-skeleton`. Ràng buộc: chỉ dùng token; hero cao `min-height: clamp(420px, 70vh, 680px)`, poster `position:absolute; inset:0; background-size:cover; background-position:center`; scanline là lớp `repeating-linear-gradient` mờ `opacity:.06`; `.hero-k__title` font `var(--font-display)` cỡ `var(--fs-2xl)`; tab mono; mọi hover chỉ `transform`/`opacity`; **mỗi hiệu ứng có nhánh `prefers-reduced-motion`**. Mobile (`max-width:720px`): hero xếp dọc, `.stats-k` 2 cột, arrow nhỏ lại. (Dùng skill `frontend-design` để tinh chỉnh; lặp qua screenshot.)

- [ ] **Step 4: Gate + typecheck/lint/build**

Run: `npm run typecheck && npm run lint && npm run test:run && npm run build`
Expected: tất cả xanh (55 + MovieCard 2 + keys 1 = 58 test).

- [ ] **Step 5: Chụp desktop + mobile, gửi review**

Tạo `_shot_tmp.mjs` (trong project) chụp `http://localhost:3000/` ở 1440×2200 và 390×2600 (fullPage), lưu vào scratchpad, gửi người dùng. Chỉnh CSS tới khi đạt "wow" (dùng `frontend-design`). Xoá script sau khi xong.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.tsx src/pages/Home.css
git commit -m "feat(GD2b/6): redesign Home kinetic (tsx, wired Query)"
```

---

### Task 7: Mở rộng Playwright smoke + push lát 2b

**Files:**
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: trang Home mới (hero `.hero-k`, card `.movie-k`, hamburger `.nav-k__hamburger`).

- [ ] **Step 1: Thêm test smoke Home mới**

Thêm vào `e2e/smoke.spec.ts` (giữ 3 test cũ; đọc file trước để khớp cú pháp import `test`/`expect`):

```ts
test("Home hero + card phim hiển thị", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero-k")).toBeVisible();
  await expect(page.locator(".hero-k__title")).toBeVisible();
  expect(await page.locator(".movie-k").count()).toBeGreaterThan(0);
});

test("menu mobile mở được", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  const burger = page.locator(".nav-k__hamburger");
  await expect(burger).toBeVisible();
  await burger.click();
  await expect(page.locator("#nav-mobile.is-open")).toBeVisible();
});
```

- [ ] **Step 2: Chạy e2e**

Run: `npm run e2e`
Expected: 5 test xanh (3 cũ + 2 mới).

- [ ] **Step 3: Toàn bộ gate lần cuối**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`
Expected: tất cả xanh.

- [ ] **Step 4: Commit + push lát 2b**

```bash
git add e2e/smoke.spec.ts
git commit -m "test(GD2b/7): mo rong Playwright smoke Home + menu mobile"
git push origin main
```

- [ ] **Step 5: Xác minh CI xanh trên GitHub**

Run: `curl -s "https://api.github.com/repos/khanhnguyen1205/cinema-full/actions/runs?per_page=1" | grep -E '"head_sha"|"status"|"conclusion"'`
Expected: `status=completed`, `conclusion=success` cho commit push.

---

## Self-Review (đã thực hiện khi viết plan)

**Spec coverage:** §2 Query infra (provider trong ErrorBoundary/ngoài Auth, default staleTime/retry/refetchOnWindowFocus, devtools DEV, qk registry, hook Home, test keys) → Task 1–2. §3 Home redesign (loading Skeleton/error retry/empty; 6 vùng: hero carousel + reduced-motion tắt autoplay + tab N°, marquee, đang chiếu, thể loại, thống kê, rạp, CTA bone) → Task 6. §4 MovieCard → Task 3. §5 Navbar (giữ `back` + logic, menu mobile ARIA) + Footer → Task 4–5. §6 chất lượng (6 gate, reduced-motion, responsive, a11y, Playwright smoke, screenshot) → rải khắp + Task 7. §7 chẻ lát 2b-1/2b-2/2b-3 → Task 1–2 / 3–5 / 6–7.

**Placeholder scan:** không TBD/TODO. Task 6 Step 3 (CSS) mô tả class + ràng buộc token + reduced-motion cụ thể thay vì liệt kê từng dòng — có chủ đích vì đây là phần craft trực quan lặp qua screenshot (skill frontend-design), không thể prescribe cứng; JSX + wiring Query (phần logic) có code đầy đủ.

**Type consistency:** `qk.*` (Task 1) dùng trong `catalog.ts` (Task 2); hook `useMovies/useCinemas/useCities/useAllShowtimes` (Task 2) dùng ở Home (Task 6); `MovieCard {movie: Movie}` (Task 3) dùng ở Home (Task 6); `Navbar {back?: string}` (Task 4) giữ hợp đồng cũ; class `.hero-k`/`.movie-k`/`.nav-k__hamburger`/`#nav-mobile` (Task 4/6) khớp selector e2e (Task 7).

**Ghi chú thứ tự:** Task 1 (keys) trước Task 2 (catalog dùng qk). Task 2 (provider) trước Task 6 (Home dùng hook). Task 3 (MovieCard) trước Task 6. Task 4–5 (shell) trước Task 6 (Home render Navbar/Footer mới). Task 6 trước Task 7 (e2e nhắm class Home mới).
