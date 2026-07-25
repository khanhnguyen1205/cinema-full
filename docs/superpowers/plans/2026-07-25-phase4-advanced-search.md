# Search nâng cao — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm tìm kiếm nâng cao cho cinema-full: ô search toàn cục ở Navbar, trang `/search` hợp nhất (phim + rạp + suất chiếu), và bộ lọc nâng cao cho trang Movies — tất cả tìm không phân biệt dấu tiếng Việt.

**Architecture:** Hướng A — một lõi tìm kiếm thuần client-side (`src/lib/search.ts`) dùng chung cho 3 bề mặt mỏng. Không thêm endpoint gateway, không migration, không dependency mới; tái dùng hook TanStack Query đã cache.

**Tech Stack:** React 18 + TypeScript, Vite 6, React Router v7 (future flags), TanStack Query v5, Vitest + happy-dom, Playwright, hệ thiết kế Kinetic (CSS thuần).

## Global Constraints

- Giữ **6 cổng CI xanh** mỗi commit: `typecheck` · `lint` (**0 warning**) · `format:check` · `test:run` · `e2e` · `build`.
- Absolute imports từ gốc `src` (`components/...`, `queries/...`, `lib/...`), sibling dùng `./`.
- Mẫu ổn định list cho `useMemo`: `const x = useMemo(() => q.data ?? [], [q.data]);` (KHÔNG `?? []` trần trong deps).
- `react-refresh` / `exhaustive-deps` chính đáng → `// eslint-disable-next-line` có chú thích, KHÔNG nới rule.
- Copy tiếng Việt; giá VND `.toLocaleString("vi-VN")` + `₫`.
- Ràng buộc smoke cũ **giữ nguyên**: placeholder `your@email.com` / `••••••••`, nút "Đăng nhập".
- Tôn trọng `prefers-reduced-motion` (đã có trong `Reveal`), a11y bàn phím, responsive mobile-first.
- Không thêm endpoint/migration/dependency. Chỉ file client.
- Mỗi task = 1 commit, push thẳng main sau khi 6 cổng xanh (repo cá nhân, direct-to-main).
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure

| File | Trách nhiệm |
|---|---|
| `src/lib/search.ts` | 🆕 Lõi: `normalize` (bỏ dấu), `matches`, `scoreMatch` |
| `src/lib/search.test.ts` | 🆕 Unit test lõi |
| `src/components/GlobalSearch.tsx` | 🆕 Ô search Navbar + dropdown 3 nhóm, a11y |
| `src/components/GlobalSearch.css` | 🆕 Style dropdown |
| `src/components/Navbar.tsx` | ✏️ Nhúng `<GlobalSearch>` (desktop + trong menu mobile) |
| `src/pages/Search.tsx` | 🆕 Trang `/search`, đọc `?q=`, 3 khu |
| `src/pages/Search.css` | 🆕 Style trang search |
| `src/pages/Movies.tsx` | ✏️ 4 lọc nâng cao + URL sync + normalize |
| `src/pages/Movies.css` | ✏️ Style hàng lọc nâng cao |
| `src/App.tsx:53` | ✏️ Thêm `<Route path="/search">` |
| `e2e/smoke.spec.ts` | ✏️ +3 test đọc |
| `CLAUDE.md` | ✏️ Ghi route `/search`, `lib/search.ts`, GlobalSearch |

---

### Task 1: Lõi tìm kiếm `src/lib/search.ts`

**Files:**
- Create: `src/lib/search.ts`
- Test: `src/lib/search.test.ts`

**Interfaces:**
- Consumes: (không có)
- Produces:
  - `normalize(s: string): string` — bỏ dấu tiếng Việt, đ→d, lowercase, trim.
  - `matches(haystack: string, queryNorm: string): boolean` — `queryNorm` phải ĐÃ normalize; `haystack` chưa (hàm tự normalize haystack). Query rỗng → `true`.
  - `scoreMatch(haystack: string, queryNorm: string): number` — 3 khớp nguyên / 2 bắt đầu bằng / 1 chứa / 0 không.

- [ ] **Step 1: Viết test thất bại** — `src/lib/search.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { normalize, matches, scoreMatch } from "./search";

describe("normalize", () => {
  it("bỏ dấu mọi nguyên âm tiếng Việt", () => {
    expect(normalize("Điện Biên Phủ")).toBe("dien bien phu");
    expect(normalize("Ầ Ế Ộ Ữ Ỳ")).toBe("a e o u y");
  });
  it("đ/Đ -> d", () => {
    expect(normalize("ĐÀ NẴNG")).toBe("da nang");
  });
  it("hạ thường + trim", () => {
    expect(normalize("  Avengers: ENDGAME  ")).toBe("avengers: endgame");
  });
  it("chuỗi rỗng", () => {
    expect(normalize("")).toBe("");
  });
});

describe("matches", () => {
  it("khớp không dấu", () => {
    expect(matches("Điện Biên", normalize("dien"))).toBe(true);
  });
  it("không khớp", () => {
    expect(matches("Avengers", normalize("xyz"))).toBe(false);
  });
  it("query rỗng -> true", () => {
    expect(matches("bất kỳ", "")).toBe(true);
  });
});

describe("scoreMatch", () => {
  it("khớp nguyên = 3", () => {
    expect(scoreMatch("Avengers", normalize("avengers"))).toBe(3);
  });
  it("bắt đầu bằng = 2", () => {
    expect(scoreMatch("Avengers Endgame", normalize("avengers"))).toBe(2);
  });
  it("chứa = 1", () => {
    expect(scoreMatch("The Avengers", normalize("avengers"))).toBe(1);
  });
  it("không khớp = 0", () => {
    expect(scoreMatch("Frozen", normalize("avengers"))).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để thấy fail**

Run: `npm run test:run -- src/lib/search.test.ts`
Expected: FAIL — "does not provide an export named 'normalize'".

- [ ] **Step 3: Viết implementation tối thiểu** — `src/lib/search.ts`

```ts
// Lõi tìm kiếm thuần: chuẩn hoá bỏ dấu tiếng Việt + so khớp/xếp hạng.
// Không phụ thuộc React/Prisma -> test chạy không cần DB.

