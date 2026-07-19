import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
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
