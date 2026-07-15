import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getShowtime, getMovie, getRoom, getCinema, getBookings, createBooking, getConcessions } from "services/api";
import { buildSeatLayout, bookedSeatSet, priceOf, fnbLines, fnbTotal, SERVICE_FEE, MAX_SEATS, MAX_ITEM_QTY } from "lib/pricing";
import { useAuth } from "context/AuthContext";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import BookingStepper, { BOOKING_STEPS } from "./BookingStepper";
import SeatStep from "./SeatStep";
import ConcessionStep from "./ConcessionStep";
import OrderSummary from "./OrderSummary";
import SeatHoldTimer from "./SeatHoldTimer";
import "./Booking.css";

// Đợt 2 mới có 2 bước; Đợt 3 thêm Thanh toán + Vé QR thì bỏ slice đi.
const LIVE_STEPS = BOOKING_STEPS.slice(0, 2);

export default function BookingWizard() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [showtime, setShowtime] = useState(null);
  const [movie, setMovie] = useState(null);
  const [room, setRoom] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [booked, setBooked] = useState(new Set());
  const [selected, setSelected] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [qty, setQty] = useState({});
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

  useEffect(() => {
    getConcessions()
      .then(setCatalog)
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  }, []);

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

  // Nhận delta (+1/-1) rồi cộng vào prev: kẹp biên [0, MAX_ITEM_QTY] chỉ nằm ở đây
  const changeQty = useCallback((id, delta) => {
    setQty((prev) => {
      const n = Math.max(0, Math.min(MAX_ITEM_QTY, (prev[id] || 0) + delta));
      const copy = { ...prev };
      if (n === 0) delete copy[id]; else copy[id] = n;
      return copy;
    });
  }, []);

  const seatTotal = selected.reduce((sum, s) => sum + priceOf(s, base), 0);
  const fnb = fnbLines(qty, catalog);
  const fnbSum = fnbTotal(qty, catalog);
  // Chưa có ghế thì chưa thành đơn: không phí dịch vụ, không hiện tiền bắp nước
  const hasOrder = selected.length > 0;
  const serviceFee = hasOrder ? SERVICE_FEE : 0;
  const total = hasOrder ? seatTotal + fnbSum + serviceFee : 0;

  const onExpire = useCallback(() => { setSelected([]); setStep(1); setExpired(true); }, []);

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
        setStep(1);
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
        concessions: fnb.map(({ id, name, qty: q, price }) => ({ id, name, qty: q, price })),
        userId: user?.id, userName: user?.fullName || user?.email,
        seatTotal, fnbTotal: fnbSum, serviceFee, totalPrice: total,
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

  const onPrimary = () => {
    if (step === 1) { setError(""); setStep(2); return; }
    confirm();
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
        <BookingStepper step={step} steps={LIVE_STEPS} onBack={() => { setError(""); setStep(1); }} />
        <SeatHoldTimer active onExpire={onExpire} />
      </div>
      {expired && (
        <div className="expire-banner">Đã hết thời gian giữ ghế — vui lòng chọn lại ghế.
          <button onClick={() => { setExpired(false); }}>Đã hiểu</button></div>
      )}
      <div className="booking-body">
        <div className="booking-main">
          {step === 1 ? (
            <SeatStep layout={layout} booked={booked} selected={selected} base={base} room={room} onToggle={toggle} />
          ) : (
            <ConcessionStep catalog={catalog} qty={qty} onChange={changeQty} loading={catalogLoading} />
          )}
        </div>
        <OrderSummary
          movie={movie} cinema={cinema} room={room} showtime={showtime}
          selected={selected} base={base} fnb={hasOrder ? fnb : []} serviceFee={serviceFee} total={total}
          primaryLabel={step === 1 ? "Tiếp tục" : "Xác nhận đặt vé"}
          primaryDisabled={!hasOrder}
          loading={loading} onPrimary={onPrimary} error={error}
        />
      </div>
      <Footer />
    </div>
  );
}
