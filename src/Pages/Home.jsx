import { useEffect, useState } from "react";
import { getMovies } from "../Services/api";
import { useNavigate } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "./Home.css";

const GENRE_COLORS = {
  Action: "#e63030",
  "Sci-Fi": "#3090e6",
  Horror: "#9b30e6",
  Drama: "#e6a030",
  Default: "#555"
};

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [featured, setFeatured] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getMovies().then(data => {
      setMovies(data);
      setFeatured(data[0]);
    });
  }, []);

  if (!featured) return (
    <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div className="page home-page">
      <Navbar />

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-gradient" />
          <div className="hero-noise" />
        </div>

        <div className="hero-content">
          <div className="hero-meta">
            <span className="tag">Lựa chọn hàng đầu tuần</span>
            <span className="hero-rating">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#e63030" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              8.9 Điểm
            </span>
            <span className="hero-genre">{featured.genre} · {featured.duration} PHÚT</span>
          </div>

          <h1 className="hero-title">
            {featured.title.split(" ").map((word, i) => (
              <span key={i} className={i % 2 === 1 ? "red" : ""}>{word} </span>
            ))}
          </h1>

          <p className="hero-description">{featured.description}</p>

          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate(`/movie/${featured.id}`)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ marginRight: 8 }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Đặt vé
            </button>
            <button className="btn-secondary" onClick={() => navigate(`/movie/${featured.id}`)}>Chi tiết</button>
          </div>
        </div>

        <div className="hero-side-image" />
      </section>

      {/* TRENDING */}
      <section className="trending-section">
        <div className="section-header">
          <div>
            <div className="section-label">Đang chiếu</div>
            <h2 className="section-title">Thịnh hành</h2>
          </div>
          <button className="view-all" onClick={() => navigate("/movies")}>Xem tất cả</button>
        </div>

        <div className="movie-grid">
          {movies.map(movie => (
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
      </section>

      {/* NEW RELEASES FEATURE SECTION */}
      <section className="releases-section">
        <div className="section-label">Phim mới</div>
        <h2 className="section-title" style={{ marginBottom: 8, marginTop: 4 }}>Bom tấn mới nhất</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 32 }}>
          Trải nghiệm những bom tấn mới nhất trong các phòng chiếu hiện đại của chúng tôi.
        </p>

        <div className="releases-grid">
          <div className="release-featured" onClick={() => navigate(`/movie/${movies[2]?.id || 1}`)}>
            <div className="release-featured-bg" />
            <div className="release-featured-content">
              <span className="tag" style={{ background: "#9b30e6", marginBottom: 12 }}>Premium Max</span>
              <h3 className="release-featured-title">{movies[2]?.title || "Interstellar"}</h3>
              <p className="release-featured-desc">{movies[2]?.description}</p>
              <button className="btn-secondary" style={{ marginTop: 20, padding: "10px 20px", fontSize: 12 }}>
                Chọn ghế
              </button>
            </div>
          </div>

          <div className="release-side">
            {movies.slice(0, 2).map(m => (
              <div key={m.id} className="release-card" onClick={() => navigate(`/movie/${m.id}`)}>
                <div className="release-card-img">
                  <span style={{ fontSize: 32 }}>🎬</span>
                </div>
                <div className="release-card-info">
                  <h4>{m.title}</h4>
                  <p>{m.description}</p>
                  <span className="section-label" style={{ fontSize: 10, color: "var(--red)" }}>
                    Đặt vé →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
