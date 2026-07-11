import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMovie, getShowtimes } from "../Services/api";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "./MovieDetail.css";

export default function MovieDetail() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedTime, setSelectedTime] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getMovie(id).then(setMovie);
    getShowtimes(id).then(data => {
      setShowtimes(data);
      if (data.length > 0) setSelectedTime(data[0].id);
    });
  }, [id]);

  if (!movie) return (
    <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="loading-spinner" />
    </div>
  );

  const dates = ["MON 28", "TUE 29", "WED 30", "THU 31"];

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="page detail-page">
      <Navbar back="/" />

      {/* HERO */}
      <div className="detail-hero">
        <div className="detail-hero-bg" />
        <div className="detail-hero-overlay" />

        <div className="detail-hero-content">
          <div className="detail-meta-top">
            <span className="tag">Now Showing</span>
            <span className="detail-rating">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#e63030">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              8.9 Rating
            </span>
            <span className="detail-genre-badge">{movie.genre} · {movie.duration} MIN</span>
          </div>

          <h1 className="detail-title">
            {movie.title.split(":").map((part, i) => (
              <span key={i}>
                {i === 0 ? (
                  <>{part.trim()}</>
                ) : (
                  <><br /><span className="red">{part.trim()}</span></>
                )}
              </span>
            ))}
          </h1>

          <p className="detail-description">{movie.description}</p>

          <div className="detail-credits">
            <div className="credit-item">
              <span className="credit-label">Genre</span>
              <span className="credit-value">{movie.genre}</span>
            </div>
            <div className="credit-item">
              <span className="credit-label">Duration</span>
              <span className="credit-value">{movie.duration} min</span>
            </div>
            <div className="credit-item">
              <span className="credit-label">Format</span>
              <span className="credit-value" style={{ color: "var(--red)" }}>IMAX 4K</span>
            </div>
          </div>
        </div>

        {/* SHOWTIMES PANEL */}
        <div className="showtimes-panel">
          <div className="showtimes-panel-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Showtimes
          </div>

          <div className="date-selector">
            {dates.map((d, i) => (
              <button
                key={i}
                className={`date-btn ${selectedDate === i ? "active" : ""}`}
                onClick={() => setSelectedDate(i)}
              >
                <span className="date-month">OCT</span>
                <span className="date-day">{d.split(" ")[1]}</span>
              </button>
            ))}
          </div>

          <div className="times-label section-label">Available Times</div>

          <div className="times-grid">
            {showtimes.length > 0 ? showtimes.map(s => (
              <button
                key={s.id}
                className={`time-btn ${selectedTime === s.id ? "active" : ""}`}
                onClick={() => setSelectedTime(s.id)}
              >
                {formatTime(s.time)}
              </button>
            )) : (
              <p style={{ color: "var(--text-muted)", fontSize: 13, gridColumn: "span 2" }}>
                No showtimes available
              </p>
            )}
          </div>

          {selectedTime && (
            <div className="showtime-price">
              {showtimes.find(s => s.id === selectedTime)?.price?.toLocaleString("vi-VN")}₫ / seat
            </div>
          )}

          <button
            className="btn-primary book-btn"
            disabled={!selectedTime}
            onClick={() => selectedTime && navigate(`/seats/${selectedTime}`)}
          >
            Book Tickets
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
