# GĐ2c — Redesign Movies + MovieDetail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng lại hai trang Movies + MovieDetail theo ngôn ngữ Kinetic Cinematic, wire TanStack Query, convert sang TSX, tái dùng `MovieCard` — giữ nguyên toàn bộ logic lọc & phễu đặt vé.

**Architecture:** Thêm hook Query có tham số vào `queries/catalog.ts` + key vào `queries/keys.ts`. Viết lại `Movies.jsx`→`Movies.tsx` (dải điều khiển ngang kinetic + lưới `MovieCard`) và `MovieDetail.jsx`→`MovieDetail.tsx` (hero chia đôi + panel vé "bone" sticky + 3 khu CHI TIẾT). CSS viết lại kinetic, xoá class cũ. Verify từng lát bằng 6 gate CI + Playwright smoke + screenshot.

**Tech Stack:** React 18, TypeScript 5.7, @tanstack/react-query v5, Vite 6, Vitest 3 (happy-dom), Playwright, plain CSS (design tokens ở `styles/tokens.css`, primitive ở `components/ui`).

## Global Constraints

- **0 warning ESLint** — `lint` chỉ exit≠0 khi có ERROR; luôn đọc output, xử react-refresh warning bằng disable có chú thích nếu cần.
- **6 gate xanh mỗi commit:** `npm run typecheck` · `npm run lint` · `npm run format:check` · `npm run test:run` · `npm run e2e` · `npm run build`.
- **Absolute imports** từ `src` root (`components/...`, `queries/...`, `services/api`, `types`); sibling cùng thư mục dùng `./`.
- **Không thêm dependency mới** ở GĐ2c.
- **Không rơi rớt logic:** bộ lọc Movies (search/genre/city/date/sort + nhận `location.state.genre`) và phễu MovieDetail (city→cinema→date→time→book, các default khi đổi cấp trên) phải giữ hành vi y hệt bản `.jsx` hiện tại.
- **Dữ liệu phim chỉ có:** `id, title, poster?, description?, duration, genre, rating?` — không bịa thêm trường.
- **Reduced-motion + a11y:** chỉ animate `transform`/`opacity`; `<button>` thật cho chip/nút; `<select>` có `aria-label`.
- **Copy tiếng Việt.** Giá VND `toLocaleString("vi-VN")` + `₫`.
- **Commit thẳng `main`.** Không add `CLAUDE.md`/`README.md` (đang có sửa tài liệu chưa commit).
- Cuối mỗi commit body:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

**Chữ ký `services/api` sẵn có (dùng nguyên, không sửa):**
- `getMovies(): Promise<Movie[]>`
- `getMovie(id: Id): Promise<Movie>`
- `getShowtimes(movieId: Id): Promise<Showtime[]>`
- `getAllShowtimes(): Promise<Showtime[]>`
- `getRooms(cinemaId?: Id): Promise<Room[]>`
- `getCinemas(cityId?: Id): Promise<Cinema[]>`
- `getCities(): Promise<City[]>`
(`Id = number | string`)

**Types (`types`):** `Movie{id,title,poster?,description?,duration,genre,rating?}`, `Room{id,cinemaId,name,type:"2D"|"3D"|"IMAX",...}`, `Showtime{id,movieId,roomId,time,price,bookedSeats?}`, `Cinema{id,cityId,name,address?}`, `City{id,name}`.

**Primitive UI sẵn có (`components/ui`):** `Button`(props `size?, variant?`), `Tag`, `Badge`, `Card`, `Rule`, `Field`(`label?,htmlFor?`), `Skeleton`(`height?`), `Spinner`, `IconButton`, `Numbered`, `KineticHeading`(`text`), `Marquee`(`speed?`), `Reveal`, `TicketEdge`, `Modal`, `Container`, `Section`(`label?,index?`), `Grid`(`min?`). `MovieCard` (`components/MovieCard`, props `{movie}`, render `.movie-k`).

---

### Task 1: Query infra — rooms + movie(id) + showtimesByMovie(id)

**Files:**
- Modify: `src/queries/keys.ts`
- Modify: `src/queries/catalog.ts`
- Test: `src/queries/keys.test.ts`

**Interfaces:**
- Consumes: `getRooms`, `getMovie`, `getShowtimes` từ `services/api`; `useQuery` từ `@tanstack/react-query`.
- Produces:
  - `qk.rooms: readonly ["rooms"]`
  - `qk.movie(id: number | string): readonly ["movie", number | string]`
  - `qk.showtimesByMovie(id: number | string): readonly ["showtimes", "byMovie", number | string]`
  - `useRooms(): UseQueryResult<Room[]>`
  - `useMovie(id: number | string): UseQueryResult<Movie>`
  - `useShowtimesByMovie(id: number | string): UseQueryResult<Showtime[]>`

- [ ] **Step 1: Write the failing test** — mở rộng `src/queries/keys.test.ts`, thêm vào trong `describe`:

