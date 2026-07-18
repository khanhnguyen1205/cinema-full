import { useEffect, useMemo, useState } from "react";
import {
  getMovies,
  getAllShowtimes,
  getRooms,
  getCinemas,
  getCities,
} from "services/api";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import "./Movies.css";

const StarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#e6b800" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const GENRE_COLORS = {
  Action: "#e63030",
  "Sci-Fi": "#3090e6",
  Horror: "#9b30e6",
  Drama: "#e6a030",
  Comedy: "#e6c030",
  Crime: "#c0392b",
  Animation: "#30c0a0",
  Romance: "#e63080",
  Default: "#555",
};

const SORTS = [
  { value: "name-asc", label: "Tên A→Z" },
  { value: "name-desc", label: "Tên Z→A" },
  { value: "dur-asc", label: "Thời lượng ↑" },
  { value: "dur-desc", label: "Thời lượng ↓" },
];

export default function Movies() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Cho phép trang chủ chuyển sang đây với thể loại lọc sẵn (router state)
  const location = useLocation();
  const [genre, setGenre] = useState(location.state?.genre || "Tất cả");
  const [sort, setSort] = useState("name-asc");
  // Lọc theo thành phố / ngày — dựa trên suất chiếu
  const [rows, setRows] = useState([]); // { movieId, cityId, dateKey } mỗi suất
  const [cityMap, setCityMap] = useState({}); // cityId -> tên
  const [city, setCity] = useState("Tất cả"); // cityId dạng chuỗi, hoặc "Tất cả"
  const [date, setDate] = useState("Tất cả"); // dateKey (yyyy-mm-dd), hoặc "Tất cả"
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      getMovies(),
      getAllShowtimes(),
      getRooms(),
      getCinemas(),
      getCities(),
    ]).then(([ms, sts, rooms, cinemas, cities]) => {
      setMovies(ms);
      setCityMap(Object.fromEntries(cities.map((c) => [c.id, c.name])));
      const roomCinema = Object.fromEntries(
        rooms.map((r) => [r.id, r.cinemaId]),
      );
      const cinemaCity = Object.fromEntries(
        cinemas.map((c) => [c.id, c.cityId]),
      );
      setRows(
        sts.map((s) => ({
          movieId: s.movieId,
          cityId: cinemaCity[roomCinema[s.roomId]],
          dateKey: s.time.slice(0, 10),
        })),
      );
      setLoading(false);
    });
  }, []);

  // Danh sách thể loại tự sinh từ dữ liệu (không hardcode)
  const genres = useMemo(
    () => ["Tất cả", ...Array.from(new Set(movies.map((m) => m.genre)))],
    [movies],
  );

  // Các thành phố có suất chiếu
  const cityIds = useMemo(
    () => [...new Set(rows.map((r) => r.cityId).filter(Boolean))],
    [rows],
  );

  // Ngày có suất chiếu (phụ thuộc thành phố đang chọn), tăng dần
  const dateKeys = useMemo(() => {
    const relevant =
      city === "Tất cả" ? rows : rows.filter((r) => String(r.cityId) === city);
    return [...new Set(relevant.map((r) => r.dateKey))].sort();
  }, [rows, city]);

  // Tập movieId khớp bộ lọc thành phố + ngày
  const movieIdsByShowtime = useMemo(() => {
    if (city === "Tất cả" && date === "Tất cả") return null; // không lọc
    const ids = new Set();
    rows.forEach((r) => {
      if (city !== "Tất cả" && String(r.cityId) !== city) return;
      if (date !== "Tất cả" && r.dateKey !== date) return;
      ids.add(r.movieId);
    });
    return ids;
  }, [rows, city, date]);

  const fmtDate = (k) =>
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

  return (
    <div className="page movies-page">
      <Navbar />

      <section className="movies-section">
        <div className="movies-header">
          <div className="section-label">Danh mục phim</div>
          <h1 className="movies-title">Tất cả phim</h1>
        </div>

        {/* THANH ĐIỀU KHIỂN */}
        <div className="movies-controls">
          <div className="movies-search">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="movies-search-input"
              type="text"
              placeholder="Tìm phim theo tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="movies-genres">
            {genres.map((g) => (
              <button
                key={g}
                className={`genre-chip ${genre === g ? "active" : ""}`}
                onClick={() => setGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="movies-filters">
            <select
              className="movies-sort-select"
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
                  {cityMap[cid]}
                </option>
              ))}
            </select>

            <select
              className="movies-sort-select"
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

            <div className="movies-sort">
              <label className="movies-sort-label">Sắp xếp</label>
              <select
                className="movies-sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* KẾT QUẢ */}
        {loading ? (
          <div className="movies-empty">
            <div className="loading-spinner" />
          </div>
        ) : visible.length === 0 ? (
          <div className="movies-empty">
            <p className="movies-empty-text">Không tìm thấy phim nào</p>
            <p className="movies-empty-sub">
              Thử đổi từ khóa hoặc bộ lọc khác.
            </p>
          </div>
        ) : (
          <>
            <p className="movies-count">{visible.length} phim</p>
            <div className="movie-grid">
              {visible.map((movie) => (
                <div
                  key={movie.id}
                  className="movie-card"
                  onClick={() => navigate(`/movie/${movie.id}`)}
                >
                  <div className="movie-card-image">
                    <div className="movie-card-placeholder">
                      <span className="movie-card-initial">
                        {movie.title[0]}
                      </span>
                    </div>
                    {movie.poster && (
                      <img
                        className="movie-card-poster"
                        src={movie.poster}
                        alt={movie.title}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <div className="movie-card-overlay">
                      <span
                        className="movie-card-genre"
                        style={{
                          background:
                            GENRE_COLORS[movie.genre] || GENRE_COLORS.Default,
                        }}
                      >
                        {movie.genre}
                      </span>
                    </div>
                    {movie.rating != null && (
                      <span className="movie-card-rating">
                        <StarIcon /> {movie.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="movie-card-info">
                    <h3 className="movie-card-title">{movie.title}</h3>
                    <p className="movie-card-meta">
                      {movie.genre} · {movie.duration} phút
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}
