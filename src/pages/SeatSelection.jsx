import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getShowtime, getMovie, getRoom, getCinema, getBookings, createBooking } from "services/api";
import { buildSeatLayout, bookedSeatSet, priceOf, vipPrice, SERVICE_FEE } from "lib/pricing";
import { useAuth } from "context/AuthContext";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import "./SeatSelection.css";

export default function SeatSelection() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [showtime, setShowtime] = useState(null);
  const [movie, setMovie] = useState(null);
  const [room, setRoom] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [booked, setBooked] = useState(new Set());
  const [selected, setSelected] = useState([]); // seat objects {seatNumber,row,col,isVip}
  const [name, setName] = useState(user?.fullName || "");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const st = await getShowtime(showtimeId);
      setShowtime(st);
      const [m, r, bookings] = await Promise.all([
        getMovie(st.movieId), getRoom(st.roomId), getBookings()
      ]);
      setMovie(m); setRoom(r);
      setBooked(bookedSeatSet({ ...st, id: Number(st.id) }, bookings));
      getCinema(r.cinemaId).then(setCinema);
    })();
  }, [showtimeId]);

  const layout = buildSeatLayout(room);
  const base = showtime?.price || 0;

  const toggle = (seat) => {
    if (booked.has(seat.seatNumber)) return;
    setSelected(prev => prev.find(s => s.seatNumber === seat.seatNumber)
      ? prev.filter(s => s.seatNumber !== seat.seatNumber)
      : [...prev, seat]);
  };

  const stdCount = selected.filter(s => !s.isVip).length;
  const vipCount = selected.filter(s => s.isVip).length;
  const seatTotal = selected.reduce((sum, s) => sum + priceOf(s, base), 0);
  const serviceFee = selected.length > 0 ? SERVICE_FEE : 0;
  const total = seatTotal + serviceFee;

  const handleBooking = async () => {
    if (!name.trim() || selected.length === 0) return;
    setLoading(true);
    await createBooking({
      movieId: showtime.movieId,
      showtimeId: Number(showtimeId),
      cinemaId: room.cinemaId,
      roomId: room.id,
      seats: selected.map(s => s.seatNumber),
      seatTypes: { standard: stdCount, vip: vipCount },
      userId: user?.id,
      userName: name || user?.fullName,
      totalPrice: total,
      createdAt: new Date().toISOString()
    });
    setLoading(false);
    setConfirmed(true);
    setTimeout(() => navigate("/tickets"), 2000);
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" }) : "";
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

  if (confirmed) return (
    <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div className="booked-icon">✓</div>
      <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 2 }}>Đặt vé thành công!</h2>
      <p style={{ color: "var(--text-muted)" }}>Đang chuyển tới trang vé của bạn...</p>
    </div>
  );

  return (
    <div className="page seat-page">
      <Navbar back={movie ? `/movie/${movie.id}` : "/"} />
      <div className="seat-layout">
        <div className="seat-map-container">
          <div className="screen-container"><div className="screen-glow" /><div className="screen-label">MÀN HÌNH CHIẾU</div></div>
          <div className="seat-map">
            {layout.map(({ row, seats }) => (
              <div key={row} className="seat-row">
                <span className="row-label">{row}</span>
                <div className="seats-in-row">
                  {seats.map(seat => {
                    const isBooked = booked.has(seat.seatNumber);
                    const isSel = selected.find(s => s.seatNumber === seat.seatNumber);
                    return (
                      <button key={seat.seatNumber}
                        className={`seat ${seat.isVip ? "vip" : ""} ${isBooked ? "booked" : ""} ${isSel ? "selected" : ""}`}
                        disabled={isBooked} title={`${seat.seatNumber}${seat.isVip ? " · VIP" : ""}`}
                        onClick={() => toggle(seat)}>
                        {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                      </button>
                    );
                  })}
                </div>
                <span className="row-label">{row}</span>
              </div>
            ))}
          </div>
          <div className="seat-legend">
            <div className="legend-item"><div className="legend-dot available" /><span>Trống</span></div>
            <div className="legend-item"><div className="legend-dot vip-dot" /><span>VIP</span></div>
            <div className="legend-item"><div className="legend-dot selected-dot" /><span>Đang chọn</span></div>
            <div className="legend-item"><div className="legend-dot reserved" /><span>Đã đặt</span></div>
          </div>
        </div>

        <div className="booking-panel">
          {movie && (
            <div className="booking-movie-info">
              <div className="booking-movie-poster"><span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: "rgba(255,255,255,0.1)" }}>{movie.title[0]}</span></div>
              <div>
                <h2 className="booking-movie-title">{movie.title}</h2>
                <p className="booking-movie-meta">{movie.genre.toUpperCase()} · {movie.duration} PHÚT</p>
                <p className="booking-cinema-line">{cinema?.name} · {room?.name} · {room?.type}</p>
                <div className="booking-info-grid">
                  <div className="booking-info-cell"><span className="booking-info-label">Ngày</span><span className="booking-info-value">{fmtDate(showtime?.time)}</span></div>
                  <div className="booking-info-cell"><span className="booking-info-label">Giờ</span><span className="booking-info-value">{fmtTime(showtime?.time)}</span></div>
                </div>
                <div className="booking-info-cell" style={{ marginTop: 12 }}>
                  <span className="booking-info-label">Ghế đã chọn</span>
                  <span className="booking-info-value selected-seats-display">{selected.length ? selected.map(s => s.seatNumber).join(", ") : "Chưa chọn"}</span>
                </div>
              </div>
            </div>
          )}
          <div className="booking-name-field">
            <label className="section-label" style={{ display: "block", marginBottom: 10 }}>Tên của bạn</label>
            <input className="name-input" placeholder="Tên của bạn" readOnly={!!user} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="price-breakdown">
            <div className="price-row"><span>Ghế thường (×{stdCount})</span><span>{(stdCount * base).toLocaleString("vi-VN")}₫</span></div>
            <div className="price-row"><span>Ghế VIP (×{vipCount})</span><span>{(vipCount * vipPrice(base)).toLocaleString("vi-VN")}₫</span></div>
            <div className="price-row"><span>Phí dịch vụ</span><span>{serviceFee.toLocaleString("vi-VN")}₫</span></div>
            <div className="price-row total"><span>TỔNG CỘNG</span><span className="total-amount">{total.toLocaleString("vi-VN")}₫</span></div>
          </div>
          <button className="btn-primary confirm-btn" disabled={selected.length === 0 || !name.trim() || loading} onClick={handleBooking}>
            {loading ? "Đang xử lý..." : "Xác nhận đặt vé"}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
