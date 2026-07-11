import { useEffect, useMemo, useState } from "react";
import { getMovies } from "../Services/api";
import { useNavigate } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "./Movies.css";

const GENRE_COLORS = {
  Action: "#e63030",
  "Sci-Fi": "#3090e6",
  Horror: "#9b30e6",
  Drama: "#e6a030",
  Default: "#555"
};

const SORTS = [
  { value: "name-asc", label: "Tên A→Z" },
  { value: "name-desc", label: "Tên Z→A" },
  { value: "dur-asc", label: "Thời lượng ↑" },
  { value: "dur-desc", label: "Thời lượng ↓" }
];

export default function Movies() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("Tất cả");
  const [sort, setSort] = useState("name-asc");
  const navigate = useNavigate();

  useEffect(() => {
    getMovies().then(data => {
      setMovies(data);
      setLoading(false);
    });
  }, []);

  // Danh sách thể loại tự sinh từ dữ liệu (không hardcode)
  const genres = useMemo(
    () => ["Tất cả", ...Array.from(new Set(movies.map(m => m.genre)))],
    [movies]
  );

  const visible = useMemo(() => {
    let list = movies;
    if (genre !== "Tất cả") list = list.filter(m => m.genre === genre);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(m => m.title.toLowerCase().includes(q));
    const sorted = [...list];
    switch (sort) {
      case "name-desc": sorted.sort((a, b) => b.title.localeCompare(a.title)); break;
      case "dur-asc": sorted.sort((a, b) => a.duration - b.duration); break;
      case "dur-desc": sorted.sort((a, b) => b.duration - a.duration); break;
      default: sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    return sorted;
  }, [movies, genre, search, sort]);

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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="movies-search-input"
              type="text"
              placeholder="Tìm phim theo tên..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="movies-genres">
            {genres.map(g => (
              <button
                key={g}
                className={`genre-chip ${genre === g ? "active" : ""}`}
                onClick={() => setGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="movies-sort">
            <label className="movies-sort-label">Sắp xếp</label>
            <select
              className="movies-sort-select"
              value={sort}
              onChange={e => setSort(e.target.value)}
            >
              {SORTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KẾT QUẢ */}
        {loading ? (
          <div className="movies-empty"><div className="loading-spinner" /></div>
        ) : visible.length === 0 ? (
          <div className="movies-empty">
            <p className="movies-empty-text">Không tìm thấy phim nào</p>
            <p className="movies-empty-sub">Thử đổi từ khóa hoặc bộ lọc khác.</p>
          </div>
        ) : (
          <>
            <p className="movies-count">{visible.length} phim</p>
            <div className="movie-grid">
              {visible.map(movie => (
                <div
                  key={movie.id}
                  className="movie-card"
                  onClick={() => navigate(`/movie/${movie.id}`)}
                >
                  <div className="movie-card-image">
                    <div className="movie-card-placeholder">
                      <span className="movie-card-initial">{movie.title[0]}</span>
                    </div>
                    <div className="movie-card-overlay">
                      <span className="movie-card-genre" style={{
                        background: GENRE_COLORS[movie.genre] || GENRE_COLORS.Default
                      }}>{movie.genre}</span>
                    </div>
                  </div>
                  <div className="movie-card-info">
                    <h3 className="movie-card-title">{movie.title}</h3>
                    <p className="movie-card-meta">{movie.genre} · {movie.duration} phút</p>
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
