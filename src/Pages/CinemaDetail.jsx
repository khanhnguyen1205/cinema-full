import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCinema, getShowtimesByCinema, getMovies, getRooms } from "../Services/api";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "./CinemaDetail.css";

export default function CinemaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cinema, setCinema] = useState(null);
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    getCinema(id).then(setCinema);
    getMovies().then(setMovies);
    getRooms(id).then(setRooms);
    getShowtimesByCinema(Number(id)).then(setShowtimes);
  }, [id]);

  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (k) => new Date(k).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });

  const byMovie = movies
    .map(m => ({ movie: m, sts: showtimes.filter(s => s.movieId === m.id) }))
    .filter(x => x.sts.length > 0);

  if (!cinema) return (
    <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div className="page cinema-detail-page">
      <Navbar back="/cinemas" />
      <section className="cinema-detail-section">
        <div className="section-label">Lịch chiếu tại rạp</div>
        <h1 className="cinema-detail-title">{cinema.name}</h1>
        <p className="cinema-detail-addr">{cinema.address}</p>

        {byMovie.length === 0 ? (
          <div className="cinema-empty">Rạp này chưa có suất chiếu</div>
        ) : byMovie.map(({ movie, sts }) => {
          const dates = [...new Set(sts.map(s => s.time.slice(0, 10)))].sort();
          return (
            <div key={movie.id} className="cinema-movie-block">
              <div className="cinema-movie-head">
                <h3 className="cinema-movie-title" onClick={() => navigate(`/movie/${movie.id}`)}>{movie.title}</h3>
                <span className="cinema-movie-meta">{movie.genre} · {movie.duration} phút</span>
              </div>
              {dates.map(d => (
                <div key={d} className="cinema-date-row">
                  <span className="cinema-date-label">{fmtDate(d)}</span>
                  <div className="cinema-times">
                    {sts.filter(s => s.time.slice(0, 10) === d).sort((a, b) => a.time.localeCompare(b.time)).map(s => (
                      <button key={s.id} className="time-btn" onClick={() => navigate(`/seats/${s.id}`)}>
                        {fmtTime(s.time)}
                        <span className="time-type">{roomMap[s.roomId]?.type} · {s.price.toLocaleString("vi-VN")}₫</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </section>
      <Footer />
    </div>
  );
}
