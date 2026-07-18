import { useEffect, useMemo, useState } from "react";
import {
  getMovies,
  getCinemas,
  getCities,
  getAllShowtimes,
} from "services/api";
import { useNavigate } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import "./Home.css";

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

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#e63030" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [cities, setCities] = useState([]);
  const [showtimeCount, setShowtimeCount] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      getMovies(),
      getCinemas(),
      getCities(),
      getAllShowtimes(),
    ]).then(([m, c, ct, st]) => {
      setMovies(m);
      setCinemas(c);
      setCities(ct);
      setShowtimeCount(st.length);
    });
  }, []);

  const featured = useMemo(() => movies.slice(0, 5), [movies]);

  // Carousel tự chạy, dừng khi hover
  useEffect(() => {
    if (paused || featured.length <= 1) return;
    const t = setInterval(() => {
      setHeroIndex((i) => (i + 1) % featured.length);
    }, 6000);
    return () => clearInterval(t);
  }, [paused, featured.length]);

  // Đếm số phim theo từng thể loại (tự sinh từ dữ liệu)
  const genreStats = useMemo(() => {
    const map = new Map();
    movies.forEach((m) => map.set(m.genre, (map.get(m.genre) || 0) + 1));
    return [...map.entries()].map(([genre, count]) => ({ genre, count }));
  }, [movies]);

  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );

  if (!featured.length)
    return (
      <div
        className="page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="loading-spinner" />
      </div>
    );

  const active = featured[heroIndex];
  const prev = () =>
    setHeroIndex((i) => (i - 1 + featured.length) % featured.length);
  const next = () => setHeroIndex((i) => (i + 1) % featured.length);

  return (
    <div className="page home-page">
      <Navbar />

      {/* ===== HERO — CAROUSEL PHIM NỔI BẬT ===== */}
      <section
        className="hero"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="hero-bg">
          <div className="hero-gradient" />
          <div className="hero-noise" />
        </div>

        <div
          className="hero-side-image"
          key={"bg" + active.id}
          style={
            active.poster
              ? {
                  backgroundImage: `linear-gradient(to left, rgba(0,0,0,0) 0%, rgba(10,10,10,0.6) 40%, rgba(10,10,10,1) 80%), url(${active.poster})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />

        <div className="hero-content" key={active.id}>
          <div className="hero-meta">
            <span className="tag">Phim nổi bật</span>
            {active.rating != null && (
              <span className="hero-rating">
                <StarIcon /> {active.rating.toFixed(1)} Điểm
              </span>
            )}
            <span className="hero-genre">
              {active.genre} · {active.duration} PHÚT
            </span>
          </div>

          <h1 className="hero-title">
            {active.title.split(" ").map((word, i) => (
              <span key={i} className={i % 2 === 1 ? "red" : ""}>
                {word}{" "}
              </span>
            ))}
          </h1>

          <p className="hero-description">{active.description}</p>

          <div className="hero-actions">
            <button
              className="btn-primary"
              onClick={() => navigate(`/movie/${active.id}`)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="white"
                style={{ marginRight: 8 }}
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Đặt vé
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate(`/movie/${active.id}`)}
            >
              Chi tiết
            </button>
          </div>

          <div className="hero-dots">
            {featured.map((m, i) => (
              <button
                key={m.id}
                className={`hero-dot ${i === heroIndex ? "active" : ""}`}
                aria-label={`Phim nổi bật ${i + 1}`}
                onClick={() => setHeroIndex(i)}
              />
            ))}
          </div>
        </div>

        <button
          className="hero-arrow hero-arrow-prev"
          aria-label="Phim trước"
          onClick={prev}
        >
          ‹
        </button>
        <button
          className="hero-arrow hero-arrow-next"
          aria-label="Phim sau"
          onClick={next}
        >
          ›
        </button>
      </section>

      {/* ===== PHIM ĐANG CHIẾU (CHỌN LỌC) ===== */}
      <section className="trending-section">
        <div className="section-header">
          <div>
            <div className="section-label">Suất chiếu hôm nay</div>
            <h2 className="section-title">Phim đang chiếu</h2>
          </div>
          <button className="view-all" onClick={() => navigate("/movies")}>
            Xem tất cả →
          </button>
        </div>

        <div className="movie-grid">
          {movies.slice(0, 8).map((movie) => (
            <div
              key={movie.id}
              className="movie-card"
              onClick={() => navigate(`/movie/${movie.id}`)}
            >
              <div className="movie-card-image">
                <div className="movie-card-placeholder">
                  <span className="movie-card-initial">{movie.title[0]}</span>
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
      </section>

      {/* ===== DUYỆT THEO THỂ LOẠI ===== */}
      <section className="genres-section">
        <div className="section-header">
          <div>
            <div className="section-label">Khám phá</div>
            <h2 className="section-title">Duyệt theo thể loại</h2>
          </div>
        </div>

        <div className="genre-grid">
          {genreStats.map(({ genre, count }) => (
            <button
              key={genre}
              className="genre-tile"
              onClick={() => navigate("/movies", { state: { genre } })}
            >
              <span
                className="genre-tile-bar"
                style={{
                  background: GENRE_COLORS[genre] || GENRE_COLORS.Default,
                }}
              />
              <span className="genre-tile-name">{genre}</span>
              <span className="genre-tile-count">{count} phim</span>
            </button>
          ))}
        </div>
      </section>

      {/* ===== HỆ THỐNG RẠP + THỐNG KÊ + CTA ===== */}
      <section className="cinemas-section">
        <div className="stats-strip">
          <div className="stat">
            <span className="stat-num">{movies.length}</span>
            <span className="stat-label">Phim</span>
          </div>
          <div className="stat">
            <span className="stat-num">{cinemas.length}</span>
            <span className="stat-label">Rạp chiếu</span>
          </div>
          <div className="stat">
            <span className="stat-num">{cities.length}</span>
            <span className="stat-label">Thành phố</span>
          </div>
          <div className="stat">
            <span className="stat-num">{showtimeCount}</span>
            <span className="stat-label">Suất chiếu</span>
          </div>
        </div>

        <div className="section-header cinemas-header">
          <div>
            <div className="section-label">Toàn quốc</div>
            <h2 className="section-title">Hệ thống rạp</h2>
          </div>
          <button className="view-all" onClick={() => navigate("/cinemas")}>
            Tất cả rạp →
          </button>
        </div>

        <div className="cinema-grid">
          {cinemas.map((c) => (
            <button
              key={c.id}
              className="cinema-card"
              onClick={() => navigate(`/cinema/${c.id}`)}
            >
              <span className="cinema-card-mark" />
              <span className="cinema-card-body">
                <span className="cinema-card-name">{c.name}</span>
                <span className="cinema-card-city">
                  {cityName[c.cityId] || "—"}
                </span>
              </span>
              <span className="cinema-card-arrow">→</span>
            </button>
          ))}
        </div>

        <div className="home-cta">
          <div className="home-cta-content">
            <h2 className="home-cta-title">
              Sẵn sàng cho <span className="red">suất chiếu</span> tiếp theo?
            </h2>
            <p className="home-cta-sub">
              Chọn phim, chọn ghế và đặt vé chỉ trong vài bước.
            </p>
          </div>
          <button
            className="btn-primary home-cta-btn"
            onClick={() => navigate("/movies")}
          >
            Đặt vé ngay
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
