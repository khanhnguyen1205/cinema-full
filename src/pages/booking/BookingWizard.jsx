import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { getShowtime, getMovie, getRoom, getCinema, getOccupiedSeats, createBooking, getConcessions, holdSeats, releaseSeats } from "services/api";
import { buildSeatLayout, priceOf, fnbLines, fnbTotal, SERVICE_FEE, MAX_SEATS, MAX_ITEM_QTY } from "lib/pricing";
import { useAuth } from "context/AuthContext";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import BookingStepper from "./BookingStepper";
import SeatStep from "./SeatStep";
import ConcessionStep from "./ConcessionStep";
import PaymentStep from "./PaymentStep";
import TicketStep from "./TicketStep";
import OrderSummary from "./OrderSummary";
import SeatHoldTimer from "./SeatHoldTimer";
import "./Booking.css";

export default function BookingWizard() {
  const { showtimeId } = useParams();
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
  const [catalogError, setCatalogError] = useState(false);
  const [qty, setQty] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("momo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookingResult, setBookingResult] = useState(null);
  const [expired, setExpired] = useState(false);
  const [timerEpoch, setTimerEpoch] = useState(0);

  useEffect(() => {
    (async () => {
      const st = await getShowtime(showtimeId);
      setShowtime(st);
      const [m, r, occupied] = await Promise.all([getMovie(st.movieId), getRoom(st.roomId), getOccupiedSeats(showtimeId)]);
      setMovie(m); setRoom(r);
      setBooked(new Set(occupied));
      getCinema(r.cinemaId).then(setCinema);
    })();
  }, [showtimeId]);

  const loadCatalog = useCallback(() => {
    setCatalogLoading(true); setCatalogError(false);
    getConcessions()
      .then((data) => setCatalog(data))
      .catch(() => { setCatalog([]); setCatalogError(true); })
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  // Ref theo dõi ghế đang chọn để interval poll không bị đóng biến cũ (stale closure)
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Giữ ghế phía server mỗi khi danh sách ghế đổi (cũng gia hạn TTL khi sang bước 2/3).
  const seatKey = selected.map((s) => s.seatNumber).join(",");
  useEffect(() => {
    if (!showtimeId || step >= 4) return;
    let cancelled = false;
    holdSeats(showtimeId, selected.map((s) => s.seatNumber))
      .then(async (r) => {
        if (r.ok || cancelled) return;
        if (r.status === 409) {
          const data = await r.json().catch(() => ({}));
          const conflicts = new Set(data.conflicts || []);
          if (!conflicts.size) return;
          setBooked((prev) => new Set([...prev, ...conflicts]));
          setSelected((prev) => prev.filter((s) => !conflicts.has(s.seatNumber)));
          setStep(1);
          setError(`Ghế ${[...conflicts].join(", ")} vừa được người khác giữ. Vui lòng chọn lại.`);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [seatKey, showtimeId, step]);

  // Poll ghế trống ở bước chọn ghế: thấy ghế người khác vừa giữ / vừa nhả.
  useEffect(() => {
    if (step !== 1 || !showtimeId) return;
    const id = setInterval(async () => {
      try {
        const occ = await getOccupiedSeats(showtimeId);
        const sel = new Set(selectedRef.current.map((s) => s.seatNumber));
        setBooked(new Set(occ.filter((s) => !sel.has(s)))); // giữ lại ghế mình đang chọn
      } catch { /* bỏ qua lỗi mạng tạm thời */ }
    }, 10000);
    return () => clearInterval(id);
  }, [step, showtimeId]);

  // Rời trang -> nhả toàn bộ ghế đang giữ của mình.
  useEffect(() => {
    return () => { if (showtimeId) releaseSeats(showtimeId); };
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

  // Hết giờ: xóa ghế, về bước ①, báo banner và đếm lại đồng hồ từ đầu
  const onExpire = useCallback(() => { setSelected([]); setStep(1); setExpired(true); setTimerEpoch((e) => e + 1); }, []);

  const confirm = async () => {
    if (selected.length === 0) return;
    setLoading(true); setError("");
    try {
      // Re-check ghế trống ngay trước khi đặt
      const freshSet = new Set(await getOccupiedSeats(showtimeId));
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
      const created = await createBooking({
        movieId: showtime.movieId, showtimeId: Number(showtimeId),
        cinemaId: room.cinemaId, roomId: room.id,
        seats: selected.map((s) => s.seatNumber),
        seatTypes: { standard: stdCount, vip: vipCount, couple: coupleCount },
        concessions: fnb.map(({ id, name, qty: q, price }) => ({ id, name, qty: q, price })),
        paymentMethod,
        userId: user?.id, userName: user?.fullName || user?.email,
        seatTotal, fnbTotal: fnbSum, serviceFee, totalPrice: total,
        createdAt: new Date().toISOString(),
      });
      setBookingResult(created);
      setStep(4);
    } catch (e) {
      setError("Đặt vé thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const onPrimary = () => {
    if (step === 1) { setError(""); setStep(2); return; }
    if (step === 2) { setError(""); setStep(3); return; }
    confirm();
  };

  const primaryLabel = step === 3 ? "Thanh toán" : "Tiếp tục";

  return (
    <div className="page booking-page">
      <Navbar back={movie ? `/movie/${movie.id}` : "/"} />
      <div className="booking-topbar">
        <BookingStepper step={step} onBack={() => { if (step >= 4) return; setError(""); setStep((s) => Math.max(1, s - 1)); }} />
        {step < 4 && <SeatHoldTimer active resetKey={timerEpoch} onExpire={onExpire} />}
      </div>
      {expired && step < 4 && (
        <div className="expire-banner">Đã hết thời gian giữ ghế — vui lòng chọn lại ghế.
          <button onClick={() => { setExpired(false); }}>Đã hiểu</button></div>
      )}
      {step === 4 ? (
        <div className="booking-body booking-body-single">
          <TicketStep booking={bookingResult} movie={movie} cinema={cinema} room={room} showtime={showtime} />
        </div>
      ) : (
        <div className="booking-body">
          <div className="booking-main">
            {step === 1 && (
              <SeatStep layout={layout} booked={booked} selected={selected} base={base} room={room} onToggle={toggle} />
            )}
            {step === 2 && (
              <ConcessionStep catalog={catalog} qty={qty} onChange={changeQty} loading={catalogLoading} error={catalogError} onRetry={loadCatalog} />
            )}
            {step === 3 && (
              <PaymentStep method={paymentMethod} onChange={setPaymentMethod} />
            )}
          </div>
          <OrderSummary
            movie={movie} cinema={cinema} room={room} showtime={showtime}
            selected={selected} base={base} fnb={hasOrder ? fnb : []} serviceFee={serviceFee} total={total}
            primaryLabel={primaryLabel}
            primaryDisabled={!hasOrder}
            secondaryLabel={step === 2 ? "Bỏ qua" : null}
            onSecondary={() => { setError(""); setStep(3); }}
            loading={loading} onPrimary={onPrimary} error={error}
          />
        </div>
      )}
      <Footer />
    </div>
  );
}