export function normalize(s: string): string {
  return s
    .normalize("NFD") // tách dấu tổ hợp khỏi nguyên âm
    .replace(/[̀-ͯ]/g, "") // xoá dấu tổ hợp
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

// queryNorm ĐÃ normalize; haystack thô (hàm tự normalize). Query rỗng -> true.
export function matches(haystack: string, queryNorm: string): boolean {
  if (!queryNorm) return true;
  return normalize(haystack).includes(queryNorm);
}

// Điểm liên quan để xếp hạng kết quả.
export function scoreMatch(haystack: string, queryNorm: string): number {
  if (!queryNorm) return 0;
  const h = normalize(haystack);
  if (h === queryNorm) return 3;
  if (h.startsWith(queryNorm)) return 2;
  if (h.includes(queryNorm)) return 1;
  return 0;
}
```

- [ ] **Step 4: Chạy test để thấy pass**

Run: `npm run test:run -- src/lib/search.test.ts`
Expected: PASS (12 test).

- [ ] **Step 5: Cổng + commit**

```bash
npm run typecheck && npm run lint && npm run format:check
git add src/lib/search.ts src/lib/search.test.ts
git commit -m "feat(GD4-search): loi tim kiem client-side (normalize bo dau + matches + scoreMatch)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `GlobalSearch` + nhúng Navbar

**Files:**
- Create: `src/components/GlobalSearch.tsx`, `src/components/GlobalSearch.css`
- Modify: `src/components/Navbar.tsx` (nhúng vào `nav-k__right` và menu mobile)

**Interfaces:**
- Consumes: `normalize`, `matches`, `scoreMatch` (Task 1); hooks `useMovies`/`useCinemas`/`useAllShowtimes`/`useRooms`/`useCities` từ `queries/catalog`; `useNavigate` (react-router).
- Produces: `export default function GlobalSearch()` — component không nhận prop.

Hành vi: input debounce 150ms; dropdown tối đa 4 phim / 3 rạp / 4 suất sắp tới; ↑↓ roving qua danh sách phẳng các mục + dòng "Xem tất cả"; Enter chọn mục focus hoặc (không focus) → `/search?q=`; Esc/click-ngoài đóng.

- [ ] **Step 1: Viết component** — `src/components/GlobalSearch.tsx`

```tsx
import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useMovies,
  useCinemas,
  useAllShowtimes,
  useRooms,
  useCities,
} from "queries/catalog";
import { normalize, matches, scoreMatch } from "lib/search";
import type { Movie, Cinema, Showtime } from "types";
import "./GlobalSearch.css";

interface ShowResult {
  showtime: Showtime;
  movie?: Movie;
  cinema?: Cinema;
  roomType?: string;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState("");
  const [q, setQ] = useState(""); // đã debounce
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // chỉ số mục đang focus trong danh sách phẳng
  const boxRef = useRef<HTMLDivElement>(null);

  // debounce 150ms
  useEffect(() => {
    const t = setTimeout(() => setQ(raw), 150);
    return () => clearTimeout(t);
  }, [raw]);

  const moviesQ = useMovies();
  const cinemasQ = useCinemas();
  const showtimesQ = useAllShowtimes();
  const roomsQ = useRooms();
  const citiesQ = useCities();

  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);

  const qn = normalize(q);

  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );
  const roomById = useMemo(
    () => Object.fromEntries(rooms.map((r) => [r.id, r])),
    [rooms],
  );
  const cinemaById = useMemo(
    () => Object.fromEntries(cinemas.map((c) => [c.id, c])),
    [cinemas],
  );
  const movieById = useMemo(
    () => Object.fromEntries(movies.map((m) => [m.id, m])),
    [movies],
  );

  const movieHits = useMemo(() => {
    if (!qn) return [];
    return movies
      .filter((m) => matches(m.title, qn))
      .sort((a, b) => scoreMatch(b.title, qn) - scoreMatch(a.title, qn))
      .slice(0, 4);
  }, [movies, qn]);

  const cinemaHits = useMemo(() => {
    if (!qn) return [];
    return cinemas
      .filter((c) => matches(c.name, qn) || matches(c.address ?? "", qn))
      .sort((a, b) => scoreMatch(b.name, qn) - scoreMatch(a.name, qn))
      .slice(0, 3);
  }, [cinemas, qn]);

  const showHits = useMemo<ShowResult[]>(() => {
    if (!qn) return [];
    const now = new Date().toISOString();
    return showtimes
      .filter((s) => s.time >= now)
      .map((s) => {
        const room = roomById[s.roomId];
        const cinema = room ? cinemaById[room.cinemaId] : undefined;
        const movie = movieById[s.movieId];
        return { showtime: s, movie, cinema, roomType: room?.type };
      })
      .filter(
        (r) =>
          (r.movie && matches(r.movie.title, qn)) ||
          (r.cinema && matches(r.cinema.name, qn)),
      )
      .sort((a, b) => a.showtime.time.localeCompare(b.showtime.time))
      .slice(0, 4);
  }, [showtimes, roomById, cinemaById, movieById, qn]);

  // danh sách phẳng để điều hướng bàn phím: mỗi phần tử có href
  const flat = useMemo(() => {
    const items: { href: string; key: string }[] = [];
    movieHits.forEach((m) => items.push({ href: `/movie/${m.id}`, key: `m${m.id}` }));
    cinemaHits.forEach((c) => items.push({ href: `/cinema/${c.id}`, key: `c${c.id}` }));
    showHits.forEach((r) =>
      items.push({ href: `/seats/${r.showtime.id}`, key: `s${r.showtime.id}` }),
    );
    if (qn) items.push({ href: `/search?q=${encodeURIComponent(q)}`, key: "all" });
    return items;
  }, [movieHits, cinemaHits, showHits, qn, q]);

  const hasResults = movieHits.length + cinemaHits.length + showHits.length > 0;
  const loading = moviesQ.isLoading || cinemasQ.isLoading;
  const showDropdown = open && qn.length > 0 && !loading;

  // đóng khi click ngoài
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // reset con trỏ khi kết quả đổi
  useEffect(() => setActive(-1), [q]);

  const go = (href: string) => {
    setOpen(false);
    setRaw("");
    navigate(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      if (active >= 0 && flat[active]) go(flat[active].href);
      else if (qn) go(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div className="gsearch" ref={boxRef}>
      <div className="gsearch__box">
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
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="gsearch-list"
          aria-label="Tìm phim, rạp, suất chiếu"
          placeholder="Tìm phim, rạp..."
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {showDropdown && (
        <div className="gsearch__drop" id="gsearch-list" role="listbox">
          {!hasResults ? (
            <div className="gsearch__empty">
              Không tìm thấy. Nhấn Enter để tìm nâng cao.
            </div>
          ) : (
            <>
              {movieHits.length > 0 && (
                <div className="gsearch__group">
                  <span className="gsearch__grouphd">PHIM</span>
                  {movieHits.map((m) => {
                    const idx = flat.findIndex((f) => f.key === `m${m.id}`);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={active === idx}
                        className={
                          "gsearch__item" + (active === idx ? " is-active" : "")
                        }
                        onClick={() => go(`/movie/${m.id}`)}
                      >
                        {m.poster ? (
                          <img src={m.poster} alt="" className="gsearch__poster" />
                        ) : (
                          <span className="gsearch__poster gsearch__poster--ph">
                            {m.title[0]}
                          </span>
                        )}
                        <span className="gsearch__meta">
                          <span className="gsearch__name">{m.title}</span>
                          <span className="gsearch__sub">{m.genre}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {cinemaHits.length > 0 && (
                <div className="gsearch__group">
                  <span className="gsearch__grouphd">RẠP</span>
                  {cinemaHits.map((c) => {
                    const idx = flat.findIndex((f) => f.key === `c${c.id}`);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={active === idx}
                        className={
                          "gsearch__item" + (active === idx ? " is-active" : "")
                        }
                        onClick={() => go(`/cinema/${c.id}`)}
                      >
                        <span className="gsearch__meta">
                          <span className="gsearch__name">{c.name}</span>
                          <span className="gsearch__sub">
                            {c.address ?? cityName[c.cityId] ?? ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {showHits.length > 0 && (
                <div className="gsearch__group">
                  <span className="gsearch__grouphd">SUẤT CHIẾU</span>
                  {showHits.map((r) => {
                    const idx = flat.findIndex(
                      (f) => f.key === `s${r.showtime.id}`,
                    );
                    return (
                      <button
                        key={r.showtime.id}
                        type="button"
                        role="option"
                        aria-selected={active === idx}
                        className={
                          "gsearch__item" + (active === idx ? " is-active" : "")
                        }
                        onClick={() => go(`/seats/${r.showtime.id}`)}
                      >
                        <span className="gsearch__meta">
                          <span className="gsearch__name">
                            {r.movie?.title ?? "Phim"}
                          </span>
                          <span className="gsearch__sub">
                            {fmtTime(r.showtime.time)} · {r.cinema?.name ?? ""}
                            {r.roomType ? ` · ${r.roomType}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                role="option"
                aria-selected={active === flat.length - 1}
                className={
                  "gsearch__all" +
                  (active === flat.length - 1 ? " is-active" : "")
                }
                onClick={() => go(`/search?q=${encodeURIComponent(q)}`)}
              >
                Xem tất cả kết quả cho “{q.trim()}” →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Viết CSS** — `src/components/GlobalSearch.css`

Dùng token Kinetic (viền cứng, mono, bone cho mục active). Đây là style tối thiểu tự chứa; tinh chỉnh sau khi xem screenshot.

```css
.gsearch {
  position: relative;
  flex: 1 1 auto;
  max-width: 320px;
  min-width: 0;
}
.gsearch__box {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  border: var(--bw-1) solid var(--border);
  border-radius: var(--r-sm);
  padding: 0 var(--sp-3);
  background: var(--surface);
  color: var(--text-dim);
}
.gsearch__box input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  padding: var(--sp-2) 0;
  outline: none;
}
.gsearch__drop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: var(--z-dropdown, 50);
  background: var(--surface);
  border: var(--bw-2) solid var(--border);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-hard, 4px 4px 0 var(--border));
  max-height: 70vh;
  overflow-y: auto;
}
.gsearch__group {
  padding: var(--sp-2) 0;
  border-bottom: var(--bw-1) solid var(--border);
}
.gsearch__grouphd {
  display: block;
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  letter-spacing: 0.08em;
  color: var(--text-dim);
  padding: var(--sp-1) var(--sp-3);
}
.gsearch__item,
.gsearch__all {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  text-align: left;
  padding: var(--sp-2) var(--sp-3);
  background: transparent;
  border: 0;
  color: var(--text);
  cursor: pointer;
  font: inherit;
}
.gsearch__item.is-active,
.gsearch__item:hover,
.gsearch__all.is-active,
.gsearch__all:hover {
  background: var(--surface-invert);
  color: var(--text-invert);
}
.gsearch__poster {
  width: 32px;
  height: 44px;
  object-fit: cover;
  border: var(--bw-1) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
}
.gsearch__poster--ph {
  background: var(--surface-2, var(--surface));
}
.gsearch__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.gsearch__name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gsearch__sub {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gsearch__item.is-active .gsearch__sub,
.gsearch__all.is-active .gsearch__sub {
  color: inherit;
}
.gsearch__all {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
}
.gsearch__empty {
  padding: var(--sp-4);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
}
@media (max-width: 860px) {
  .gsearch {
    max-width: none;
    width: 100%;
  }
}
```

> **Lưu ý:** một số token (`--z-dropdown`, `--shadow-hard`, `--surface-2`) có fallback inline phòng khi chưa định nghĩa trong `tokens.css`. Kiểm `src/styles/tokens.css` và thay bằng token thật nếu có (vd `--surface-invert`/`--text-invert` chắc chắn tồn tại — dùng cho mục active).

- [ ] **Step 3: Nhúng vào Navbar** — `src/components/Navbar.tsx`

Thêm import ở đầu file (sau dòng `import { cx } from "lib/cx";`):

```tsx
import GlobalSearch from "components/GlobalSearch";
```

Trong `nav-k__right`, chèn `<GlobalSearch />` NGAY TRƯỚC khối `{user ? (...) : (...)}` — tức sau `<div className="nav-k__right">`:

```tsx
      <div className="nav-k__right">
        <div className="nav-k__search-desktop">
          <GlobalSearch />
        </div>
        {user ? (
```

Trong menu mobile (`<div id="nav-mobile" ...>`), chèn `<GlobalSearch />` NGAY SAU thẻ mở div, TRƯỚC vòng `{LINKS.map(...)}`:

```tsx
      <div
        id="nav-mobile"
        className={cx("nav-k__mobile", menuOpen && "is-open")}
      >
        <div className="nav-k__search-mobile">
          <GlobalSearch />
        </div>
        {LINKS.map((l) => (
```

Thêm vào `src/components/Navbar.css` (cuối file): ẩn ô desktop trên mobile và ngược lại.

```css
.nav-k__search-desktop {
  display: flex;
  min-width: 0;
  margin: 0 var(--sp-4);
}
.nav-k__search-mobile {
  display: none;
}
@media (max-width: 860px) {
  .nav-k__search-desktop {
    display: none;
  }
  .nav-k__search-mobile {
    display: block;
    padding: var(--sp-3) 0;
  }
}
```

> Kiểm breakpoint hamburger thật trong `Navbar.css` (grep `hamburger`/`@media`) và khớp `max-width` cho đồng bộ (thay 860px nếu Navbar dùng số khác).

- [ ] **Step 4: Chạy cổng + kiểm bằng mắt**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run build`
Expected: tất cả xanh, 0 warning.

Kiểm thủ công (server dev đang chạy :3000): gõ "aveng" → dropdown nhóm PHIM/RẠP/SUẤT; ↑↓ chạy; Enter mục → điều hướng; Enter trống → `/search?q=aveng`.

- [ ] **Step 5: Screenshot verify + commit**

Chụp headless Chrome desktop (`--window-size=1280,900`) + mobile (`--window-size=390,844`) trang `/movies` với dropdown mở (`--virtual-time-budget=5000`), gom Artifact gallery để review trên điện thoại. Xoá script screenshot trước `format:check`.

```bash
git add src/components/GlobalSearch.tsx src/components/GlobalSearch.css src/components/Navbar.tsx src/components/Navbar.css
git commit -m "feat(GD4-search): GlobalSearch tren Navbar (dropdown phim/rap/suat + a11y ban phim)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Trang `/search` + route

**Files:**
- Create: `src/pages/Search.tsx`, `src/pages/Search.css`
- Modify: `src/App.tsx` (import + route)

**Interfaces:**
- Consumes: `normalize`/`matches`/`scoreMatch` (Task 1); hooks catalog; `useSearchParams` (react-router); `Container`/`Section`/`Grid`/`KineticHeading`/`Reveal`/`Tag`/`Skeleton`/`Button` từ `components/ui`; `MovieCard`; `Navbar`/`Footer`.
- Produces: `export default function Search()`.

- [ ] **Step 1: Viết trang** — `src/pages/Search.tsx`

```tsx
import { useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import MovieCard from "components/MovieCard";
import {
  Container,
  Section,
  Grid,
  KineticHeading,
  Reveal,
  Tag,
  Skeleton,
  Button,
} from "components/ui";
import {
  useMovies,
  useCinemas,
  useAllShowtimes,
  useRooms,
  useCities,
} from "queries/catalog";
import { normalize, matches, scoreMatch } from "lib/search";
import type { Movie, Cinema, Showtime } from "types";
import "./Search.css";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

interface ShowResult {
  showtime: Showtime;
  movie?: Movie;
  cinema?: Cinema;
  roomType?: string;
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") ?? "";
  const qn = normalize(q);

  const moviesQ = useMovies();
  const cinemasQ = useCinemas();
  const showtimesQ = useAllShowtimes();
  const roomsQ = useRooms();
  const citiesQ = useCities();

  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);

  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );
  const roomById = useMemo(
    () => Object.fromEntries(rooms.map((r) => [r.id, r])),
    [rooms],
  );
  const cinemaById = useMemo(
    () => Object.fromEntries(cinemas.map((c) => [c.id, c])),
    [cinemas],
  );
  const movieById = useMemo(
    () => Object.fromEntries(movies.map((m) => [m.id, m])),
    [movies],
  );

  const movieHits = useMemo(() => {
    if (!qn) return [];
    return movies
      .filter((m) => matches(m.title, qn))
      .sort((a, b) => scoreMatch(b.title, qn) - scoreMatch(a.title, qn));
  }, [movies, qn]);

  const cinemaHits = useMemo(() => {
    if (!qn) return [];
    return cinemas
      .filter((c) => matches(c.name, qn) || matches(c.address ?? "", qn))
      .sort((a, b) => scoreMatch(b.name, qn) - scoreMatch(a.name, qn));
  }, [cinemas, qn]);

  const showHits = useMemo<ShowResult[]>(() => {
    if (!qn) return [];
    const now = new Date().toISOString();
    return showtimes
      .filter((s) => s.time >= now)
      .map((s) => {
        const room = roomById[s.roomId];
        const cinema = room ? cinemaById[room.cinemaId] : undefined;
        const movie = movieById[s.movieId];
        return { showtime: s, movie, cinema, roomType: room?.type };
      })
      .filter(
        (r) =>
          (r.movie && matches(r.movie.title, qn)) ||
          (r.cinema && matches(r.cinema.name, qn)),
      )
      .sort((a, b) => a.showtime.time.localeCompare(b.showtime.time));
  }, [showtimes, roomById, cinemaById, movieById, qn]);

  const total = movieHits.length + cinemaHits.length + showHits.length;
  const isLoading =
    moviesQ.isLoading || cinemasQ.isLoading || showtimesQ.isLoading;
  const isError = moviesQ.isError || cinemasQ.isError;

  return (
    <div className="page search-page">
      <Navbar />
      <Container>
        <header className="search-k__header">
          <span className="search-k__label">Tìm kiếm</span>
          <h1 className="search-k__title">
            <KineticHeading text={q.trim() ? q.trim() : "Tìm kiếm"} />
          </h1>
          <form
            className="search-k__box"
            onSubmit={(e) => e.preventDefault()}
            role="search"
          >
            <input
              type="text"
              aria-label="Tìm phim, rạp, suất chiếu"
              placeholder="Tìm phim, rạp, suất chiếu..."
              value={q}
              onChange={(e) => setParams({ q: e.target.value }, { replace: true })}
              autoFocus
            />
          </form>
          {qn && !isLoading && (
            <span className="search-k__count">
              <b>{total}</b> kết quả
            </span>
          )}
        </header>

        {isError ? (
          <div className="search-k__empty">
            <p>Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.</p>
            <Button onClick={() => moviesQ.refetch()}>Thử lại</Button>
          </div>
        ) : !qn ? (
          <div className="search-k__hint">
            <p>Nhập từ khoá để tìm phim, rạp, suất chiếu.</p>
          </div>
        ) : isLoading ? (
          <Grid min="200px">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="320px" />
            ))}
          </Grid>
        ) : total === 0 ? (
          <div className="search-k__empty">
            <p className="search-k__empty-title">
              Không tìm thấy kết quả cho “{q.trim()}”
            </p>
            <p className="search-k__empty-sub">Thử từ khoá ngắn hơn.</p>
          </div>
        ) : (
          <>
            {movieHits.length > 0 && (
              <Reveal>
                <Section>
                  <div className="search-k__sechd">
                    <KineticHeading text="Phim" />
                    <span className="search-k__seccount">
                      {movieHits.length}
                    </span>
                    <Link
                      to={`/movies?q=${encodeURIComponent(q)}`}
                      className="search-k__more"
                    >
                      Lọc chi tiết trên trang Phim →
                    </Link>
                  </div>
                  <Grid min="200px">
                    {movieHits.map((m) => (
                      <MovieCard key={m.id} movie={m} />
                    ))}
                  </Grid>
                </Section>
              </Reveal>
            )}

            {cinemaHits.length > 0 && (
              <Reveal>
                <Section>
                  <div className="search-k__sechd">
                    <KineticHeading text="Rạp" />
                    <span className="search-k__seccount">
                      {cinemaHits.length}
                    </span>
                  </div>
                  <Grid min="280px">
                    {cinemaHits.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="venue-k"
                        onClick={() => navigate(`/cinema/${c.id}`)}
                      >
                        <Tag className="venue-k__city">
                          {cityName[c.cityId] ?? "—"}
                        </Tag>
                        <span className="venue-k__name">{c.name}</span>
                        {c.address && (
                          <span className="venue-k__addr">{c.address}</span>
                        )}
                        <span className="venue-k__link">Xem lịch chiếu →</span>
                      </button>
                    ))}
                  </Grid>
                </Section>
              </Reveal>
            )}

            {showHits.length > 0 && (
              <Reveal>
                <Section>
                  <div className="search-k__sechd">
                    <KineticHeading text="Suất chiếu" />
                    <span className="search-k__seccount">
                      {showHits.length}
                    </span>
                  </div>
                  <ul className="search-k__shows">
                    {showHits.map((r) => (
                      <li key={r.showtime.id}>
                        <button
                          type="button"
                          className="search-k__show"
                          onClick={() => navigate(`/seats/${r.showtime.id}`)}
                        >
                          <span className="search-k__showtitle">
                            {r.movie?.title ?? "Phim"}
                          </span>
                          <span className="search-k__showmeta">
                            {fmtTime(r.showtime.time)} · {r.cinema?.name ?? ""}
                            {r.roomType ? ` · ${r.roomType}` : ""}
                          </span>
                          <span className="search-k__showgo">Chọn ghế →</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Section>
              </Reveal>
            )}
          </>
        )}
      </Container>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Viết CSS** — `src/pages/Search.css`

Tự chứa `.venue-k` (copy từ `Cinemas.css`, xem file đó và sao khối `.venue-k*` để trang search không phụ thuộc Cinemas.css) + style header/section/show.

```css
.search-k__header {
  padding: var(--sp-6) 0 var(--sp-4);
}
.search-k__label {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  letter-spacing: 0.08em;
  color: var(--text-dim);
}
.search-k__title {
  margin: var(--sp-2) 0;
}
.search-k__box {
  margin: var(--sp-3) 0;
}
.search-k__box input {
  width: 100%;
  max-width: 520px;
  border: var(--bw-2) solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  padding: var(--sp-3);
  outline: none;
}
.search-k__count {
  font-family: var(--font-mono);
  color: var(--text-dim);
}
.search-k__sechd {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
  flex-wrap: wrap;
}
.search-k__seccount {
  font-family: var(--font-mono);
  color: var(--red);
}
.search-k__more {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  color: var(--text);
}
.search-k__hint,
.search-k__empty {
  padding: var(--sp-8) 0;
  text-align: center;
  color: var(--text-dim);
}
.search-k__empty-title {
  font-family: var(--font-display);
  font-size: var(--fs-xl);
  color: var(--text);
}
.search-k__shows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.search-k__show {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  width: 100%;
  text-align: left;
  border: var(--bw-1) solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--text);
  padding: var(--sp-3) var(--sp-4);
  cursor: pointer;
  font: inherit;
}
.search-k__show:hover {
  background: var(--surface-invert);
  color: var(--text-invert);
}
.search-k__showtitle {
  font-weight: 600;
  flex: 1 1 auto;
}
.search-k__showmeta {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  color: var(--text-dim);
}
.search-k__show:hover .search-k__showmeta {
  color: inherit;
}
.search-k__showgo {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
}

