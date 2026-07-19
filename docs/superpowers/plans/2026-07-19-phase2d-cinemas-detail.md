# GĐ2d — Redesign Cinemas + CinemaDetail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng lại Cinemas (lưới thẻ số lớn) + CinemaDetail (hero + khối phim có poster) theo Kinetic, wire TanStack Query, convert TSX — giữ nguyên lọc TP & lịch chiếu.

**Architecture:** Thêm `useCinema(id)`/`useShowtimesByCinema(id)` vào `queries/catalog.ts` + key. Viết lại `Cinemas.jsx`→`Cinemas.tsx` (thẻ `.venue-k` N° watermark) và `CinemaDetail.jsx`→`CinemaDetail.tsx` (hero stats + khối phim poster + hàng ngày→nút giờ). CSS kinetic, xoá class cũ. Verify từng lát bằng 6 gate + Playwright smoke + screenshot.

**Tech Stack:** React 18, TypeScript 5.7, @tanstack/react-query v5, Vite 6, Vitest 3 (happy-dom), Playwright, plain CSS (tokens `styles/tokens.css`, primitive `components/ui`).

## Global Constraints

- **0 warning ESLint**; luôn đọc output; xử react-refresh/exhaustive-deps bằng disable có chú thích khi chính đáng.
- **6 gate xanh mỗi commit:** `npm run typecheck` · `npm run lint` · `npm run format:check` · `npm run test:run` · `npm run e2e` · `npm run build`.
- **Absolute imports** từ `src` root; sibling cùng thư mục dùng `./`.
- **Không thêm dependency mới.**
- **Không rơi rớt logic:** Cinemas lọc theo TP + điều hướng `/cinema/:id`; CinemaDetail `byMovie` + gom ngày + nút giờ → `/seats/:id` + tên phim → `/movie/:id`.
- **Copy tiếng Việt.** Giá VND `toLocaleString("vi-VN")` + `₫`.
- **Commit thẳng `main`.** Không add `CLAUDE.md`/`README.md`.
- Cuối commit body: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Gotcha đã biết:** thêm `.tsx`/xoá `.jsx` → HMR Vite hỏng, trang trắng → kill :3000 + `rm -rf node_modules/.vite` + `npm start`. Screenshot fullPage phải **cuộn dần** để `Reveal` hiện. Xoá script `.mjs` trước `format:check`.

**Chữ ký `services/api` (dùng nguyên):**
- `getCinema(id: Id): Promise<Cinema>`
- `getShowtimesByCinema(cinemaId: Id): Promise<Showtime[]>` (nội bộ tự lấy rooms của rạp rồi gom showtimes)
- `getCities(): Promise<City[]>` · `getCinemas(cityId?): Promise<Cinema[]>` · `getRooms(cinemaId?): Promise<Room[]>` · `getMovies(): Promise<Movie[]>`
(`Id = number | string`)

**Types:** `Cinema{id,cityId,name,address?}`, `City{id,name}`, `Room{id,cinemaId,name,type,...}`, `Movie{id,title,poster?,description?,duration,genre,rating?}`, `Showtime{id,movieId,roomId,time,price,bookedSeats?}`.

**Hook Query sẵn có (`queries/catalog`):** `useMovies`, `useCinemas`, `useCities`, `useAllShowtimes`, `useRooms`, `useMovie(id)`, `useShowtimesByMovie(id)`.

**Primitive UI (`components/ui`):** `Container, Section, Grid(min?), KineticHeading(text), Tag, Badge, Skeleton(height?), Spinner, Reveal, Button`. `MovieCard` (`components/MovieCard`).

---

### Task 1: Query infra — cinema(id) + showtimesByCinema(id)

**Files:**
- Modify: `src/queries/keys.ts`
- Modify: `src/queries/catalog.ts`
- Test: `src/queries/keys.test.ts`

