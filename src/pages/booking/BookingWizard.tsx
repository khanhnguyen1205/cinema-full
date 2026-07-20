import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  getShowtime,
  getMovie,
  getRoom,
  getCinema,
  getOccupiedSeats,
  holdSeats,
  releaseSeats,
} from "services/api";
import {
  buildSeatLayout,
  priceOf,
  fnbLines,
  fnbTotal,
  SERVICE_FEE,
  MAX_SEATS,
  MAX_ITEM_QTY,
} from "lib/pricing";
import {
  useOccupiedSeats,
  useConcessions,
  useCreateBooking,
} from "queries/booking";
import { useAuth } from "context/AuthContext";
import type { Movie, Showtime, Room, Cinema, Seat, Booking } from "types";
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
  const { showtimeId = "" } = useParams();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [showtime, setShowtime] = useState<Showtime | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [cinema, setCinema] = useState<Cinema | null>(null);
  const [selected, setSelected] = useState<Seat[]>([]);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [paymentMethod, setPaymentMethod] = useState("momo");
  const [error, setError] = useState("");
  const [bookingResult, setBookingResult] = useState<Booking | null>(null);
  const [expired, setExpired] = useState(false);
  const [timerEpoch, setTimerEpoch] = useState(0);

  // Meta của suất (phim/phòng/rạp) — ít đổi, giữ useEffect gọi 1 lần.
  useEffect(() => {
    if (!showtimeId) return;
    let alive = true;
    (async () => {
      const st = await getShowtime(showtimeId);
      if (!alive) return;
      setShowtime(st);
      const [m, r] = await Promise.all([
        getMovie(st.movieId),
        getRoom(st.roomId),
      ]);
      if (!alive) return;
      setMovie(m);
      setRoom(r);
      getCinema(r.cinemaId).then((c) => alive && setCinema(c));
    })();
    return () => {
      alive = false;
    };
  }, [showtimeId]);

  // Ghế đã chiếm: Query, poll 10s chỉ ở bước chọn ghế.
  const occupiedQ = useOccupiedSeats(showtimeId, {
    poll: step === 1,
    enabled: !!showtimeId,
  });
  const selectedKeys = useMemo(
    () => new Set(selected.map((s) => s.seatNumber)),
    [selected],
  );
  // Suy dẫn booked = occupied - ghế mình đang chọn (không ghi đè cache).
  const booked = useMemo(
    () => new Set((occupiedQ.data ?? []).filter((s) => !selectedKeys.has(s))),
    [occupiedQ.data, selectedKeys],
  );

  // Bắp nước: Query lo loading/error/refetch.
  const concessionsQ = useConcessions();
  const catalog = useMemo(() => concessionsQ.data ?? [], [concessionsQ.data]);

  const createMut = useCreateBooking();

  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Giữ ghế phía server mỗi khi lựa chọn đổi (kiêm heartbeat khi sang bước 2/3).
  const seatKey = selected.map((s) => s.seatNumber).join(",");
  useEffect(() => {
    if (!showtimeId || step >= 4) return;
    let cancelled = false;
    holdSeats(
      showtimeId,
      selected.map((s) => s.seatNumber),
    )
      .then(async (r) => {
        if (r.ok || cancelled) return;
        if (r.status === 409) {
          const data = await r.json().catch(() => ({}));
          const conflicts = new Set<string>(data.conflicts || []);
          if (!conflicts.size) return;
          setSelected((prev) =>
            prev.filter((s) => !conflicts.has(s.seatNumber)),
          );
          occupiedQ.refetch();
          setStep(1);
          setError(
            `Ghế ${[...conflicts].join(", ")} vừa được người khác giữ. Vui lòng chọn lại.`,
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // seatKey là chuỗi ổn định đại diện cho `selected`; dùng nó thay mảng đổi ref mỗi render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatKey, showtimeId, step]);

  // Rời trang -> nhả toàn bộ ghế đang giữ của mình.
  useEffect(() => {
    return () => {
      if (showtimeId) releaseSeats(showtimeId);
    };
  }, [showtimeId]);

  const layout = buildSeatLayout(room);
  const base = showtime?.price || 0;

  const toggle = useCallback((seat: Seat) => {
    setError("");
    setSelected((prev) => {
      if (prev.find((s) => s.seatNumber === seat.seatNumber))
        return prev.filter((s) => s.seatNumber !== seat.seatNumber);
      if (prev.length >= MAX_SEATS) {
        setError(`Chỉ chọn tối đa ${MAX_SEATS} ghế mỗi lần.`);
        return prev;
      }
      return [...prev, seat];
    });
  }, []);

  const changeQty = useCallback((id: number, delta: number) => {
    setQty((prev) => {
      const n = Math.max(0, Math.min(MAX_ITEM_QTY, (prev[id] || 0) + delta));
      const copy = { ...prev };
      if (n === 0) delete copy[id];
      else copy[id] = n;
      return copy;
    });
  }, []);

  const seatTotal = selected.reduce((sum, s) => sum + priceOf(s, base), 0);
  const fnb = fnbLines(qty, catalog);
  const fnbSum = fnbTotal(qty, catalog);
  const hasOrder = selected.length > 0;
  const serviceFee = hasOrder ? SERVICE_FEE : 0;
  const total = hasOrder ? seatTotal + fnbSum + serviceFee : 0;

  const onExpire = useCallback(() => {
    setSelected([]);
    setStep(1);
    setExpired(true);
    setTimerEpoch((e) => e + 1);
  }, []);

  const confirm = async () => {
    if (selected.length === 0 || !showtime || !room) return;
    setError("");
    try {
      // Re-check ghế trống ngay trước khi đặt.
      const freshSet = new Set(await getOccupiedSeats(showtimeId));
      const clash = selected.filter((s) => freshSet.has(s.seatNumber));
      if (clash.length) {
        setSelected((prev) => prev.filter((s) => !freshSet.has(s.seatNumber)));
        occupiedQ.refetch();
        setStep(1);
        setError(
          `Ghế ${clash.map((s) => s.seatNumber).join(", ")} vừa được người khác đặt. Vui lòng chọn lại.`,
        );
        return;
      }
      const stdCount = selected.filter((s) => !s.isVip && !s.isCouple).length;
      const vipCount = selected.filter((s) => s.isVip).length;
      const coupleCount = selected.filter((s) => s.isCouple).length;
      const created = await createMut.mutateAsync({
        movieId: showtime.movieId,
        showtimeId: Number(showtimeId),
        cinemaId: room.cinemaId,
        roomId: room.id,
        seats: selected.map((s) => s.seatNumber),
        seatTypes: { standard: stdCount, vip: vipCount, couple: coupleCount },
        concessions: fnb.map(({ id, name, qty: q, price }) => ({
          id,
          name,
          qty: q,
          price,
        })),
        paymentMethod,
        userId: user?.id,
        userName: user?.fullName || user?.email,
        seatTotal,
        fnbTotal: fnbSum,
        serviceFee,
        totalPrice: total,
        createdAt: new Date().toISOString(),
      });
      setBookingResult(created);
      setStep(4);
    } catch {
      setError("Đặt vé thất bại. Vui lòng thử lại.");
    }
  };

  const onPrimary = () => {
    if (step === 1) {
      setError("");
      setStep(2);
      return;
    }
    if (step === 2) {
      setError("");
      setStep(3);
      return;
    }
    confirm();
  };

  const primaryLabel = step === 3 ? "Thanh toán" : "Tiếp tục";

  return (
    <div className="page booking-k">
      <Navbar back={movie ? `/movie/${movie.id}` : "/"} />
      <div className="booking-k__topbar">
        <BookingStepper
          step={step}
          onBack={() => {
            if (step >= 4) return;
            setError("");
            setStep((s) => Math.max(1, s - 1));
          }}
        />
        {step < 4 && (
          <SeatHoldTimer active resetKey={timerEpoch} onExpire={onExpire} />
        )}
      </div>
      {expired && step < 4 && (
        <div className="booking-k__expire">
          Đã hết thời gian giữ ghế — vui lòng chọn lại ghế.
          <button type="button" onClick={() => setExpired(false)}>
            Đã hiểu
          </button>
        </div>
      )}
      {step === 4 ? (
        <div className="booking-k__body booking-k__body--single">
          <TicketStep
            booking={bookingResult}
            movie={movie}
            cinema={cinema}
            room={room}
            showtime={showtime}
          />
        </div>
      ) : (
        <div className="booking-k__body">
          <div className="booking-k__main">
            {step === 1 && (
              <SeatStep
                layout={layout}
                booked={booked}
                selected={selected}
                base={base}
                room={room}
                onToggle={toggle}
              />
            )}
            {step === 2 && (
              <ConcessionStep
                catalog={catalog}
                qty={qty}
                onChange={changeQty}
                loading={concessionsQ.isLoading}
                error={concessionsQ.isError}
                onRetry={() => concessionsQ.refetch()}
              />
            )}
            {step === 3 && (
              <PaymentStep method={paymentMethod} onChange={setPaymentMethod} />
            )}
          </div>
          <OrderSummary
            movie={movie}
            cinema={cinema}
            room={room}
            showtime={showtime}
            selected={selected}
            base={base}
            fnb={hasOrder ? fnb : []}
            serviceFee={serviceFee}
            total={total}
            primaryLabel={primaryLabel}
            primaryDisabled={!hasOrder}
            secondaryLabel={step === 2 ? "Bỏ qua" : null}
            onSecondary={() => {
              setError("");
              setStep(3);
            }}
            loading={createMut.isPending}
            onPrimary={onPrimary}
            error={error}
          />
        </div>
      )}
      <Footer />
    </div>
  );
}
