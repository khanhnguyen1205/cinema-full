import { useEffect, useMemo, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
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
import { normalize } from "lib/search";
import "./Movies.css";

const SORTS = [
  { value: "name-asc", label: "Tên A→Z" },
  { value: "name-desc", label: "Tên Z→A" },
  { value: "dur-asc", label: "Thời lượng ↑" },
  { value: "dur-desc", label: "Thời lượng ↓" },
];
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

export default function Movies() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();

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

  // ── Trạng thái đọc từ URL (nguồn sự thật) ──
  const search = params.get("q") ?? "";
  const genres = useMemo(() => {
    const raw = params.get("genres") ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [params]);
  const rating = params.get("rating") ?? "0";
  const dur = params.get("dur") ?? "all";
  const fmt = useMemo(() => {
    const raw = params.get("fmt") ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [params]);
  const city = params.get("city") ?? "Tất cả";
  const date = params.get("date") ?? "Tất cả";
  const sort = params.get("sort") ?? "name-asc";

  // Genre truyền qua location.state (từ ô thể loại ở Home): đẩy vào URL 1 lần
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const g = (location.state as { genre?: string } | null)?.genre;
    if (g && g !== "Tất cả" && !params.get("genres")) {
      const next = new URLSearchParams(params);
      next.set("genres", g);
      setParams(next, { replace: true });
    }
    // chỉ chạy 1 lần lúc mount để nạp genre khởi tạo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ghi URL ──
  const setParam = (key: string, value: string, def: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === def) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const toggleInCsv = (key: string, item: string) => {
    const cur = (params.get(key) ?? "").split(",").filter(Boolean);
    const nextArr = cur.includes(item)
      ? cur.filter((x) => x !== item)
      : [...cur, item];
    setParam(key, nextArr.join(","), "");
  };
  const clearAll = () => setParams({}, { replace: true });

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

  const allGenres = useMemo(
    () => Array.from(new Set(movies.map((m) => m.genre))),
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

  // Định dạng phòng (2D/3D/IMAX) mỗi phim có suất — suy từ rooms→showtimes
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
    if (genres.length > 0) list = list.filter((m) => genres.includes(m.genre));
    const minR = Number(rating);
    if (minR > 0) list = list.filter((m) => (m.rating ?? -1) >= minR);
    if (dur !== "all")
      list = list.filter((m) => {
        if (dur === "short") return m.duration < 90;
        if (dur === "mid") return m.duration >= 90 && m.duration <= 120;
        return m.duration > 120; // long
      });
    if (fmt.length > 0)
      list = list.filter((m) => {
        const fs = formatsByMovie.get(m.id);
        return !!fs && fmt.some((f) => fs.has(f));
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
              onChange={(e) => setParam("q", e.target.value, "")}
              aria-label="Tìm phim theo tên"
            />
          </div>

          <div className="movies-k__selects">
            <select
              value={city}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                if (e.target.value === "Tất cả") next.delete("city");
                else next.set("city", e.target.value);
                next.delete("date");
                setParams(next, { replace: true });
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
              onChange={(e) => setParam("date", e.target.value, "Tất cả")}
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
              onChange={(e) => setParam("sort", e.target.value, "name-asc")}
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
            <button
              type="button"
              className={
                "genre-k-chip" + (genres.length === 0 ? " is-active" : "")
              }
              aria-pressed={genres.length === 0}
              onClick={() => setParam("genres", "", "")}
            >
              Tất cả
            </button>
            {allGenres.map((g) => (
              <button
                key={g}
                type="button"
                className={
                  "genre-k-chip" + (genres.includes(g) ? " is-active" : "")
                }
                aria-pressed={genres.includes(g)}
                onClick={() => toggleInCsv("genres", g)}
              >
                {g}
              </button>
            ))}
          </div>

          {/* LỌC NÂNG CAO */}
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

              <div
                className="movies-k__chipset"
                role="group"
                aria-label="Định dạng"
              >
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
            <p className="movies-k__empty-sub">
              Thử đổi từ khóa hoặc bộ lọc khác.
            </p>
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