**Interfaces:**
- Consumes: `getCinema`, `getShowtimesByCinema` từ `services/api`.
- Produces:
  - `qk.cinema(id): readonly ["cinema", number|string]`
  - `qk.showtimesByCinema(id): readonly ["showtimes", "byCinema", number|string]`
  - `useCinema(id): UseQueryResult<Cinema>`
  - `useShowtimesByCinema(id): UseQueryResult<Showtime[]>`

- [ ] **Step 1: Write the failing test** — thêm vào `describe` trong `src/queries/keys.test.ts`:

```ts
it("khai báo key có tham số cho Cinema detail", () => {
  expect(qk.cinema(3)).toEqual(["cinema", 3]);
  expect(qk.showtimesByCinema(3)).toEqual(["showtimes", "byCinema", 3]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/queries/keys.test.ts`
Expected: FAIL — `qk.cinema is not a function`.

- [ ] **Step 3: Add keys** — trong `src/queries/keys.ts`, thêm vào object `qk` (giữ key cũ):

```ts
  cinema: (id: number | string) => ["cinema", id] as const,
  showtimesByCinema: (id: number | string) =>
    ["showtimes", "byCinema", id] as const,
```

- [ ] **Step 4: Add hooks** — trong `src/queries/catalog.ts`, thêm `getCinema, getShowtimesByCinema` vào import từ `services/api`, rồi thêm:

```ts
export const useCinema = (id: number | string) =>
  useQuery({ queryKey: qk.cinema(id), queryFn: () => getCinema(id) });

export const useShowtimesByCinema = (id: number | string) =>
  useQuery({
    queryKey: qk.showtimesByCinema(id),
    queryFn: () => getShowtimesByCinema(id),
  });
```

- [ ] **Step 5: Run test + gates**

Run: `npm run test:run -- src/queries/keys.test.ts` → PASS.
Run: `npm run typecheck` → 0 lỗi.
Run: `npm run lint` → 0 warning.

- [ ] **Step 6: Commit**

```bash
git add src/queries/keys.ts src/queries/catalog.ts src/queries/keys.test.ts
git commit -m "$(cat <<'EOF'
feat(GD2d/1): query infra cinema(id) + showtimesByCinema(id)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Cinemas.tsx — lưới thẻ số lớn

**Files:**
- Create: `src/pages/Cinemas.tsx`
- Delete: `src/pages/Cinemas.jsx`
- Rewrite: `src/pages/Cinemas.css`

**Interfaces:**
- Consumes: `useCities, useCinemas, useRooms` (sẵn có); `Container, Grid, KineticHeading, Tag, Skeleton, Button`; `useNavigate`.
- Produces: default export `Cinemas` (route `/cinemas`). Root `.cinemas-page`; h1 chứa "Rạp chiếu phim"; thẻ rạp class `.venue-k`; chip lọc `.city-k-chip`.

- [ ] **Step 1: Viết `src/pages/Cinemas.tsx`**:

```tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import { Container, Grid, KineticHeading, Tag, Skeleton, Button } from "components/ui";
import { useCities, useCinemas, useRooms } from "queries/catalog";
import "./Cinemas.css";