```ts
it("khai báo key cho rooms và key có tham số của Detail", () => {
  expect(qk.rooms).toEqual(["rooms"]);
  expect(qk.movie(7)).toEqual(["movie", 7]);
  expect(qk.showtimesByMovie(7)).toEqual(["showtimes", "byMovie", 7]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/queries/keys.test.ts`
Expected: FAIL — `qk.rooms`/`qk.movie is not a function`.

- [ ] **Step 3: Add keys** — trong `src/queries/keys.ts`, thêm vào object `qk` (giữ các key cũ):

```ts
export const qk = {
  movies: ["movies"] as const,
  cinemas: ["cinemas"] as const,
  cities: ["cities"] as const,
  showtimes: ["showtimes"] as const,
  rooms: ["rooms"] as const,
  movie: (id: number | string) => ["movie", id] as const,
  showtimesByMovie: (id: number | string) =>
    ["showtimes", "byMovie", id] as const,
};
```

- [ ] **Step 4: Add hooks** — trong `src/queries/catalog.ts`, thêm import `getRooms, getMovie, getShowtimes` vào khối import từ `services/api`, rồi thêm hook:

```ts
export const useRooms = () =>
  useQuery({ queryKey: qk.rooms, queryFn: () => getRooms() });

export const useMovie = (id: number | string) =>
  useQuery({ queryKey: qk.movie(id), queryFn: () => getMovie(id) });

export const useShowtimesByMovie = (id: number | string) =>
  useQuery({
    queryKey: qk.showtimesByMovie(id),
    queryFn: () => getShowtimes(id),
  });
```

- [ ] **Step 5: Run test + gates**

Run: `npm run test:run -- src/queries/keys.test.ts` → Expected: PASS.
Run: `npm run typecheck` → Expected: 0 lỗi.
Run: `npm run lint` → Expected: 0 warning/error.

- [ ] **Step 6: Commit**

```bash
git add src/queries/keys.ts src/queries/catalog.ts src/queries/keys.test.ts
git commit -m "$(cat <<'EOF'
feat(GD2c/1): query infra rooms + movie(id) + showtimesByMovie(id)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Movies.tsx — dải điều khiển ngang kinetic + lưới MovieCard

**Files:**
- Create: `src/pages/Movies.tsx`
- Delete: `src/pages/Movies.jsx`
- Rewrite: `src/pages/Movies.css`
- Modify: `e2e/smoke.spec.ts:33-40` (đổi `.movie-card` → `.movie-k`, thêm kiểm lọc chip)

**Interfaces:**
- Consumes: `useMovies, useAllShowtimes, useRooms, useCinemas, useCities` (Task 1 + sẵn có); `MovieCard`; `Container, Grid, KineticHeading, Skeleton, Button` từ `components/ui`; `useNavigate, useLocation`.
- Produces: default export `Movies` (route `/movies`). Lưới render `MovieCard` (class `.movie-k`). Container root class `.movies-page`, header có `<h1>` chứa "Tất cả phim".

**Ghi chú port logic:** bê nguyên `GENRE`/`SORTS`/state lọc & memo từ `Movies.jsx` hiện tại (`genres`, `cityIds`, `dateKeys`, `movieIdsByShowtime`, `visible`, `fmtDate`), chỉ đổi 5 `useState+useEffect` nguồn dữ liệu sang hook Query và bọc `useMemo` mảng phái sinh cho `exhaustive-deps`.

- [ ] **Step 1: Viết `src/pages/Movies.tsx`** với nội dung đầy đủ:

```tsx
import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import MovieCard from "components/MovieCard";
import {
  Container,
  Grid,
  KineticHeading,
  Skeleton,
  Button,
} from "components/ui";
import {
  useMovies,
  useAllShowtimes,
  useRooms,
  useCinemas,
  useCities,
} from "queries/catalog";
import "./Movies.css";

const SORTS = [
  { value: "name-asc", label: "Tên A→Z" },
  { value: "name-desc", label: "Tên Z→A" },
  { value: "dur-asc", label: "Thời lượng ↑" },
  { value: "dur-desc", label: "Thời lượng ↓" },
];

