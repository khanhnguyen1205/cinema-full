import { useEffect, useMemo, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { genreLabel } from "i18n/genres";
import { formatDate } from "i18n/format";
import "./Movies.css";

const SORTS = [
  { value: "name-asc", key: "movies.sortNameAsc" },
  { value: "name-desc", key: "movies.sortNameDesc" },
  { value: "dur-asc", key: "movies.sortDurAsc" },
  { value: "dur-desc", key: "movies.sortDurDesc" },
];
const DURATIONS = [
  { value: "all", key: "movies.durAll" },
  { value: "short", key: "movies.durShort" },
  { value: "mid", key: "movies.durMid" },
  { value: "long", key: "movies.durLong" },
];
const RATINGS = [
  { value: "0", key: "movies.allRatings" },
  { value: "7", label: "≥ 7" },
  { value: "8", label: "≥ 8" },
  { value: "9", label: "≥ 9" },
];
const FORMATS = ["2D", "3D", "IMAX"] as const;

// Giá trị "không lọc" của hai select thành phố/ngày. Là một sentinel nằm trong
// URL (?city=…&date=…), KHÔNG phải chữ hiển thị — nhãn đi qua t("movies.*").
const ALL = "Tất cả";

// Tham số dạng "a,b,c" (genres, fmt) -> mảng.
function csvParam(params: URLSearchParams, key: string): string[] {
  return (params.get(key) ?? "").split(",").filter(Boolean);
}

export default function Movies() {
  const location = useLocation();
  const { t } = useTranslation();
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
  const genres = useMemo(() => csvParam(params, "genres"), [params]);
  const rating = params.get("rating") ?? "0";
  const dur = params.get("dur") ?? "all";
  const fmt = useMemo(() => csvParam(params, "fmt"), [params]);
  const city = params.get("city") ?? ALL;
  const date = params.get("date") ?? ALL;
  const sort = params.get("sort") ?? "name-asc";

  // Genre truyền qua location.state (từ ô thể loại ở Home): đẩy vào URL 1 lần
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const g = (location.state as { genre?: string } | null)?.genre;
    if (g && g !== ALL && !params.get("genres")) {
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
    const cur = csvParam(params, key);
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
      city === ALL ? rows : rows.filter((r) => String(r.cityId) === city);
    return [...new Set(relevant.map((r) => r.dateKey))].sort();
  }, [rows, city]);

  const movieIdsByShowtime = useMemo(() => {
    if (city === ALL && date === ALL) return null;
    const ids = new Set<number>();
    rows.forEach((r) => {
      if (city !== ALL && String(r.cityId) !== city) return;
      if (date !== ALL && r.dateKey !== date) return;
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
    formatDate(k, {
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
    city !== ALL ||
    date !== ALL;

  const isLoading = moviesQ.isLoading;
  const isError = moviesQ.isError;

  return (
    <div className="page movies-page">
      <Navbar />

      <Container>
        <header className="movies-k__header">
          <span className="movies-k__label">{t("movies.eyebrow")}</span>
          <h1 className="movies-k__title">
            <KineticHeading text={t("movies.title")} />
          </h1>
          {!isLoading && !isError && (
            <span className="movies-k__count">
              {t("movies.count", { count: visible.length })}
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
              placeholder={t("movies.searchPlaceholder")}
              value={search}
              onChange={(e) => setParam("q", e.target.value, "")}
              aria-label={t("movies.searchPlaceholder")}
            />
          </div>

          <div className="movies-k__selects">
            <select
              value={city}
              onChange={(e) => {
                // Đổi thành phố thì ngày đã chọn có thể không còn suất -> bỏ luôn.
                const next = new URLSearchParams(params);
                if (e.target.value === ALL) next.delete("city");
                else next.set("city", e.target.value);
                next.delete("date");
                setParams(next, { replace: true });
              }}
              aria-label={t("movies.allCities")}
            >
              <option value={ALL}>{t("movies.allCities")}</option>
              {cityIds.map((cid) => (
                <option key={cid} value={String(cid)}>
                  {cityName[cid]}
                </option>
              ))}
            </select>
            <select
              value={date}
              onChange={(e) => setParam("date", e.target.value, ALL)}
              aria-label={t("movies.allDates")}
            >
              <option value={ALL}>{t("movies.allDates")}</option>
              {dateKeys.map((dk) => (
                <option key={dk} value={dk}>
                  {fmtDate(dk)}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setParam("sort", e.target.value, "name-asc")}
              aria-label={t("movies.sortLabel")}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {t(s.key)}
                </option>
              ))}
            </select>
          </div>

          <div
            className="movies-k__genres"
            role="group"
            aria-label={t("movies.genreLabel")}
          >
            <button
              type="button"
              className={
                "genre-k-chip" + (genres.length === 0 ? " is-active" : "")
              }
              aria-pressed={genres.length === 0}
              onClick={() => setParam("genres", "", "")}
            >
              {t("common.all")}
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
                {genreLabel(g)}
              </button>
            ))}
          </div>

          {/* LỌC NÂNG CAO */}
          <details className="movies-k__adv" open>
            <summary>{t("movies.advanced")}</summary>
            <div className="movies-k__advrow">
              <div
                className="movies-k__chipset"
                role="group"
                aria-label={t("movies.ratingLabel")}
              >
                <span className="movies-k__advlabel">
                  {t("movies.ratingLabel")}
                </span>
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
                    {r.key ? t(r.key) : r.label}
                  </button>
                ))}
              </div>

              <div
                className="movies-k__chipset"
                role="group"
                aria-label={t("movies.formatLabel")}
              >
                <span className="movies-k__advlabel">
                  {t("movies.formatLabel")}
                </span>
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
                aria-label={t("movies.durAll")}
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {t(d.key)}
                  </option>
                ))}
              </select>

              {hasFilters && (
                <button
                  type="button"
                  className="movies-k__clear"
                  onClick={clearAll}
                >
                  {t("common.clear")}
                </button>
              )}
            </div>
          </details>
        </div>

        {/* KẾT QUẢ */}
        {isError ? (
          <div className="movies-k__empty">
            <p>{t("common.loadError")}</p>
            <Button onClick={() => moviesQ.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : isLoading ? (
          <Grid min="200px">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height="320px" />
            ))}
          </Grid>
        ) : visible.length === 0 ? (
          <div className="movies-k__empty">
            <p className="movies-k__empty-title">{t("movies.emptyTitle")}</p>
            <p className="movies-k__empty-sub">{t("movies.emptySub")}</p>
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