export default function Cinemas() {
  const navigate = useNavigate();
  const citiesQ = useCities();
  const cinemasQ = useCinemas();
  const roomsQ = useRooms();

  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);

  const [cityId, setCityId] = useState<number | "all">("all");

  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );
  const roomCount = useMemo(() => {
    const m = new Map<number, number>();
    rooms.forEach((r) => m.set(r.cinemaId, (m.get(r.cinemaId) ?? 0) + 1));
    return m;
  }, [rooms]);

  const visible = useMemo(
    () =>
      cityId === "all"
        ? cinemas
        : cinemas.filter((c) => c.cityId === cityId),
    [cinemas, cityId],
  );

  const isLoading = cinemasQ.isLoading;
  const isError = cinemasQ.isError;

  return (
    <div className="page cinemas-page">
      <Navbar />
      <Container>
        <header className="cinemas-k__header">
          <span className="cinemas-k__label">Hệ thống rạp</span>
          <h1 className="cinemas-k__title">
            <KineticHeading text="Rạp chiếu phim" />
          </h1>
          {!isLoading && !isError && (
            <span className="cinemas-k__count">
              <b>{visible.length}</b> rạp
            </span>
          )}
        </header>

        <div className="cinemas-k__cities" role="group" aria-label="Lọc theo thành phố">
          <button
            type="button"
            className={"city-k-chip" + (cityId === "all" ? " is-active" : "")}
            aria-pressed={cityId === "all"}
            onClick={() => setCityId("all")}
          >
            Tất cả
          </button>
          {cities.map((c) => (
            <button
              key={c.id}
              type="button"
              className={"city-k-chip" + (cityId === c.id ? " is-active" : "")}
              aria-pressed={cityId === c.id}
              onClick={() => setCityId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {isError ? (
          <div className="cinemas-k__empty">
            <p>Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.</p>
            <Button onClick={() => cinemasQ.refetch()}>Thử lại</Button>
          </div>
        ) : isLoading ? (
          <Grid min="280px">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height="200px" />
            ))}
          </Grid>
        ) : visible.length === 0 ? (
          <div className="cinemas-k__empty">
            <p className="cinemas-k__empty-title">Không có rạp nào</p>
          </div>
        ) : (
          <Grid min="280px">
            {visible.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className="venue-k"
                onClick={() => navigate(`/cinema/${c.id}`)}
              >
                <span className="venue-k__no" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Tag className="venue-k__city">{cityName[c.cityId] ?? "—"}</Tag>
                <span className="venue-k__name">{c.name}</span>
                {c.address && <span className="venue-k__addr">{c.address}</span>}
                <span className="venue-k__rooms">
                  {roomCount.get(c.id) ?? 0} phòng
                </span>
                <span className="venue-k__link">Xem lịch chiếu →</span>
              </button>
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

Run: `git rm src/pages/Cinemas.jsx`

- [ ] **Step 3: Viết lại `src/pages/Cinemas.css`** — kinetic. Class + hành vi:
  - `.cinemas-page .ui-container { padding-top: 48px; padding-bottom: 72px; }`.
  - `.cinemas-k__header` giống Movies: `.cinemas-k__label` mono muted; `.cinemas-k__title` Bebas lớn `clamp(44px,7vw,88px)`; `.cinemas-k__count b` đỏ.
  - `.cinemas-k__cities` flex wrap gap; `.city-k-chip` **giống `.genre-k-chip`** (viền cứng, mono hoa, hover dịch -2px, `.is-active` nền `var(--surface-invert)` chữ `var(--text-invert)`) — copy rule (không phụ thuộc Movies.css).
  - `.venue-k`: `position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 8px; text-align: left; padding: 22px; background: var(--surface); border: 1px solid var(--border); cursor: pointer;` hover `transform: translate(-2px,-2px); border-color: var(--border-strong); box-shadow: var(--shadow-hard);` focus-visible outline.
  - `.venue-k__no`: `position: absolute; top: 4px; right: 12px; font-family:"Bebas Neue"; font-size: 90px; line-height:1; color: var(--text); opacity: 0.06; pointer-events:none;` (watermark).
  - `.venue-k__city` (Tag): tự canh trái (`align-self:flex-start`), z-index trên watermark.
  - `.venue-k__name` Bebas `28px` màu text; `.venue-k__addr` Barlow `14px` muted; `.venue-k__rooms` mono `12px` muted uppercase letter-spacing; `.venue-k__link` mono `13px` màu `var(--red)`, `margin-top: auto`.
  - `.cinemas-k__empty` canh giữa muted; `.cinemas-k__empty-title` Bebas 32px.
  - `@media (prefers-reduced-motion: reduce)`: `.venue-k:hover{transform:none}` và `.city-k-chip:hover{transform:none}`.
  - `@media (max-width:640px)`: `.cinemas-page .ui-container{padding-top:32px}`.
  - **Không còn** class cũ (`.cinemas-section/.cinemas-title/.cinemas-cities/.cinema-card*/.cinemas-grid/.cinemas-empty`).

- [ ] **Step 4: Chạy gate**

Run: `npm run typecheck` → 0 lỗi.
Run: `npm run lint` → 0 warning.
Run: `npm run format:check` → clean (nếu fail: `npx prettier --write src/pages/Cinemas.css src/pages/Cinemas.tsx`).
Run: `npm run test:run` → PASS.
Run: `npm run build` → OK.

- [ ] **Step 5: Verify screenshot** desktop (1280) + mobile (390) `/cinemas`: header lớn, chip lọc active đảo màu, lưới thẻ có N° watermark mờ, badge TP, số phòng, hover OK, mobile 1 cột không tràn. (Nếu trang trắng → restart dev server + xoá `.vite`.)

- [ ] **Step 6: Commit**

```bash
git add src/pages/Cinemas.tsx src/pages/Cinemas.css
git commit -m "$(cat <<'EOF'
feat(GD2d/2): redesign Cinemas kinetic (tsx, wired Query, the so lon)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: CinemaDetail.tsx — hero + khối phim có poster

**Files:**
- Create: `src/pages/CinemaDetail.tsx`
- Delete: `src/pages/CinemaDetail.jsx`
- Rewrite: `src/pages/CinemaDetail.css`

**Interfaces:**
- Consumes: `useCinema(id), useShowtimesByCinema(id)` (Task 1); `useMovies, useRooms, useCities` (sẵn có); `Container, KineticHeading, Reveal, Spinner`; `useParams, useNavigate`.
- Produces: default export `CinemaDetail` (route `/cinema/:id`). Root `.cinema-detail-page`; hero `.venue-hero`; khối phim `.sched-k`; nút giờ `.time-k-btn` (tái dùng class từ MovieDetail.css? KHÔNG — định nghĩa riêng trong CinemaDetail.css để tự chứa, xem Step 3).

- [ ] **Step 1: Viết `src/pages/CinemaDetail.tsx`**:

```tsx
import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import { Container, KineticHeading, Reveal, Spinner } from "components/ui";
import {
  useCinema,
  useShowtimesByCinema,
  useMovies,
  useRooms,
  useCities,
} from "queries/catalog";
import "./CinemaDetail.css";

export default function CinemaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cinemaId = id!;

  const cinemaQ = useCinema(cinemaId);
  const showtimesQ = useShowtimesByCinema(cinemaId);
  const moviesQ = useMovies();
  const roomsQ = useRooms();
  const citiesQ = useCities();

  const cinema = cinemaQ.data;
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);

  const roomMap = useMemo(
    () => Object.fromEntries(rooms.map((r) => [r.id, r])),
    [rooms],
  );
  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );

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

  const byMovie = useMemo(
    () =>
      movies
        .map((m) => ({
          movie: m,
          sts: showtimes.filter((s) => s.movieId === m.id),
        }))
        .filter((x) => x.sts.length > 0),
    [movies, showtimes],
  );

  const roomsCount = useMemo(
    () => rooms.filter((r) => r.cinemaId === Number(cinemaId)).length,
    [rooms, cinemaId],
  );

  if (cinemaQ.isLoading || !cinema) {
    return (
      <div className="page cinema-detail-page cinema-detail-page--center">
        <Navbar back="/cinemas" />
        <Spinner />
        <Footer />
      </div>
    );
  }

  return (
    <div className="page cinema-detail-page">
      <Navbar back="/cinemas" />

      <section className="venue-hero">
        <Container>
          <span className="venue-hero__label">Lịch chiếu tại rạp</span>
          <h1 className="venue-hero__title">
            <KineticHeading text={cinema.name} />
          </h1>
          <p className="venue-hero__addr">
            <span className="venue-hero__city">
              {cityName[cinema.cityId] ?? "—"}
            </span>
            {cinema.address ? ` · ${cinema.address}` : ""}
          </p>
          <div className="venue-hero__stats">
            <div className="stat-k">
              <span className="stat-k__num">{roomsCount}</span>
              <span className="stat-k__label">Phòng</span>
            </div>
            <div className="stat-k">
              <span className="stat-k__num">{byMovie.length}</span>
              <span className="stat-k__label">Phim</span>
            </div>
            <div className="stat-k">
              <span className="stat-k__num">{showtimes.length}</span>
              <span className="stat-k__label">Suất</span>
            </div>
          </div>
        </Container>
      </section>

      <Container>
        {byMovie.length === 0 ? (
          <div className="cinema-detail-empty">Rạp này chưa có suất chiếu</div>
        ) : (
          byMovie.map(({ movie, sts }) => {
            const dates = [...new Set(sts.map((s) => s.time.slice(0, 10)))].sort();
            return (
              <Reveal key={movie.id}>
                <div className="sched-k">
                  <button
                    type="button"
                    className="sched-k__poster"
                    onClick={() => navigate(`/movie/${movie.id}`)}
                    aria-label={`Chi tiết ${movie.title}`}
                  >
                    {movie.poster ? (
                      <img src={movie.poster} alt={movie.title} loading="lazy" />
                    ) : (
                      <span className="sched-k__initial">{movie.title[0]}</span>
                    )}
                  </button>
                  <div className="sched-k__body">
                    <button
                      type="button"
                      className="sched-k__title"
                      onClick={() => navigate(`/movie/${movie.id}`)}
                    >
                      {movie.title}
                    </button>
                    <span className="sched-k__meta">
                      {movie.genre} · {movie.duration} phút
                    </span>
                    {dates.map((d) => (
                      <div key={d} className="sched-k__date-row">
                        <span className="sched-k__date">{fmtDate(d)}</span>
                        <div className="sched-k__times">
                          {sts
                            .filter((s) => s.time.slice(0, 10) === d)
                            .sort((a, b) => a.time.localeCompare(b.time))
                            .map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                className="time-k-btn"
                                onClick={() => navigate(`/seats/${s.id}`)}
                              >
                                <span className="time-k-btn__t">
                                  {fmtTime(s.time)}
                                </span>
                                <span className="time-k-btn__meta">
                                  {roomMap[s.roomId]?.type} ·{" "}
                                  {s.price.toLocaleString("vi-VN")}₫
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            );
          })
        )}
      </Container>

      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Xoá file cũ**

Run: `git rm src/pages/CinemaDetail.jsx`

- [ ] **Step 3: Viết lại `src/pages/CinemaDetail.css`** — kinetic. Class + hành vi:
  - `.cinema-detail-page { background: var(--bg); min-height: 100vh; }`.
  - `.cinema-detail-page--center { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:24px; }`.
  - `.venue-hero { padding: 56px 0 40px; border-bottom: 1px solid var(--border); }`; `.venue-hero__label` mono muted uppercase; `.venue-hero__title` Bebas `clamp(44px,7vw,96px)` line-height .9; `.venue-hero__addr` Barlow muted; `.venue-hero__city` mono uppercase màu `var(--text)`.
  - `.venue-hero__stats { display:flex; gap:40px; margin-top:24px; }`; `.stat-k` flex column; `.stat-k__num` Bebas `48px` màu `var(--red)`; `.stat-k__label` mono `11px` uppercase muted.
  - `.cinema-detail-page .ui-container { padding-top: 40px; padding-bottom: 72px; }`.
  - `.sched-k { display:grid; grid-template-columns: 120px 1fr; gap: 24px; padding: 24px 0; border-bottom: 1px solid var(--border); align-items:start; }`.
  - `.sched-k__poster { position:relative; aspect-ratio: 2/3; overflow:hidden; border:1px solid var(--border); background:var(--surface-2); cursor:pointer; padding:0; }` `img { width:100%; height:100%; object-fit:cover; display:block; }` `.sched-k__initial { display:flex; align-items:center; justify-content:center; height:100%; font-family:"Bebas Neue"; font-size:48px; color:var(--text-dim); }`.
  - `.sched-k__body { display:flex; flex-direction:column; gap:8px; }`.
  - `.sched-k__title { align-self:flex-start; background:none; border:none; padding:0; cursor:pointer; font-family:"Bebas Neue"; font-size:32px; letter-spacing:1px; color:var(--text); text-align:left; transition: color var(--dur-fast,.12s); }` hover `color: var(--red)`.
  - `.sched-k__meta` mono `12px` uppercase muted; margin-bottom nhỏ.
  - `.sched-k__date-row { display:flex; gap:16px; align-items:flex-start; padding-top:10px; }`; `.sched-k__date { flex:0 0 88px; font-family:var(--font-mono); font-size:12px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); padding-top:6px; }`.
  - `.sched-k__times { display:flex; flex-wrap:wrap; gap:8px; }`.
  - `.time-k-btn { display:flex; flex-direction:column; gap:2px; align-items:flex-start; background:var(--surface); border:1px solid var(--border-strong); color:var(--text); padding:8px 12px; cursor:pointer; transition: transform .12s ease, border-color .15s; }` hover `transform:translateY(-2px); border-color:var(--red);`. `.time-k-btn__t { font-family:"Bebas Neue"; font-size:20px; line-height:1; letter-spacing:1px; }` `.time-k-btn__meta { font-family:var(--font-mono); font-size:10px; color:var(--text-muted); }`.
  - `.cinema-detail-empty { padding:60px 0; text-align:center; color:var(--text-muted); }`.
  - `@media (prefers-reduced-motion: reduce)`: `.time-k-btn:hover{transform:none}`.
  - `@media (max-width:640px)`: `.sched-k { grid-template-columns: 88px 1fr; gap:16px; }`; `.sched-k__date-row { flex-direction:column; gap:6px; }`; `.venue-hero__stats { gap:28px; }`.
  - **Không còn** class cũ (`.cinema-detail-section/.cinema-detail-title/.cinema-detail-addr/.cinema-movie-*/.cinema-date-*/.cinema-times/.time-btn/.cinema-empty`).

  > **Lưu ý:** class `.time-k-btn` cũng tồn tại trong `MovieDetail.css` (nền bone). Ở đây định nghĩa lại trên nền tối — vì hai trang không cùng render, không xung đột; nhưng để chắc, giữ selector đơn giản `.time-k-btn` (CinemaDetail.css nạp khi ở trang này). Nếu lo trùng, có thể prefix `.sched-k .time-k-btn` — **chọn prefix `.sched-k__times .time-k-btn`** cho mọi rule ở trên để cách ly hoàn toàn.

- [ ] **Step 4: Chạy gate**

Run: `npm run typecheck` → 0 lỗi.
Run: `npm run lint` → 0 warning.
Run: `npm run format:check` → clean.
Run: `npm run test:run` → PASS.
Run: `npm run build` → OK.

- [ ] **Step 5: Verify screenshot** desktop + mobile `/cinema/1` (cuộn): hero tên rạp lớn + stats số đỏ (Phòng/Phim/Suất), khối phim có poster nhỏ + tên + hàng ngày→nút giờ; bấm giờ điều hướng; mobile poster hẹp + ngày xuống dòng, không tràn.

- [ ] **Step 6: Commit**

```bash
git add src/pages/CinemaDetail.tsx src/pages/CinemaDetail.css
git commit -m "$(cat <<'EOF'
feat(GD2d/3): redesign CinemaDetail kinetic (hero stats + khoi phim poster)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Playwright smoke Cinemas + CinemaDetail + verify + push

**Files:**
- Modify: `e2e/smoke.spec.ts`

- [ ] **Step 1: Thêm test** vào cuối `e2e/smoke.spec.ts`:

```ts
test("trang rạp: tiêu đề, danh sách và lọc theo thành phố", async ({ page }) => {
  await page.goto("/cinemas");
  await expect(
    page.getByRole("heading", { name: "Rạp chiếu phim" }),
  ).toBeVisible();
  await expect(page.locator(".venue-k").first()).toBeVisible();
  const chip = page.locator(".city-k-chip", { hasNotText: "Tất cả" }).first();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
});

test("trang chi tiết rạp: hero và giờ chiếu", async ({ page }) => {
  // Vào từ trang rạp để lấy một rạp thật
  await page.goto("/cinemas");
  await page.locator(".venue-k").first().click();
  await expect(page).toHaveURL(/\/cinema\/\d+/);
  await expect(page.locator(".venue-hero__title")).toBeVisible();
  await expect(page.locator(".time-k-btn").first()).toBeVisible();
});
```

- [ ] **Step 2: Chạy toàn bộ gate**

Run: `npm run typecheck` · `npm run lint` · `npm run format:check` · `npm run test:run` · `npm run build` → tất cả xanh.
Run: `npm run e2e` → tất cả smoke PASS (gồm 2 test mới).

> Nếu rạp đầu tiên không có suất (không có `.time-k-btn`), đổi bước 1 test 2 sang chọn rạp có suất, hoặc nới assertion (chỉ kiểm `.venue-hero__title`). Ưu tiên ổn định.

- [ ] **Step 3: Commit + push**

```bash
git add e2e/smoke.spec.ts
git commit -m "$(cat <<'EOF'
test(GD2d/4): mo rong Playwright smoke Cinemas + CinemaDetail

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 4: Verify CI xanh** qua GitHub API:
`https://api.github.com/repos/khanhnguyen1205/cinema-full/actions/runs` — chờ run mới nhất `conclusion: success`.

---

## Self-Review

**Spec coverage:**
- §2 Query infra → Task 1 ✅
- §3 Cinemas (header/chip/thẻ `.venue-k` N° watermark/số phòng/loading-empty-error/xoá cũ) → Task 2 ✅
- §4 CinemaDetail (hero stats/khối phim poster/hàng ngày→giờ/giữ logic) → Task 3 ✅
- §5 motion/a11y (Reveal, reduced-motion, button thật, aria) → Task 2 & 3 ✅
- §6 test (unit key + smoke Cinemas & CinemaDetail + screenshot) → Task 1/2/4 ✅
- §7 chia 4 lát → Task 1-4 ✅

**Placeholder scan:** không "TBD/TODO"; CSS mô tả bằng class + hành vi + token cụ thể (polish pixel lúc chạy, chủ ý — khớp 2a/2b/2c). Code TSX đầy đủ.

**Type consistency:** `useCinema(id)`/`useShowtimesByCinema(id)` khớp Task 1↔3; `qk.cinema(id)`/`qk.showtimesByCinema(id)` nhất quán. Class smoke: `.venue-k`/`.city-k-chip` (Task 2), `.venue-hero__title`/`.time-k-btn` (Task 3) khớp Task 4. `roomMap[s.roomId]?.type` guard optional ✅. `cityId` state kiểu `number | "all"` nhất quán filter ✅.

**Rủi ro đã ghi:** HMR trắng trang (restart+xoá .vite); `.time-k-btn` trùng tên với MovieDetail → **cách ly bằng prefix `.sched-k__times .time-k-btn`** trong CinemaDetail.css; smoke phụ thuộc rạp có suất (phương án nới assertion).
