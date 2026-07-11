import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSeats, getAllShowtimes, getMovie, createBooking, updateSeat } from "../Services/api";
import { useAuth } from "../Context/AuthContext";
import Navbar from "../Components/Navbar";
import Footer from "../Components/Footer";
import "./SeatSelection.css";

export default function SeatSelection() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();

  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState([]);
  const [showtime, setShowtime] = useState(null);
  const [movie, setMovie] = useState(null);
  const { user } = useAuth();
  const [name, setName] = useState(user?.fullName || "");
  const [booked, setBooked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSeats(showtimeId).then(setSeats);
    getAllShowtimes().then(data => {
      const st = data.find(s => s.id == showtimeId);
      setShowtime(st);
      if (st) getMovie(st.movieId).then(setMovie);
    });
  }, [showtimeId]);

  const rows = seats.reduce((acc, seat) => {
    if (!acc[seat.row]) acc[seat.row] = [];
    acc[seat.row].push(seat);
    return acc;
  }, {});

  const toggleSeat = (seat) => {
    if (seat.isBooked) return;
    setSelected(prev =>
      prev.find(s => s.id === seat.id)
        ? prev.filter(s => s.id !== seat.id)
        : [...prev, seat]
    );
  };

  const handleBooking = async () => {
    if (!name.trim() || selected.length === 0) return;
    setLoading(true);

    const total = selected.length * (showtime?.price || 0);
    await createBooking({
      movieId: showtime?.movieId,
      showtimeId: parseInt(showtimeId),
      seats: selected.map(s => s.seatNumber),
      userId: user?.id,
      userName: name || user?.fullName,
      totalPrice: total,
      createdAt: new Date().toISOString()
    });

    for (let s of selected) {
      await updateSeat(s.id);
    }

    setLoading(false);
    setBooked(true);
    setTimeout(() => navigate("/tickets"), 2000);
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const total = selected.length * (showtime?.price || 0);
  const serviceFee = selected.length > 0 ? 15000 : 0;

  if (booked) return (
    <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div className="booked-icon">✓</div>
      <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 2 }}>Booking Confirmed!</h2>
      <p style={{ color: "var(--text-muted)" }}>Redirecting to your tickets...</p>
    </div>
  );

  return (
    <div className="page seat-page">
      <Navbar back={movie ? `/movie/${movie.id}` : "/"} />

      <div className="seat-layout">
        {/* LEFT: SEAT MAP */}
        <div className="seat-map-container">
          <div className="screen-container">
            <div className="screen-glow" />
            <div className="screen-label">THE CINEMATIC SCREEN</div>
          </div>

          <div className="seat-map">
            {Object.entries(rows).map(([row, rowSeats]) => (
              <div key={row} className="seat-row">
                <span className="row-label">{row}</span>
                <div className="seats-in-row">
                  {rowSeats.sort((a, b) => a.col - b.col).map((seat, i) => {
                    const isSelected = selected.find(s => s.id === seat.id);
                    return (
                      <button
                        key={seat.id}
                        className={`seat ${seat.isBooked ? "booked" : ""} ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleSeat(seat)}
                        disabled={seat.isBooked}
                        title={seat.seatNumber}
                      >
                        {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                      </button>
                    );
                  })}
                </div>
                <span className="row-label">{row}</span>
              </div>
            ))}
          </div>

          <div className="seat-legend">
            <div className="legend-item">
              <div className="legend-dot available" />
              <span>Available</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot selected-dot" />
              <span>Selected</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot reserved" />
              <span>Reserved</span>
            </div>
          </div>
        </div>

        {/* RIGHT: BOOKING PANEL */}
        <div className="booking-panel">
          {movie && (
            <div className="booking-movie-info">
              <div className="booking-movie-poster">
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: "rgba(255,255,255,0.1)" }}>
                  {movie.title[0]}
                </span>
              </div>
              <div>
                <h2 className="booking-movie-title">{movie.title}</h2>
                <p className="booking-movie-meta">{movie.genre.toUpperCase()} · {movie.duration} MIN</p>

                <div className="booking-info-grid">
                  <div className="booking-info-cell">
                    <span className="booking-info-label">Date</span>
                    <span className="booking-info-value">{formatDate(showtime?.time)}</span>
                  </div>
                  <div className="booking-info-cell">
                    <span className="booking-info-label">Time</span>
                    <span className="booking-info-value">{formatTime(showtime?.time)}</span>
                  </div>
                </div>

                <div className="booking-info-cell" style={{ marginTop: 12 }}>
                  <span className="booking-info-label">Selected Seats</span>
                  <span className="booking-info-value selected-seats-display">
                    {selected.length > 0 ? selected.map(s => s.seatNumber).join(", ") : "None"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="booking-name-field">
            <label className="section-label" style={{ display: "block", marginBottom: 10 }}>Your Name</label>
            <input
              className="name-input"
              placeholder="Tên của bạn"
              readOnly={!!user}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="price-breakdown">
            <div className="price-row">
              <span>Adult Ticket (×{selected.length})</span>
              <span>{(selected.length * (showtime?.price || 0)).toLocaleString("vi-VN")}₫</span>
            </div>
            <div className="price-row">
              <span>Service Fee</span>
              <span>{serviceFee.toLocaleString("vi-VN")}₫</span>
            </div>
            <div className="price-row total">
              <span>TOTAL</span>
              <span className="total-amount">{(total + serviceFee).toLocaleString("vi-VN")}₫</span>
            </div>
          </div>

          <button
            className="btn-primary confirm-btn"
            disabled={selected.length === 0 || !name.trim() || loading}
            onClick={handleBooking}
          >
            {loading ? "Processing..." : "Confirm Booking"}
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