/* --- .venue-k: COPY từ src/pages/Cinemas.css (khối .venue-k*) để tự chứa --- */
/* (Thay khối này bằng nội dung thật của .venue-k* trong Cinemas.css lúc thực thi) */
```

> **Bắt buộc lúc thực thi:** mở `src/pages/Cinemas.css`, tìm mọi rule `.venue-k*`, copy nguyên văn vào cuối `Search.css` (giống cách 2c/2d copy `.cinema-k`/`.time-k-btn` cho tự chứa). Nếu có va chạm tên (vd `.venue-k__no` ở Cinemas có `i+1`), bỏ phần `venue-k__no` vì Search không đánh số — hoặc giữ nếu muốn.

- [ ] **Step 3: Thêm route** — `src/App.tsx`

Thêm import (sau dòng 11 `import Cinemas from "pages/Cinemas";`):

```tsx
import Search from "pages/Search";
```

Thêm route (sau dòng 53 `<Route path="/cinemas" ... />`):

```tsx
        <Route path="/search" element={<Search />} />
```

- [ ] **Step 4: Cổng + kiểm mắt**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run build`
Expected: xanh, 0 warning.

Mở `http://localhost:3000/search?q=aveng` → 3 khu; gõ trong ô → URL `?q=` đổi + kết quả đổi; `/search` (không q) → màn gợi ý.

