import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getShowtime, getMovie, getRoom, getCinema, getBookings, createBooking } from "services/api";
import { buildSeatLayout, bookedSeatSet, priceOf, SERVICE_FEE, MAX_SEATS } from "lib/pricing";
import { useAuth } from "context/AuthContext";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import SeatStep from "./SeatStep";
import OrderSummary from "./OrderSummary";
import SeatHoldTimer from "./SeatHoldTimer";
import "./Booking.css";

export default function BookingWizard() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [showtime, setShowtime] = useState(null);
  const [movie, setMovie] = useState(null);
  const [room, setRoom] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [booked, setBooked] = useState(new Set());
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    (async () => {
      const st = await getShowtime(showtimeId);
      setShowtime(st);
      const [m, r, bookings] = await Promise.all([getMovie(st.movieId), getRoom(st.roomId), getBookings()]);
      setMovie(m); setRoom(r);
      setBooked(bookedSeatSet({ ...st, id: Number(st.id) }, bookings));
      getCinema(r.cinemaId).then(setCinema);
    })();
  }, [showtimeId]);

  const layout = buildSeatLayout(room);
  const base = showtime?.price || 0;

  const toggle = useCallback((seat) => {
    setError("");
    setSelected((prev) => {
      if (prev.find((s) => s.seatNumber === seat.seatNumber)) return prev.filter((s) => s.seatNumber !== seat.seatNumber);
      if (prev.length >= MAX_SEATS) { setError(`Chỉ chọn tối đa ${MAX_SEATS} ghế mỗi lần.`); return prev; }
      return [...prev, seat];
    });
  }, []);

  const seatTotal = selected.reduce((sum, s) => sum + priceOf(s, base), 0);
  const serviceFee = selected.length > 0 ? SERVICE_FEE : 0;
  const total = seatTotal + serviceFee;

  const onExpire = useCallback(() => { setSelected([]); setExpired(true); }, []);

  const confirm = async () => {
    if (selected.length === 0) return;
    setLoading(true); setError("");
    try {
      // Re-check ghế trống ngay trước khi đặt
      const fresh = await getBookings();
      const freshSet = bookedSeatSet({ ...showtime, id: Number(showtimeId) }, fresh);
      const clash = selected.filter((s) => freshSet.has(s.seatNumber));
      if (clash.length) {
        setBooked(freshSet);
        setSelected((prev) => prev.filter((s) => !freshSet.has(s.seatNumber)));
        setError(`Ghế ${clash.map((s) => s.seatNumber).join(", ")} vừa được người khác đặt. Vui lòng chọn lại.`);
        setLoading(false); return;
      }
      const stdCount = selected.filter((s) => !s.isVip && !s.isCouple).length;
      const vipCount = selected.filter((s) => s.isVip).length;
      const coupleCount = selected.filter((s) => s.isCouple).length;
      await createBooking({
        movieId: showtime.movieId, showtimeId: Number(showtimeId),
        cinemaId: room.cinemaId, roomId: room.id,
        seats: selected.map((s) => s.seatNumber),
        seatTypes: { standard: stdCount, vip: vipCount, couple: coupleCount },
        userId: user?.id, userName: user?.fullName || user?.email,
        seatTotal, fnbTotal: 0, serviceFee, totalPrice: total,
        createdAt: new Date().toISOString(),
      });
      setConfirmed(true);
      setTimeout(() => navigate("/tickets"), 1800);
    } catch (e) {
      setError("Đặt vé thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmed) return (
    <div className="page booking-done">
      <div className="booked-icon">✓</div>
      <h2>Đặt vé thành công!</h2>
      <p>Đang chuyển tới trang vé của bạn...</p>
    </div>
  );

  return (
    <div className="page booking-page">
      <Navbar back={movie ? `/movie/${movie.id}` : "/"} />
      <div className="booking-topbar">
        <SeatHoldTimer active onExpire={onExpire} />
      </div>
      {expired && (
        <div className="expire-banner">Đã hết thời gian giữ ghế — vui lòng chọn lại ghế.
          <button onClick={() => { setExpired(false); }}>Đã hiểu</button></div>
      )}
      <div className="booking-body">
        <div className="booking-main">
          <SeatStep layout={layout} booked={booked} selected={selected} base={base} room={room} onToggle={toggle} />
        </div>
        <OrderSummary
          movie={movie} cinema={cinema} room={room} showtime={showtime}
          selected={selected} base={base} serviceFee={serviceFee} total={total}
          primaryLabel="Xác nhận đặt vé" primaryDisabled={selected.length === 0}
          loading={loading} onPrimary={confirm} error={error}
        />
      </div>
      <Footer />
    </div>
  );
}