export default function Movies() {
  const navigate = useNavigate();
  const location = useLocation();

  const moviesQ = useMovies();
  const showtimesQ = useAllShowtimes();
  const roomsQ = useRooms();
  const cinemasQ = useCinemas();
  const citiesQ = useCities();

  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);

  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<string>(
    (location.state as { genre?: string } | null)?.genre || "Tất cả",
  );
  const [sort, setSort] = useState("name-asc");
  const [city, setCity] = useState("Tất cả"); // cityId dạng chuỗi hoặc "Tất cả"
  const [date, setDate] = useState("Tất cả"); // dateKey yyyy-mm-dd hoặc "Tất cả"

  // { movieId, cityId, dateKey } cho mỗi suất — suy từ rooms/cinemas
  const rows = useMemo(() => {
    const roomCinema = Object.fromEntries(rooms.map((r) => [r.id, r.cinemaId]));
    const cinemaCity = Object.fromEntries(cinemas.map((c) => [c.id, c.cityId]));
    return showtimes.map((s) => ({
      movieId: s.movieId,
      cityId: cinemaCity[roomCinema[s.roomId]],
      dateKey: s.time.slice(0, 10),
    }));
  }, [showtimes, rooms, cinemas]);

  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );

  const genres = useMemo(
    () => ["Tất cả", ...Array.from(new Set(movies.map((m) => m.genre)))],
    [movies],
  );

  const cityIds = useMemo(
    () => [...new Set(rows.map((r) => r.cityId).filter(Boolean))],
    [rows],
  );

  const dateKeys = useMemo(() => {
    const relevant =
      city === "Tất cả" ? rows : rows.filter((r) => String(r.cityId) === city);
    return [...new Set(relevant.map((r) => r.dateKey))].sort();
  }, [rows, city]);

  const movieIdsByShowtime = useMemo(() => {
    if (city === "Tất cả" && date === "Tất cả") return null;
    const ids = new Set<number>();
    rows.forEach((r) => {
      if (city !== "Tất cả" && String(r.cityId) !== city) return;
      if (date !== "Tất cả" && r.dateKey !== date) return;
      ids.add(r.movieId);
    });
    return ids;
  }, [rows, city, date]);

  const fmtDate = (k: string) =>
    new Date(k).toLocaleDateString("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

  const visible = useMemo(() => {
    let list = movies;
    if (movieIdsByShowtime)
      list = list.filter((m) => movieIdsByShowtime.has(m.id));
    if (genre !== "Tất cả") list = list.filter((m) => m.genre === genre);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((m) => m.title.toLowerCase().includes(q));
    const sorted = [...list];
    switch (sort) {
      case "name-desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "dur-asc":
        sorted.sort((a, b) => a.duration - b.duration);
        break;
      case "dur-desc":
        sorted.sort((a, b) => b.duration - a.duration);
        break;
      default:
        sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    return sorted;
  }, [movies, genre, search, sort, movieIdsByShowtime]);

  const isLoading = moviesQ.isLoading;
  const isError = moviesQ.isError;

  return (
    <div className="page movies-page">
      <Navbar />

      <Container>
        <header className="movies-k__header">
          <span className="movies-k__label">Danh mục phim</span>
          <h1 className="movies-k__title">
            <KineticHeading text="Tất cả phim" />
          </h1>
          {!isLoading && !isError && (
            <span className="movies-k__count">
              <b>{visible.length}</b> phim
            </span>
          )}
        </header>

        {/* THANH ĐIỀU KHIỂN — khối viền cứng */}
        <div className="movies-k__controls">
          <div className="movies-k__search">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Tìm phim theo tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Tìm phim theo tên"
            />
          </div>

          <div className="movies-k__selects">
            <select
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setDate("Tất cả");
              }}
              aria-label="Lọc theo thành phố"
            >
              <option value="Tất cả">Tất cả thành phố</option>
              {cityIds.map((cid) => (
                <option key={cid} value={String(cid)}>
                  {cityName[cid]}
                </option>
              ))}
            </select>
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Lọc theo ngày"
            >
              <option value="Tất cả">Tất cả ngày</option>
              {dateKeys.map((dk) => (
                <option key={dk} value={dk}>
                  {fmtDate(dk)}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sắp xếp"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="movies-k__genres" role="group" aria-label="Thể loại">
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                className={"genre-k-chip" + (genre === g ? " is-active" : "")}
                aria-pressed={genre === g}
                onClick={() => setGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* KẾT QUẢ */}
        {isError ? (
          <div className="movies-k__empty">
            <p>Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.</p>
            <Button onClick={() => moviesQ.refetch()}>Thử lại</Button>
          </div>
        ) : isLoading ? (
          <Grid min="200px">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height="320px" />
            ))}
          </Grid>
        ) : visible.length === 0 ? (
          <div className="movies-k__empty">
            <p className="movies-k__empty-title">Không tìm thấy phim nào</p>
            <p className="movies-k__empty-sub">Thử đổi từ khóa hoặc bộ lọc khác.</p>
          </div>
        ) : (
          <Grid min="200px">
            {visible.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </Grid>
        )}
      </Container>

      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Xoá file cũ**

Run: `git rm src/pages/Movies.jsx`

- [ ] **Step 3: Viết lại `src/pages/Movies.css`** — kinetic. Định nghĩa các class dùng ở trên; giữ plain CSS + token. Yêu cầu/hành vi bắt buộc (polish pixel trong lúc chạy bằng screenshot):
  - `.movies-k__header`: padding trên, `.movies-k__label` = nhãn mono chữ hoa nhỏ giãn chữ (font Space Mono, `letter-spacing`, `color: var(--text-muted)`); `.movies-k__title` chứa KineticHeading cỡ lớn; `.movies-k__count b` số đỏ (`color: var(--red)`).
  - `.movies-k__controls`: khối `border: 1px solid var(--border)` (hoặc token tương ứng), padding, `display:flex; flex-direction:column; gap`. Bên trong: `.movies-k__search` (viền, icon + input nền trong suốt, không outline mặc định), `.movies-k__selects` (flex wrap, các `select` mono, mũi tên tuỳ biến giống MovieDetail cũ nếu muốn), `.movies-k__genres` (flex wrap).
  - `.genre-k-chip`: nút vuông viền cứng, nền trong; `:hover` dịch nhẹ; `.is-active` = **đảo màu bone** (`background: var(--surface-invert)`, `color:` nền tối) — dùng token bone như CTA Home (`.u-invert`).
  - `.movies-k__empty`: canh giữa, text muted; `.movies-k__empty-title` lớn.
  - Responsive: ≤640px `.movies-k__selects` mỗi select full-width (`flex: 1 1 100%` hoặc grid 1 cột); chip xuống hàng gọn.
  - **Không còn** class `.movie-card*`, `.movie-grid`, `.movies-section`, `.movies-header`, `.movies-controls`, `.movies-search`, `.genre-chip`, `.movies-sort*`, `.movies-count`, `.movies-empty*` cũ.

- [ ] **Step 4: Cập nhật Playwright smoke** — sửa test `/movies` trong `e2e/smoke.spec.ts` (đang ở dòng ~33-40) thành:

```ts
test("trang phim hiển thị tiêu đề, danh sách và lọc theo thể loại", async ({
  page,
}) => {
  await page.goto("/movies");
  await expect(
    page.getByRole("heading", { name: "Tất cả phim" }),
  ).toBeVisible();
  // Lưới dựng từ MovieCard -> có ít nhất một thẻ .movie-k
  await expect(page.locator(".movie-k").first()).toBeVisible();
  // Bấm một chip thể loại (không phải "Tất cả") -> lưới vẫn còn thẻ
  const chip = page.locator(".genre-k-chip", { hasNotText: "Tất cả" }).first();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".movie-k").first()).toBeVisible();
});
```

- [ ] **Step 5: Chạy gate**

Run: `npm run typecheck` → 0 lỗi.
Run: `npm run lint` → 0 warning (nếu react-refresh cảnh báo do export cạnh component, xử bằng disable có chú thích).
Run: `npm run format:check` → clean (nếu fail: `npm run format`).
Run: `npm run test:run` → PASS.
Run: `npm run build` → OK.
Run: `npm run e2e -- --grep "trang phim"` → PASS.

- [ ] **Step 6: Verify screenshot** desktop (1280px) + mobile (390px) headless Chrome (script `.mjs` trong project, import `chromium` từ `@playwright/test`, `--virtual-time-budget=5000`; xoá script trước `format:check` hoặc để `.prettierignore` bỏ qua). Kiểm: header lớn, thanh điều khiển khối, chip active đảo màu, lưới `MovieCard` đều, mobile không tràn ngang.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Movies.tsx src/pages/Movies.css e2e/smoke.spec.ts
git commit -m "$(cat <<'EOF'
feat(GD2c/2): redesign Movies kinetic (tsx, wired Query, MovieCard)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: MovieDetail.tsx — hero chia đôi + panel vé bone sticky + CHI TIẾT

**Files:**
- Create: `src/pages/MovieDetail.tsx`
- Delete: `src/pages/MovieDetail.jsx`
- Rewrite: `src/pages/MovieDetail.css`

**Interfaces:**
- Consumes: `useMovie(id), useShowtimesByMovie(id), useRooms, useCinemas, useCities` (Task 1 + sẵn có); `useMovies` (dải phim cùng thể loại); `MovieCard`; `Container, Section, KineticHeading, TicketEdge, Field, Reveal, Spinner, Button` từ `components/ui`; `useParams, useNavigate`.
- Produces: default export `MovieDetail` (route `/movie/:id`). Root `.detail-page`; panel đặt vé class `.book-k` chứa các nút giờ `.time-k-btn` và nút "Đặt vé".

**Ghi chú port logic:** bê nguyên `enriched` (showtimes + room + cinema + cityId + dateKey), `firstCinemaOf/firstDateOf/cinemaName`, khởi tạo default (c0/cin0/d0), `cityIds/cinemaIds/dateKeys/times`, `fmtTime/fmtDate`, handler đổi TP/rạp/ngày/giờ. Đổi nguồn sang Query; init default trong `useEffect` chạy khi `enriched` đổi.

- [ ] **Step 1: Viết `src/pages/MovieDetail.tsx`**:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import MovieCard from "components/MovieCard";
import {
  Container,
  Section,
  KineticHeading,
  TicketEdge,
  Field,
  Reveal,
  Spinner,
  Button,
} from "components/ui";
import {
  useMovie,
  useShowtimesByMovie,
  useRooms,
  useCinemas,
  useCities,
  useMovies,
} from "queries/catalog";
import "./MovieDetail.css";

export default function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const movieId = id!;

  const movieQ = useMovie(movieId);
  const showtimesQ = useShowtimesByMovie(movieId);
  const roomsQ = useRooms();
  const cinemasQ = useCinemas();
  const citiesQ = useCities();
  const allMoviesQ = useMovies();

  const movie = movieQ.data;
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);
  const allMovies = useMemo(() => allMoviesQ.data ?? [], [allMoviesQ.data]);

  const cityMap = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c])),
    [cities],
  );

  // enriched: showtime + room + cinema + cityId + dateKey
  const enriched = useMemo(() => {
    const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
    const cinemaMap = Object.fromEntries(cinemas.map((c) => [c.id, c]));
    return showtimes.map((s) => {
      const room = roomMap[s.roomId];
      const cinema = room ? cinemaMap[room.cinemaId] : undefined;
      return {
        ...s,
        room,
        cinema,
        cityId: cinema?.cityId,
        dateKey: s.time.slice(0, 10),
      };
    });
  }, [showtimes, rooms, cinemas]);

  const [cityId, setCityId] = useState<number | null>(null);
  const [cinemaId, setCinemaId] = useState<number | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [selectedShowtime, setSelectedShowtime] = useState<number | null>(null);

  const firstCinemaOf = (c: number) =>
    [...new Set(enriched.filter((e) => e.cityId === c).map((e) => e.cinema?.id))].filter(
      Boolean,
    )[0] as number | undefined;
  const firstDateOf = (c: number, cin: number) =>
    [
      ...new Set(
        enriched
          .filter((e) => e.cityId === c && e.cinema?.id === cin)
          .map((e) => e.dateKey),
      ),
    ].sort()[0];
  const cinemaName = (cid: number) =>
    enriched.find((e) => e.cinema?.id === cid)?.cinema?.name || "";

  // Khởi tạo default khi enriched sẵn sàng và chưa chọn gì
  useEffect(() => {
    if (!enriched.length || cityId !== null) return;
    const c0 = [...new Set(enriched.map((e) => e.cityId))].filter(
      Boolean,
    )[0] as number | undefined;
    if (c0 === undefined) return;
    const cin0 = firstCinemaOf(c0);
    const d0 = cin0 !== undefined ? firstDateOf(c0, cin0) : undefined;
    setCityId(c0);
    setCinemaId(cin0 ?? null);
    setDateKey(d0 ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtDate = (k: string) =>
    new Date(k).toLocaleDateString("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

  const cityIds = useMemo(
    () => [...new Set(enriched.map((e) => e.cityId))].filter(Boolean) as number[],
    [enriched],
  );
  const cinemaIds = useMemo(
    () =>
      [
        ...new Set(
          enriched.filter((e) => e.cityId === cityId).map((e) => e.cinema?.id),
        ),
      ].filter(Boolean) as number[],
    [enriched, cityId],
  );
  const dateKeys = useMemo(
    () =>
      [
        ...new Set(
          enriched
            .filter((e) => e.cityId === cityId && e.cinema?.id === cinemaId)
            .map((e) => e.dateKey),
        ),
      ].sort(),
    [enriched, cityId, cinemaId],
  );
  const times = useMemo(
    () =>
      enriched
        .filter(
          (e) =>
            e.cityId === cityId &&
            e.cinema?.id === cinemaId &&
            e.dateKey === dateKey,
        )
        .sort((a, b) => a.time.localeCompare(b.time)),
    [enriched, cityId, cinemaId, dateKey],
  );

  // Rạp có suất cho phim (khu N°02)
  const cinemasShowing = useMemo(() => {
    const seen = new Map<number, { id: number; name: string; city?: string }>();
    enriched.forEach((e) => {
      if (e.cinema && !seen.has(e.cinema.id))
        seen.set(e.cinema.id, {
          id: e.cinema.id,
          name: e.cinema.name,
          city: cityMap[e.cinema.cityId]?.name,
        });
    });
    return [...seen.values()];
  }, [enriched, cityMap]);

  // Định dạng phòng có suất (2D/3D/IMAX) — khu thông số
  const formats = useMemo(
    () => [...new Set(enriched.map((e) => e.room?.type).filter(Boolean))] as string[],
    [enriched],
  );

  // Phim cùng thể loại (khu N°03)
  const related = useMemo(
    () =>
      movie
        ? allMovies
            .filter((m) => m.genre === movie.genre && m.id !== movie.id)
            .slice(0, 8)
        : [],
    [allMovies, movie],
  );

  if (movieQ.isLoading || !movie) {
    return (
      <div className="page detail-page detail-page--center">
        <Navbar back="/" />
        <Spinner />
        <Footer />
      </div>
    );
  }

  return (
    <div className="page detail-page">
      <Navbar back="/" />

      {/* HERO chia đôi */}
      <section className="detail-k__hero">
        <div
          className="detail-k__poster"
          style={
            movie.poster
              ? {
                  backgroundImage: `linear-gradient(to right, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.72) 55%, rgba(10,10,10,0.4) 100%), url(${movie.poster})`,
                }
              : undefined
          }
          aria-hidden="true"
        />
        <div className="detail-k__scanline" aria-hidden="true" />
        <Container>
          <div className="detail-k__grid">
            <div className="detail-k__info">
              <div className="detail-k__meta">
                <span className="detail-k__tag">Đang chiếu</span>
                {movie.rating != null && (
                  <span className="detail-k__rating">
                    ★ {movie.rating.toFixed(1)}
                  </span>
                )}
                <span className="detail-k__genre">
                  {movie.genre} · {movie.duration} PHÚT
                </span>
              </div>
              <h1 className="detail-k__title">
                <KineticHeading text={movie.title} />
              </h1>
              {movie.description && (
                <p className="detail-k__desc">{movie.description}</p>
              )}
            </div>

            {/* PANEL ĐẶT VÉ — bone, sticky */}
            <aside className="detail-k__book">
              <TicketEdge className="book-k">
                <div className="book-k__head">Đặt vé</div>
                {enriched.length === 0 ? (
                  <p className="book-k__empty">Chưa có suất chiếu</p>
                ) : (
                  <>
                    <div className="book-k__selects">
                      <Field label="Thành phố" htmlFor="sel-city">
                        <select
                          id="sel-city"
                          value={cityId ?? ""}
                          onChange={(e) => {
                            const c = Number(e.target.value);
                            const cin = firstCinemaOf(c);
                            const d = cin !== undefined ? firstDateOf(c, cin) : undefined;
                            setCityId(c);
                            setCinemaId(cin ?? null);
                            setDateKey(d ?? null);
                            setSelectedShowtime(null);
                          }}
                          aria-label="Chọn thành phố"
                        >
                          {cityIds.map((cid) => (
                            <option key={cid} value={cid}>
                              {cityMap[cid]?.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Rạp" htmlFor="sel-cinema">
                        <select
                          id="sel-cinema"
                          value={cinemaId ?? ""}
                          onChange={(e) => {
                            const cin = Number(e.target.value);
                            const d = cityId !== null ? firstDateOf(cityId, cin) : undefined;
                            setCinemaId(cin);
                            setDateKey(d ?? null);
                            setSelectedShowtime(null);
                          }}
                          aria-label="Chọn rạp"
                        >
                          {cinemaIds.map((cid) => (
                            <option key={cid} value={cid}>
                              {cinemaName(cid)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="book-k__dates">
                      {dateKeys.map((dk) => (
                        <button
                          key={dk}
                          type="button"
                          className={"date-k-btn" + (dateKey === dk ? " is-active" : "")}
                          onClick={() => {
                            setDateKey(dk);
                            setSelectedShowtime(null);
                          }}
                        >
                          {fmtDate(dk)}
                        </button>
                      ))}
                    </div>

                    <div className="book-k__times-label">Giờ chiếu</div>
                    <div className="book-k__times">
                      {times.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          className={
                            "time-k-btn" +
                            (selectedShowtime === e.id ? " is-active" : "")
                          }
                          onClick={() => setSelectedShowtime(e.id)}
                        >
                          <span className="time-k-btn__t">{fmtTime(e.time)}</span>
                          <span className="time-k-btn__meta">
                            {e.room?.type} · {e.price.toLocaleString("vi-VN")}₫
                          </span>
                        </button>
                      ))}
                    </div>

                    <Button
                      className="book-k__cta"
                      disabled={!selectedShowtime}
                      onClick={() =>
                        selectedShowtime && navigate(`/seats/${selectedShowtime}`)
                      }
                    >
                      Đặt vé
                    </Button>
                  </>
                )}
              </TicketEdge>
            </aside>
          </div>
        </Container>
      </section>

      {/* CHI TIẾT */}
      <Container>
        {/* N°01 — Tóm tắt + thông số */}
        <Reveal>
          <Section label="Tóm tắt" index={1}>
            <div className="detail-k__about">
              <p className="detail-k__synopsis">
                {movie.description || "Chưa có mô tả cho phim này."}
              </p>
              <div className="spec-k">
                {movie.rating != null && (
                  <div className="spec-k__item">
                    <span className="spec-k__num">{movie.rating.toFixed(1)}</span>
                    <span className="spec-k__label">Điểm</span>
                  </div>
                )}
                <div className="spec-k__item">
                  <span className="spec-k__val">{movie.genre}</span>
                  <span className="spec-k__label">Thể loại</span>
                </div>
                <div className="spec-k__item">
                  <span className="spec-k__val">{movie.duration}′</span>
                  <span className="spec-k__label">Thời lượng</span>
                </div>
                {formats.length > 0 && (
                  <div className="spec-k__item">
                    <span className="spec-k__val">{formats.join(" · ")}</span>
                    <span className="spec-k__label">Định dạng</span>
                  </div>
                )}
              </div>
            </div>
          </Section>
        </Reveal>

        {/* N°02 — Rạp đang chiếu */}
        {cinemasShowing.length > 0 && (
          <Reveal>
            <Section label="Đang chiếu tại" index={2}>
              <div className="detail-k__cinemas">
                {cinemasShowing.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className="cinema-k"
                    onClick={() => navigate(`/cinema/${c.id}`)}
                  >
                    <span className="cinema-k__no">
                      N°{String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="cinema-k__body">
                      <span className="cinema-k__name">{c.name}</span>
                      <span className="cinema-k__city">{c.city ?? "—"}</span>
                    </span>
                    <span className="cinema-k__arrow">→</span>
                  </button>
                ))}
              </div>
            </Section>
          </Reveal>
        )}

        {/* N°03 — Phim cùng thể loại */}
        {related.length > 0 && (
          <Reveal>
            <Section label="Cùng thể loại" index={3}>
              <div className="detail-k__related">
                {related.map((m) => (
                  <MovieCard key={m.id} movie={m} />
                ))}
              </div>
            </Section>
          </Reveal>
        )}
      </Container>

      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Xoá file cũ**

Run: `git rm src/pages/MovieDetail.jsx`

- [ ] **Step 3: Viết lại `src/pages/MovieDetail.css`** — kinetic. Class + hành vi bắt buộc (polish pixel bằng screenshot):
  - `.detail-page--center`: flex center cho trạng thái loading (thay style inline cũ).
  - `.detail-k__hero`: `position: relative; overflow: hidden`; `.detail-k__poster` = `position:absolute; inset:0; background-size:cover; background-position:center`; `.detail-k__scanline` overlay mờ (mô-típ scanline như Home hero, chỉ `opacity`/`transform`).
  - `.detail-k__grid`: desktop `display:grid; grid-template-columns: 1fr minmax(300px, 380px); gap; align-items:start`; mobile 1 cột.
  - `.detail-k__info`: `.detail-k__meta` hàng badge (tag "Đang chiếu", `.detail-k__rating` đỏ, `.detail-k__genre` mono); `.detail-k__title` KineticHeading lớn; `.detail-k__desc` giới hạn dòng (`max-width`, `color:var(--text-muted)`).
  - `.detail-k__book`: desktop `position: sticky; top: <chiều cao navbar + khoảng>`; mobile `position: static`. `.book-k` (bên trong TicketEdge, nền bone `var(--surface-invert)`, chữ tối) — `.book-k__head` tiêu đề font display; `.book-k__selects` xếp dọc gap; `.book-k__dates`/`.book-k__times` flex/grid nút; `.date-k-btn`/`.time-k-btn` nút khối viền, `.is-active` = đỏ (nền `var(--red)` chữ trắng) hoặc đảo — chọn tương phản đọc tốt trên nền bone; `.book-k__cta` full-width; `.book-k__empty` text muted.
  - `.detail-k__about`: grid 2 cột (synopsis | spec) desktop, 1 cột mobile. `.spec-k` grid các item; `.spec-k__num` số đỏ khổng lồ (font display, `var(--red)`); `.spec-k__val` chữ hoa; `.spec-k__label` mono muted.
  - `.detail-k__cinemas`: grid các `.cinema-k` — **tái dùng style `.cinema-k*`** đã có ở `Home.css`; nếu chưa global thì copy rule vào đây (giữ khớp diện mạo Home).
  - `.detail-k__related`: `display:grid; grid-template-columns: repeat(auto-fill, minmax(180px,1fr)); gap` (hoặc dùng `<Grid>` — nhưng ở đây dùng div để strip gọn).
  - Responsive ≤900px: `.detail-k__grid` và `.detail-k__about` về 1 cột; panel về luồng thường (bỏ sticky); poster gradient đậm hơn để chữ đọc rõ.
  - **Không còn** class cũ: `.detail-hero*`, `.showtimes-panel*`, `.detail-select*`, `.date-selector`, `.date-btn`, `.times-*`, `.time-btn`, `.time-type`, `.book-btn`, `.detail-title`, `.detail-description`, `.detail-credits`, `.credit-*`, `.detail-meta-top`, `.detail-rating`, `.detail-genre-badge`.

  > **Kiểm class `.cinema-k`:** nếu `.cinema-k*` chỉ nằm trong `Home.css` (không import ở Detail), copy các rule cần thiết vào `MovieDetail.css` để không phụ thuộc import chéo. Xác minh bằng grep `\.cinema-k` trong `src/pages/Home.css`.

- [ ] **Step 4: Chạy gate**

Run: `npm run typecheck` → 0 lỗi (chú ý union `undefined`/`null` ở cinema optional — code trên đã guard `e.cinema?.id`).
Run: `npm run lint` → 0 warning.
Run: `npm run format:check` → clean.
Run: `npm run test:run` → PASS.
Run: `npm run build` → OK.

- [ ] **Step 5: Verify screenshot** desktop + mobile: hero chia đôi, panel bone dính khi cuộn (desktop), 3 khu CHI TIẾT hiện (thông số số đỏ, rạp N°, phim cùng thể loại), phễu chọn TP→rạp→ngày→giờ→Đặt vé hoạt động (bấm giờ → nút bật). Mobile: xếp dọc, không tràn ngang.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MovieDetail.tsx src/pages/MovieDetail.css
git commit -m "$(cat <<'EOF'
feat(GD2c/3): redesign MovieDetail kinetic (hero + panel bone sticky + chi tiet)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Playwright smoke MovieDetail + verify toàn bộ + push

**Files:**
- Modify: `e2e/smoke.spec.ts` (thêm test MovieDetail)

**Interfaces:**
- Consumes: các trang từ Task 2 & 3 đang chạy qua `npm run dev`.
- Produces: 1 test smoke mới cho `/movie/:id`.

- [ ] **Step 1: Thêm test MovieDetail** vào cuối `e2e/smoke.spec.ts`:

```ts
test("trang chi tiết phim: hero, panel đặt vé và giờ chiếu", async ({
  page,
}) => {
  // Vào từ trang phim để lấy một phim thật (không hardcode id)
  await page.goto("/movies");
  await page.locator(".movie-k").first().click();
  await expect(page).toHaveURL(/\/movie\/\d+/);
  // Panel đặt vé hiển thị
  await expect(page.locator(".book-k")).toBeVisible();
  // Có ít nhất một nút giờ chiếu -> bấm -> nút Đặt vé bật (không disabled)
  const timeBtn = page.locator(".time-k-btn").first();
  await expect(timeBtn).toBeVisible();
  await timeBtn.click();
  await expect(page.locator(".book-k__cta")).toBeEnabled();
});
```

- [ ] **Step 2: Chạy toàn bộ gate**

Run: `npm run typecheck` → 0 lỗi.
Run: `npm run lint` → 0 warning.
Run: `npm run format:check` → clean.
Run: `npm run test:run` → PASS (28+ unit, gồm key mới).
Run: `npm run build` → OK.
Run: `npm run e2e` → tất cả smoke PASS (gồm 2 test mới).

> Nếu test MovieDetail phụ thuộc phim đầu tiên không có suất chiếu (không có `.time-k-btn`), đổi bước 1 để chọn phim có suất, hoặc nới assertion (`.book-k` visible là đủ; chỉ bấm giờ nếu tồn tại). Ưu tiên test ổn định: nếu dữ liệu seed có suất cho mọi phim thì giữ nguyên.

- [ ] **Step 3: Commit + push**

```bash
git add e2e/smoke.spec.ts
git commit -m "$(cat <<'EOF'
test(GD2c/4): mo rong Playwright smoke MovieDetail

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 4: Verify CI xanh** qua GitHub API (không có `gh` CLI):
`https://api.github.com/repos/khanhnguyen1205/cinema-full/actions/runs` — chờ run mới nhất `conclusion: success`.

---

## Self-Review

**Spec coverage:**
- §2 Query infra → Task 1 ✅
- §3 Movies redesign (header/controls/chip đảo màu/grid/loading-error-empty/xoá card cũ) → Task 2 ✅
- §4 MovieDetail (hero chia đôi, panel bone sticky, N°01 thông số, N°02 rạp, N°03 cùng thể loại, giữ phễu) → Task 3 ✅
- §5 chuyển động/a11y (Reveal, reduced-motion, button thật, aria-label) → Task 2 & 3 ✅
- §6 test (unit key + Playwright smoke Movies & Detail + screenshot) → Task 1/2/4 ✅
- §7 chia 4 lát → Task 1-4 ✅

**Placeholder scan:** không có "TBD/TODO"; CSS mô tả bằng danh sách class + hành vi bắt buộc + token cụ thể (polish pixel trong lúc chạy là chủ ý — khớp cách làm 2a/2b, không phải placeholder). Code TSX đầy đủ, chạy được.

**Type consistency:** hook `useMovie(id)`/`useShowtimesByMovie(id)`/`useRooms` khớp giữa Task 1 (định nghĩa) và Task 2/3 (dùng). Key `qk.movie(id)`/`qk.showtimesByMovie(id)`/`qk.rooms` nhất quán. Class `.movie-k` (MovieCard) — smoke Task 2/4 khớp. `.book-k`/`.time-k-btn`/`.book-k__cta` định nghĩa ở Task 3, dùng ở smoke Task 4 ✅. `enriched[].cinema` optional → mọi truy cập dùng `?.` (guard nhất quán) ✅.

**Rủi ro đã ghi:** react-refresh warning (xử disable có chú thích); `exhaustive-deps` cho init default (`// eslint-disable-next-line` có chú thích, chủ ý chỉ chạy khi `enriched` đổi); `.cinema-k` có thể cần copy rule từ Home.css; smoke MovieDetail phụ thuộc dữ liệu có suất (có phương án nới assertion).