- [ ] **Step 5: Screenshot + commit**

Chụp desktop+mobile `/search?q=aveng` (cuộn cho `Reveal` fire), Artifact gallery.

```bash
git add src/pages/Search.tsx src/pages/Search.css src/App.tsx
git commit -m "feat(GD4-search): trang /search hop nhat (phim + rap + suat chieu, doc ?q=)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Movies — 4 lọc nâng cao + URL sync + normalize

**Files:**
- Modify: `src/pages/Movies.tsx` (thay state cục bộ bằng `useSearchParams`, thêm lọc, dùng `normalize`)
- Modify: `src/pages/Movies.css` (hàng lọc nâng cao)

**Interfaces:**
- Consumes: `normalize` (Task 1); `useSearchParams` (react-router).
- Produces: (không có export mới)

Trạng thái URL: `q` (tên), `genres` (CSV), `rating` (`0|7|8|9`), `dur` (`all|short|mid|long`), `fmt` (CSV các `2D|3D|IMAX`), `city` (cityId|`all`), `date` (yyyy-mm-dd|`all`), `sort`.

- [ ] **Step 1: Chuyển Movies sang URL state + thêm lọc**

Thay phần khai báo state (dòng 44-50) và các `useMemo` liên quan. Dưới đây là bản thay thế trọn vẹn cho **thân component** từ chỗ khai báo state tới `visible` (giữ nguyên phần render, chỉ thêm control mới ở Step 2). Chèn `useSearchParams` vào import react-router (dòng 2):

```tsx
import { useLocation, useSearchParams } from "react-router-dom";
```

Import `normalize`:

```tsx
import { normalize } from "lib/search";
```

Thêm hằng gần `SORTS`:

```tsx
const DURATIONS = [
  { value: "all", label: "Mọi thời lượng" },
  { value: "short", label: "Dưới 90′" },
  { value: "mid", label: "90–120′" },
  { value: "long", label: "Trên 120′" },
];
const RATINGS = [
  { value: "0", label: "Mọi điểm" },
  { value: "7", label: "≥ 7" },
  { value: "8", label: "≥ 8" },
  { value: "9", label: "≥ 9" },
];
const FORMATS = ["2D", "3D", "IMAX"] as const;
```

Thay khối state (44-50) bằng:

```tsx
  const [params, setParams] = useSearchParams();
  const initGenre =
    (location.state as { genre?: string } | null)?.genre || "";

  // đọc từ URL (nguồn sự thật)
  const search = params.get("q") ?? "";
  const genres = useMemo(() => {
    const raw = params.get("genres") ?? initGenre;
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [params, initGenre]);
  const rating = params.get("rating") ?? "0";
  const dur = params.get("dur") ?? "all";
  const fmt = useMemo(() => {
    const raw = params.get("fmt");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [params]);
  const city = params.get("city") ?? "Tất cả";
  const date = params.get("date") ?? "Tất cả";
  const sort = params.get("sort") ?? "name-asc";

  // ghi 1 khoá vào URL (bỏ khoá khi giá trị mặc định để URL sạch)
  const setParam = (key: string, value: string, def: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === def) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const toggleInCsv = (key: string, item: string) => {
    const cur = (params.get(key) ?? "").split(",").filter(Boolean);
    const next = cur.includes(item)
      ? cur.filter((x) => x !== item)
      : [...cur, item];
    setParam(key, next.join(","), "");
  };
  const clearAll = () => setParams({}, { replace: true });
```

Sửa `genresList` (danh sách thể loại để render chip) — đổi tên biến `genres` cũ (dòng 68-71) thành `allGenres` để không đụng state mới:

```tsx
  const allGenres = useMemo(
    () => Array.from(new Set(movies.map((m) => m.genre))),
    [movies],
  );
```

Thêm map định dạng phòng theo movieId (suy từ rooms→showtimes). Đặt cạnh `rows`:

```tsx
  const roomType = useMemo(
    () => Object.fromEntries(rooms.map((r) => [r.id, r.type])),
    [rooms],
  );
  const formatsByMovie = useMemo(() => {
    const m = new Map<number, Set<string>>();
    showtimes.forEach((s) => {
      const t = roomType[s.roomId];
      if (!t) return;
      if (!m.has(s.movieId)) m.set(s.movieId, new Set());
      m.get(s.movieId)!.add(t);
    });
    return m;
  }, [showtimes, roomType]);
```

Cập nhật `city`/`date` handler: nơi cũ `setCity(...)` → `setParam("city", ..., "Tất cả")` và reset date; `setDate` → `setParam("date", ..., "Tất cả")`; `setSort` → `setParam("sort", ..., "name-asc")`; `setSearch` → `setParam("q", ..., "")`. `setGenre(g)` (chip đơn cũ) → `toggleInCsv("genres", g)`.

Thay `visible` (102-124) bằng:

```tsx
  const visible = useMemo(() => {
    let list = movies;
    if (movieIdsByShowtime)
      list = list.filter((m) => movieIdsByShowtime.has(m.id));
    if (genres.length > 0) list = list.filter((m) => genres.includes(m.genre));
    const minR = Number(rating);
    if (minR > 0)
      list = list.filter((m) => (m.rating ?? -1) >= minR);
    if (dur !== "all")
      list = list.filter((m) => {
        if (dur === "short") return m.duration < 90;
        if (dur === "mid") return m.duration >= 90 && m.duration <= 120;
        return m.duration > 120; // long
      });
    if (fmt.length > 0)
      list = list.filter((m) => {
        const fs = formatsByMovie.get(m.id);
        return fs && fmt.some((f) => fs.has(f));
      });
    const qn = normalize(search);
    if (qn) list = list.filter((m) => normalize(m.title).includes(qn));
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
  }, [
    movies,
    genres,
    rating,
    dur,
    fmt,
    search,
    sort,
    movieIdsByShowtime,
    formatsByMovie,
  ]);

  const hasFilters =
    !!search ||
    genres.length > 0 ||
    rating !== "0" ||
    dur !== "all" ||
    fmt.length > 0 ||
    city !== "Tất cả" ||
    date !== "Tất cả";
```

- [ ] **Step 2: Cập nhật JSX control**

Trong `movies-k__search` input: `value={search}` + `onChange={(e) => setParam("q", e.target.value, "")}`.

Ba `<select>` city/date/sort: đổi `value`/`onChange` sang đọc biến URL + `setParam(...)` như trên (city reset date qua `setParams` gộp).

Khối chip thể loại: đổi `genres.map` → `allGenres.map`, `genre === g` → `genres.includes(g)`, `aria-pressed`/onClick → `toggleInCsv("genres", g)`. Thêm chip "Tất cả" đầu danh sách (active khi `genres.length === 0`, onClick xoá khoá `genres`).

Thêm **hàng lọc nâng cao** sau khối genres, trong `movies-k__controls`:

```tsx
          <details className="movies-k__adv" open>
            <summary>Lọc nâng cao</summary>
            <div className="movies-k__advrow">
              <div className="movies-k__chipset" role="group" aria-label="Điểm">
                <span className="movies-k__advlabel">Điểm</span>
                {RATINGS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={
                      "genre-k-chip" + (rating === r.value ? " is-active" : "")
                    }
                    aria-pressed={rating === r.value}
                    onClick={() => setParam("rating", r.value, "0")}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="movies-k__chipset" role="group" aria-label="Định dạng">
                <span className="movies-k__advlabel">Định dạng</span>
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={
                      "genre-k-chip" + (fmt.includes(f) ? " is-active" : "")
                    }
                    aria-pressed={fmt.includes(f)}
                    onClick={() => toggleInCsv("fmt", f)}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <select
                value={dur}
                onChange={(e) => setParam("dur", e.target.value, "all")}
                aria-label="Thời lượng"
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>

              {hasFilters && (
                <button
                  type="button"
                  className="movies-k__clear"
                  onClick={clearAll}
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </details>
```

- [ ] **Step 3: CSS** — thêm cuối `src/pages/Movies.css`

```css
.movies-k__adv {
  margin-top: var(--sp-3);
  border-top: var(--bw-1) solid var(--border);
  padding-top: var(--sp-3);
}
.movies-k__adv summary {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  letter-spacing: 0.06em;
  color: var(--text-dim);
  cursor: pointer;
}
.movies-k__advrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  margin-top: var(--sp-3);
}
.movies-k__chipset {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.movies-k__advlabel {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--text-dim);
}
.movies-k__clear {
  margin-left: auto;
  border: var(--bw-1) solid var(--red);
  background: transparent;
  color: var(--red);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.movies-k__clear:hover {
  background: var(--red);
  color: #fff;
}
```

- [ ] **Step 4: Cổng + kiểm mắt**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run build`
Expected: xanh, 0 warning. (Chú ý exhaustive-deps: `genres`/`fmt` đã bọc `useMemo` — không tạo mảng mới trần trong deps.)

Kiểm: bấm chip IMAX → URL `?fmt=IMAX` + số phim giảm; chọn ≥8 → `?rating=8`; "Xóa lọc" → URL trống + full list; back/forward khôi phục lọc; vào `/movies?q=aveng` từ trang search → ô tên có "aveng".

- [ ] **Step 5: Screenshot + commit**

Chụp desktop+mobile `/movies` với vài lọc bật, Artifact gallery.

```bash
git add src/pages/Movies.tsx src/pages/Movies.css
git commit -m "feat(GD4-search): Movies loc nang cao (da the loai/diem/thoi luong/dinh dang) + URL sync + normalize

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: E2E smoke + cập nhật CLAUDE.md

**Files:**
- Modify: `e2e/smoke.spec.ts` (+3 test đọc)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: app đã chạy (webServer `npm run dev`).
- Produces: (không có)

- [ ] **Step 1: Thêm test smoke** — cuối `e2e/smoke.spec.ts` (trong khối `test.describe` hiện có; xem cấu trúc file trước để khớp `test(...)` và selector)

```ts
test("GlobalSearch dropdown + Enter toi /search", async ({ page }) => {
  await page.goto("/movies");
  const box = page.getByRole("combobox", {
    name: /Tìm phim, rạp/,
  });
  await box.fill("aveng");
  // dropdown hiện ít nhất 1 option
  await expect(page.locator(".gsearch__item").first()).toBeVisible();
  await box.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=aveng/);
});

test("/search hien khu ket qua", async ({ page }) => {
  await page.goto("/search?q=a");
  // ít nhất một section render (phim hoặc rạp hoặc suất)
  await expect(page.locator(".search-k__sechd").first()).toBeVisible();
});

test("Movies loc dinh dang doi URL", async ({ page }) => {
  await page.goto("/movies");
  await page.getByRole("button", { name: "IMAX", exact: true }).click();
  await expect(page).toHaveURL(/fmt=IMAX/);
});
```

> **Kiểm lúc thực thi:** mở `e2e/smoke.spec.ts` xem có `test.describe` bọc không + cách import `test`/`expect` (`@playwright/test`). Đặt 3 test vào đúng scope. Nếu smoke login trước ở `beforeEach`, các test này vẫn chạy được (chỉ đọc). Selector `combobox` name phải khớp `aria-label` thật ("Tìm phim, rạp, suất chiếu").

- [ ] **Step 2: Chạy e2e**

Run: `npm run e2e -- smoke`
Expected: tất cả smoke PASS (bao gồm 3 test mới).

- [ ] **Step 3: Cập nhật CLAUDE.md**

Trong mục Routing, thêm `/search` vào danh sách route:

```
`/search` Search (tìm phim + rạp + suất chiếu, đọc `?q=`) ·
```

Trong mục `src/lib`, thêm `search.ts`:

```
`src/lib/search.ts` — `normalize` (bỏ dấu tiếng Việt + hạ thường), `matches`, `scoreMatch`; dùng chung cho GlobalSearch, trang `/search`, và tìm-theo-tên ở Movies (colocated `search.test.ts`).
```

Trong mục components, thêm `GlobalSearch`:

```
`components/GlobalSearch` (ô search toàn cục trên Navbar: dropdown phim/rạp/suất chiếu, a11y bàn phím, Enter → `/search?q=`).
```

Ghi Movies filters URL-synced trong mô tả Movies (nếu có), và e2e: smoke tăng số test.

- [ ] **Step 4: Cổng đầy đủ**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`
Expected: tất cả xanh, 0 warning.

- [ ] **Step 5: Commit + push**

```bash
git add e2e/smoke.spec.ts CLAUDE.md
git commit -m "test(GD4-search): e2e smoke (GlobalSearch/search/loc) + cap nhat CLAUDE.md

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

> Push cả 5 commit sau khi CI xác nhận xanh (hoặc push từng lát nếu muốn contribution graph cập nhật sớm — theo thói quen direct-to-main).

---

## Self-Review

**1. Spec coverage:**
- Ô search Navbar (2.1) → Task 2 ✅
- Trang `/search` 3 khu (2.2) → Task 3 ✅
- Movies 4 lọc + URL sync (2.3) → Task 4 ✅
- Tìm không dấu (lõi) → Task 1 ✅ (dùng ở Task 2/3/4)
- Điều hướng gắn kết `/movies?q=` → Task 3 (nút "Lọc chi tiết") + Task 4 (đọc `q`) ✅
- Testing unit + e2e → Task 1 + Task 5 ✅
- Suất chiếu "sắp tới" `time >= now` → Task 2/3 ✅
- Không endpoint/migration/dep → toàn plan chỉ file client ✅

**2. Placeholder scan:** Không có TBD/TODO logic. Hai chỗ "copy lúc thực thi" (`.venue-k` CSS từ Cinemas.css; kiểm cấu trúc `smoke.spec.ts`) là chỉ dẫn có chủ đích kèm nguồn chính xác, không phải placeholder logic.

**3. Type consistency:** `normalize`/`matches`/`scoreMatch` chữ ký thống nhất Task 1↔2↔3↔4. `ShowResult` khai báo giống nhau ở Task 2 và Task 3. Biến URL (`q`/`genres`/`rating`/`dur`/`fmt`/`city`/`date`/`sort`) nhất quán Task 4. `setParam(key,value,def)` / `toggleInCsv(key,item)` dùng đồng nhất.
