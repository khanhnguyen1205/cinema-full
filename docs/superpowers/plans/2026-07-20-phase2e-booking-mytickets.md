# GĐ2e — Redesign Booking Wizard + MyTickets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển toàn bộ luồng đặt vé (`src/pages/booking/*`) và `MyTickets` sang Kinetic + TanStack Query + TSX, không rơi rớt tính năng (giữ ghế server, poll, đồng hồ 8', F&B, QR, re-check trước khi đặt).

**Architecture:** Thêm `queries/booking.ts` (occupied-seats poll qua `refetchInterval`, concessions, `useCreateBooking`, `useMyBookings`); `holdSeats`/`releaseSeats` **giữ nguyên lời gọi mệnh lệnh** (không bọc mutation). `BookingWizard` là bộ não giữ state, các step là component trình bày nhận props. Seat map dùng **roving tabindex** (1 tab-stop + phím mũi tên). Vé điện tử tách component `ETicket` tái dùng cho bước ④ và MyTickets.

**Tech Stack:** React 18, TypeScript 5.7 (`allowJs:true, checkJs:false` → parent `.tsx` import con `.jsx` vẫn qua typecheck), @tanstack/react-query v5, Vite 6, Vitest 3 (happy-dom), Playwright, `qrcode.react` (đã có), plain CSS (tokens `styles/tokens.css`, primitive `components/ui`).

## Global Constraints

- **6 gate xanh mỗi commit:** `npm run typecheck` · `npm run lint` (0 warning) · `npm run format:check` · `npm run test:run` · `npm run e2e` · `npm run build`.
- **0 warning ESLint**; luôn đọc output; xử `react-hooks/exhaustive-deps` bằng disable **có chú thích** khi chính đáng (giữ pattern `seatKey` hiện có).
- **Absolute imports** từ `src` root (`components/…`, `queries/…`, `services/api`, `lib/pricing`, `context/AuthContext`, `types`); sibling cùng thư mục dùng `./`.
- **Không thêm dependency mới.** Không đổi `server/*.js`, không đổi hợp đồng `services/api.ts`.
- **Copy tiếng Việt.** Giá VND `.toLocaleString("vi-VN") + "₫"`.
- **Commit thẳng `main`.** **KHÔNG** `git add CLAUDE.md` hay `README.md` (đang sửa dở, để riêng).
- Cuối commit body: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Gotcha HMR:** đổi `.jsx→.tsx` / xoá `.jsx` làm Vite trắng trang → `taskkill` listener :3000 (hoặc kill dev server) + `rm -rf node_modules/.vite` + `npm start`. Screenshot fullPage phải **cuộn dần** để `Reveal` hiện.
- **Chữ ký sẵn có (dùng nguyên, đọc file để rõ):** `services/api` — `getShowtime/getMovie/getRoom/getCinema/getOccupiedSeats(id):Promise<string[]>`, `holdSeats(id,seats):Promise<Response>`, `releaseSeats(id):Promise<Response>`, `createBooking(b):Promise<Booking>`, `getBookings():Promise<Booking[]>`, `getConcessions():Promise<Concession[]>`. `lib/pricing` — `buildSeatLayout(room):SeatRow[]`, `priceOf(seat,base)`, `seatType(seat):SeatTypeKey`, `SEAT_TYPE`, `aisleColsForRow(room,isCouple):number[]`, `vipPrice/couplePrice`, `fnbLines/fnbTotal`, `SERVICE_FEE/MAX_SEATS(8)/MAX_ITEM_QTY(10)`. Types (`types`): `Movie,Showtime,Room,Cinema,Concession,Booking,Seat,SeatRow,SeatTypeKey,BookingConcession`.

---

### Task 1 (2e/1): Query infra — keys + `queries/booking.ts`

**Files:**
- Modify: `src/queries/keys.ts`
- Create: `src/queries/booking.ts`
- Test: `src/queries/keys.test.ts`

**Interfaces:**
- Consumes: `getOccupiedSeats, getConcessions, getBookings, createBooking` từ `services/api`; `qk` từ `./keys`; `queryClient` không cần (dùng `useQueryClient`).
- Produces:
  - `qk.occupiedSeats(id): readonly ["occupiedSeats", number|string]`
  - `qk.concessions: readonly ["concessions"]`
  - `qk.myBookings: readonly ["bookings","mine"]`
  - `useOccupiedSeats(showtimeId, opts?: { poll?: boolean; enabled?: boolean }): UseQueryResult<string[]>`
  - `useConcessions(): UseQueryResult<Concession[]>`
  - `useMyBookings(): UseQueryResult<Booking[]>`
  - `useCreateBooking(): UseMutationResult<Booking, Error, Partial<Booking> & { showtimeId: number }>`

- [ ] **Step 1: Viết test thất bại** — thêm vào `describe` trong `src/queries/keys.test.ts`:

```ts
it("khai báo key cho luồng đặt vé", () => {
  expect(qk.occupiedSeats(7)).toEqual(["occupiedSeats", 7]);
  expect(qk.concessions).toEqual(["concessions"]);
  expect(qk.myBookings).toEqual(["bookings", "mine"]);
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm run test:run -- src/queries/keys.test.ts`
Expected: FAIL — `Cannot read properties of undefined` / `qk.occupiedSeats is not a function`.

- [ ] **Step 3: Thêm keys** — trong `src/queries/keys.ts`, thêm vào object `qk` (giữ key cũ):

```ts
  occupiedSeats: (id: number | string) => ["occupiedSeats", id] as const,
  concessions: ["concessions"] as const,
  myBookings: ["bookings", "mine"] as const,
```

- [ ] **Step 4: Tạo `src/queries/booking.ts`**:

```ts
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getOccupiedSeats,
  getConcessions,
  getBookings,
  createBooking,
} from "services/api";
import type { Booking, Concession } from "types";
import { qk } from "./keys";

// Ghế đã chiếm (đặt + người khác đang giữ). poll=true -> tự refetch 10s ở bước chọn ghế.
export const useOccupiedSeats = (
  showtimeId: number | string,
  opts: { poll?: boolean; enabled?: boolean } = {},
): UseQueryResult<string[]> =>
  useQuery({
    queryKey: qk.occupiedSeats(showtimeId),
    queryFn: () => getOccupiedSeats(showtimeId),
    enabled: opts.enabled ?? true,
    refetchInterval: opts.poll ? 10_000 : false,
  });

export const useConcessions = (): UseQueryResult<Concession[]> =>
  useQuery({ queryKey: qk.concessions, queryFn: getConcessions });

// Gateway đã scope GET /bookings theo caller -> đây là "vé của tôi".
export const useMyBookings = (): UseQueryResult<Booking[]> =>
  useQuery({ queryKey: qk.myBookings, queryFn: getBookings });

// Đặt vé: invalidate danh sách vé của tôi + ghế trống của suất vừa đặt.
export const useCreateBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (booking: Partial<Booking> & { showtimeId: number }) =>
      createBooking(booking),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.myBookings });
      qc.invalidateQueries({
        queryKey: qk.occupiedSeats(variables.showtimeId),
      });
    },
  });
};
```

- [ ] **Step 5: Chạy test + gate**

Run: `npm run test:run -- src/queries/keys.test.ts` → PASS.
Run: `npm run typecheck` → 0 lỗi.
Run: `npm run lint` → 0 warning.
Run: `npm run format:check` → clean (nếu fail: `npx prettier --write src/queries/booking.ts src/queries/keys.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/queries/keys.ts src/queries/booking.ts src/queries/keys.test.ts
git commit -m "$(cat <<'EOF'
feat(GD2e/1): query infra booking (occupied-seats poll, concessions, myBookings, createBooking)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2 (2e/2): Wizard spine → TSX + wire Query + kinetic shell

Convert **BookingWizard + BookingStepper + SeatHoldTimer + OrderSummary** sang `.tsx`, thay data-loading `useEffect` bằng hook Task 1, và **redesign phần vỏ** (stepper, timer, order summary, layout khung). Bốn step body (`SeatStep/ConcessionStep/PaymentStep/TicketStep`) **tạm giữ `.jsx`** (import như `any` — hợp lệ nhờ `allowJs`); sẽ redesign ở Task 3–5.

**Files:**
- Create: `src/pages/booking/BookingWizard.tsx` · Delete: `BookingWizard.jsx`
- Create: `src/pages/booking/BookingStepper.tsx` · Delete: `BookingStepper.jsx`
- Create: `src/pages/booking/SeatHoldTimer.tsx` · Delete: `SeatHoldTimer.jsx`
- Create: `src/pages/booking/OrderSummary.tsx` · Delete: `OrderSummary.jsx`
- Modify: `src/pages/booking/Booking.css` (thêm khối kinetic cho shell/stepper/timer/summary; **giữ tạm** class step-body cũ)

**Interfaces:**
- Consumes: hook Task 1 (`useOccupiedSeats, useConcessions, useCreateBooking`); `services/api` (`getShowtime,getMovie,getRoom,getCinema,holdSeats,releaseSeats`); `lib/pricing`; `context/AuthContext` (`useAuth`); các step `.jsx` hiện có; `components/Navbar/Footer`.
- Produces: `BookingWizard` default (route `/seats/:showtimeId`). `BookingStepper({ step, onBack })`, `SeatHoldTimer({ seconds?, active?, resetKey?, onExpire? })`, `OrderSummary(props)` — kiểu props nêu dưới.

- [ ] **Step 1: `SeatHoldTimer.tsx`** — port nguyên logic file `.jsx` hiện có, thêm kiểu + class kinetic. Toàn văn:

```tsx
import { useEffect, useRef, useState } from "react";

export default function SeatHoldTimer({
  seconds = 480,
  active = true,
  resetKey = 0,
  onExpire,
}: {
  seconds?: number;
  active?: boolean;
  resetKey?: number;
  onExpire?: () => void;
}) {
  const [left, setLeft] = useState(seconds);
  const firedRef = useRef(false);

  useEffect(() => {
    setLeft(seconds);
    firedRef.current = false;
  }, [resetKey, seconds]);

  useEffect(() => {
    if (!active) return;
    if (left <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, active, onExpire]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className={`hold-k ${left <= 60 ? "is-warn" : ""}`}>
      <span className="hold-k__label">Giữ ghế</span>
      <span className="hold-k__time">
        {mm}:{ss}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: `BookingStepper.tsx`** — kinetic (N° + nhãn mono + rule). Toàn văn:

```tsx
const BOOKING_STEPS = [
  { n: 1, label: "Chọn ghế" },
  { n: 2, label: "Bắp nước" },
  { n: 3, label: "Thanh toán" },
  { n: 4, label: "Vé của bạn" },
];

export default function BookingStepper({
  step,
  onBack,
}: {
  step: number;
  onBack: () => void;
}) {
  return (
    <div className="stepper-k">
      <button
        type="button"
        className="stepper-k__back"
        onClick={onBack}
        disabled={step <= 1}
      >
        ← Quay lại
      </button>
      <ol className="stepper-k__list">
        {BOOKING_STEPS.map(({ n, label }) => (
          <li
            key={n}
            className={
              "stepper-k__item" +
              (n === step ? " is-current" : "") +
              (n < step ? " is-done" : "")
            }
            aria-current={n === step ? "step" : undefined}
          >
            <span className="stepper-k__no">
              {n < step ? "✓" : `N°0${n}`}
            </span>
            <span className="stepper-k__label">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 3: `OrderSummary.tsx`** — port logic từ `.jsx` hiện có (giữ nguyên breakdown std/vip/couple + fnb + phí + tổng), đổi class sang kinetic, thêm kiểu. Toàn văn:

```tsx
import { vipPrice, couplePrice } from "lib/pricing";
import type { Movie, Cinema, Room, Showtime, Seat } from "types";
import type { FnbLine } from "lib/pricing";

const fmt = (n: number) => n.toLocaleString("vi-VN") + "₫";
const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("vi-VN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
const fmtTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export default function OrderSummary({
  movie,
  cinema,
  room,
  showtime,
  selected,
  base,
  fnb = [],
  serviceFee,
  total,
  primaryLabel,
  primaryDisabled,
  loading,
  onPrimary,
  error,
  secondaryLabel,
  onSecondary,
}: {
  movie?: Movie | null;
  cinema?: Cinema | null;
  room?: Room | null;
  showtime?: Showtime | null;
  selected: Seat[];
  base: number;
  fnb?: FnbLine[];
  serviceFee: number;
  total: number;
  primaryLabel: string;
  primaryDisabled?: boolean;
  loading?: boolean;
  onPrimary: () => void;
  error?: string;
  secondaryLabel?: string | null;
  onSecondary?: () => void;
}) {
  const std = selected.filter((s) => !s.isVip && !s.isCouple);
  const vip = selected.filter((s) => s.isVip);
  const cpl = selected.filter((s) => s.isCouple);

  return (
    <aside className="os-k">
      {movie && (
        <div className="os-k__movie">
          <h2 className="os-k__title">{movie.title}</h2>
          <p className="os-k__meta">
            {movie.genre?.toUpperCase()} · {movie.duration} PHÚT
          </p>
          <p className="os-k__cinema">
            {cinema?.name} · {room?.name} · {room?.type}
          </p>
          <div className="os-k__grid">
            <div>
              <span className="os-k__label">Ngày</span>
              <span className="os-k__value">{fmtDate(showtime?.time)}</span>
            </div>
            <div>
              <span className="os-k__label">Giờ</span>
              <span className="os-k__value">{fmtTime(showtime?.time)}</span>
            </div>
          </div>
          <div className="os-k__seats">
            <span className="os-k__label">Ghế đã chọn</span>
            <span className="os-k__value os-k__seatlist">
              {selected.length
                ? selected.map((s) => s.seatNumber).join(", ")
                : "Chưa chọn"}
            </span>
          </div>
        </div>
      )}
      <div className="os-k__breakdown">
        {std.length > 0 && (
          <div className="os-k__row">
            <span>Ghế thường (×{std.length})</span>
            <span>{fmt(std.length * base)}</span>
          </div>
        )}
        {vip.length > 0 && (
          <div className="os-k__row">
            <span>Ghế VIP (×{vip.length})</span>
            <span>{fmt(vip.length * vipPrice(base))}</span>
          </div>
        )}
        {cpl.length > 0 && (
          <div className="os-k__row">
            <span>Ghế đôi (×{cpl.length})</span>
            <span>{fmt(cpl.length * couplePrice(base))}</span>
          </div>
        )}
        {fnb.length > 0 && <div className="os-k__subhead">Bắp nước</div>}
        {fnb.map((l) => (
          <div className="os-k__row" key={l.id}>
            <span>
              {l.name} (×{l.qty})
            </span>
            <span>{fmt(l.amount)}</span>
          </div>
        ))}
        {selected.length > 0 && (
          <div className="os-k__row">
            <span>Phí dịch vụ</span>
            <span>{fmt(serviceFee)}</span>
          </div>
        )}
        <div className="os-k__row os-k__total">
          <span>TỔNG CỘNG</span>
          <span className="os-k__total-amount">{fmt(total)}</span>
        </div>
      </div>
      {error && <div className="os-k__error">{error}</div>}
      <button
        type="button"
        className="os-k__cta"
        disabled={primaryDisabled || loading}
        onClick={onPrimary}
      >
        {loading ? "Đang xử lý..." : primaryLabel}
      </button>
      {secondaryLabel && (
        <button
          type="button"
          className="os-k__skip"
          disabled={loading}
          onClick={onSecondary}
        >
          {secondaryLabel}
        </button>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: `BookingWizard.tsx`** — port từ `.jsx` hiện có, thay 3 khối data thủ công bằng hook Task 1, giữ **nguyên** logic hold/409/expire/confirm. Toàn văn:

```tsx
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
import type { Movie, Showtime, Room, Cinema, Seat } from "types";
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
  const [bookingResult, setBookingResult] = useState<import("types").Booking | null>(
    null,
  );
  const [expired, setExpired] = useState(false);
  const [timerEpoch, setTimerEpoch] = useState(0);

  // Meta cua suat (phim/phong/rap) — it doi, giu useEffect goi 1 lan.
  useEffect(() => {
    if (!showtimeId) return;
    let alive = true;
    (async () => {
      const st = await getShowtime(showtimeId);
      if (!alive) return;
      setShowtime(st);
      const [m, r] = await Promise.all([getMovie(st.movieId), getRoom(st.roomId)]);
      if (!alive) return;
      setMovie(m);
      setRoom(r);
      getCinema(r.cinemaId).then((c) => alive && setCinema(c));
    })();
    return () => {
      alive = false;
    };
  }, [showtimeId]);

  // Ghe da chiem: Query, poll 10s chi o buoc chon ghe.
  const occupiedQ = useOccupiedSeats(showtimeId, {
    poll: step === 1,
    enabled: !!showtimeId,
  });
  const selectedKeys = useMemo(
    () => new Set(selected.map((s) => s.seatNumber)),
    [selected],
  );
  // Suy dan booked = occupied - ghe minh dang chon (khong ghi de cache).
  const booked = useMemo(
    () =>
      new Set(
        (occupiedQ.data ?? []).filter((s) => !selectedKeys.has(s)),
      ),
    [occupiedQ.data, selectedKeys],
  );

  // Bap nuoc: Query lo loading/error/refetch.
  const concessionsQ = useConcessions();
  const catalog = useMemo(() => concessionsQ.data ?? [], [concessionsQ.data]);

  const createMut = useCreateBooking();

  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Giu ghe phia server moi khi lua chon doi (kiem heartbeat khi sang buoc 2/3).
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
          setSelected((prev) => prev.filter((s) => !conflicts.has(s.seatNumber)));
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
    // seatKey la chuoi on dinh dai dien cho `selected`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatKey, showtimeId, step]);

  // Roi trang -> nha toan bo ghe dang giu.
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
```

- [ ] **Step 5: Xoá 4 file `.jsx`**

Run: `git rm src/pages/booking/BookingWizard.jsx src/pages/booking/BookingStepper.jsx src/pages/booking/SeatHoldTimer.jsx src/pages/booking/OrderSummary.jsx`

- [ ] **Step 6: `Booking.css` — thêm khối kinetic cho shell** (giữ tạm các khối cũ của step body: `.seat-step/.fnb-*/.pay-*/.ticket-step/.eticket*`). Class + hành vi + token:
  - `.booking-k { background: var(--bg); min-height: 100vh; }`.
  - `.booking-k__topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px var(--gutter); border-bottom:1px solid var(--border); flex-wrap:wrap; }`.
  - `.stepper-k { display:flex; align-items:center; gap:20px; }`; `.stepper-k__back` mono `13px` màu `var(--text-muted)`, hover `var(--text)`, `:disabled{opacity:.4;cursor:default}`.
  - `.stepper-k__list { display:flex; gap:0; list-style:none; margin:0; padding:0; }`; `.stepper-k__item { display:flex; align-items:center; gap:8px; padding:0 16px; border-right:1px solid var(--border); opacity:.5; }` `:last-child{border-right:none}` `.is-current{opacity:1}` `.is-done{opacity:.8}`. `.stepper-k__no` Bebas `18px` màu `var(--red)`; `.is-done .stepper-k__no{color:var(--text)}`. `.stepper-k__label` mono `11px` uppercase letter-spacing muted; `.is-current .stepper-k__label{color:var(--text)}`.
  - `.hold-k { display:flex; align-items:center; gap:8px; border:1px solid var(--border-strong); padding:6px 12px; }`; `.hold-k__label` mono `11px` uppercase muted; `.hold-k__time` Bebas `20px` letter-spacing; `.hold-k.is-warn { border-color:var(--red); }` `.is-warn .hold-k__time{color:var(--red); animation: holdPulse 1s steps(2) infinite; }` `@keyframes holdPulse{50%{opacity:.4}}`.
  - `.booking-k__expire { display:flex; align-items:center; gap:12px; margin:16px var(--gutter) 0; padding:12px 16px; border:1px solid var(--red); background:color-mix(in srgb, var(--red) 12%, transparent); color:var(--text); font-family:var(--font-mono); font-size:13px; }` `button { margin-left:auto; background:var(--red); color:#fff; border:none; padding:6px 14px; cursor:pointer; font-family:var(--font-mono); }`.
  - `.booking-k__body { display:grid; grid-template-columns: 1fr 340px; gap:32px; max-width:var(--container-max); margin:0 auto; padding:32px var(--gutter) 72px; align-items:start; }`; `.booking-k__body--single { display:block; }`; `.booking-k__main { min-width:0; }`.
  - `.os-k { position:sticky; top:88px; border:1px solid var(--border); background:var(--surface); padding:22px; display:flex; flex-direction:column; gap:14px; }`. `.os-k__title` Bebas `28px` line-height 1; `.os-k__meta` mono `11px` uppercase muted; `.os-k__cinema` Barlow `13px` muted. `.os-k__grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }`; `.os-k__label` block mono `10px` uppercase muted; `.os-k__value` Barlow `14px` màu var(--text); `.os-k__seatlist` màu var(--red). `.os-k__breakdown { border-top:1px solid var(--border); padding-top:12px; display:flex; flex-direction:column; gap:8px; }`; `.os-k__row { display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:12px; color:var(--text-muted); }`; `.os-k__subhead` mono `10px` uppercase muted margin-top; `.os-k__total { border-top:1px solid var(--border); padding-top:10px; margin-top:4px; color:var(--text); }` `.os-k__total-amount { font-family:"Bebas Neue"; font-size:30px; color:var(--red); }`. `.os-k__error { border:1px solid var(--red); color:var(--red); font-family:var(--font-mono); font-size:12px; padding:8px 10px; }`. `.os-k__cta { background:var(--red); color:#fff; border:none; padding:14px; font-family:var(--font-mono); font-size:13px; text-transform:uppercase; letter-spacing:1.5px; cursor:pointer; transition:transform .12s ease; }` hover `transform:translateY(-2px)` `:disabled{opacity:.45;cursor:default;transform:none}`. `.os-k__skip { background:none; border:1px solid var(--border-strong); color:var(--text-muted); padding:10px; font-family:var(--font-mono); font-size:12px; cursor:pointer; }`.
  - `@media (prefers-reduced-motion: reduce){ .os-k__cta:hover{transform:none} .is-warn .hold-k__time{animation:none} }`.
  - `@media (max-width: 900px){ .booking-k__body{ grid-template-columns:1fr; } .os-k{ position:static; } }`.
  - `@media (max-width: 640px){ .stepper-k__label{ display:none; } .booking-k__topbar{ padding:12px 16px; } }`.

- [ ] **Step 7: Chạy gate**

Run: `npm run typecheck` → 0 lỗi. (Nếu lỗi "implicitly any" ở props step `.jsx` — không xảy ra vì `allowJs` cho phép; nếu có, kiểm import path.)
Run: `npm run lint` → 0 warning.
Run: `npm run format:check` → clean (fix: `npx prettier --write "src/pages/booking/**/*.tsx" src/pages/booking/Booking.css`).
Run: `npm run test:run` → PASS.
Run: `npm run build` → OK.

- [ ] **Step 8: Verify** — restart dev (`rm -rf node_modules/.vite` + `npm start`), đăng nhập, vào `/seats/<id>` (qua một suất thật). Kiểm: stepper N° + đồng hồ chạy, chọn ghế → summary cập nhật, sang bước ②③ được, đặt vé thành công ra vé (step body vẫn style cũ — chấp nhận, sẽ đẹp ở Task 3–5). Screenshot desktop + mobile.

- [ ] **Step 9: Commit**

```bash
git add src/pages/booking/BookingWizard.tsx src/pages/booking/BookingStepper.tsx src/pages/booking/SeatHoldTimer.tsx src/pages/booking/OrderSummary.tsx src/pages/booking/Booking.css
git commit -m "$(cat <<'EOF'
feat(GD2e/2): wizard spine sang TSX + wire Query + kinetic shell (stepper/timer/summary)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3 (2e/3): SeatStep kinetic + roving tabindex

**Files:**
- Create: `src/lib/seatNav.ts` (helper thuần điều hướng lưới)
- Test: `src/lib/seatNav.test.ts`
- Create: `src/pages/booking/SeatStep.tsx` · Delete: `SeatStep.jsx`
- Modify: `src/pages/booking/Booking.css` (thêm khối `.seatmap-k`; xoá khối cũ `.seat-step/.seat-map*/.seat-*/.screen-*/.seat-legend/.legend-*/.row-label/.seats-in-row/.seat-slot/.seat-zoom-controls/.seat-tip`)

**Interfaces:**
- Consumes: `SeatRow, Seat` (types); `priceOf, seatType, SEAT_TYPE, aisleColsForRow` (`lib/pricing`); `nextSeat` (`lib/seatNav`).
- Produces: `SeatStep({ layout: SeatRow[]; booked: Set<string>; selected: Seat[]; base: number; room: Room|null; onToggle: (s:Seat)=>void })`; `nextSeat(layout, current, dir): Seat | null`.

- [ ] **Step 1: Test `seatNav`** — `src/lib/seatNav.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextSeat } from "./seatNav";
import type { SeatRow, Seat } from "types";

const mk = (row: string, col: number, isCouple = false): Seat => ({
  seatNumber: `${row}${col}`,
  row,
  col,
  isVip: false,
  isCouple,
});
// 2 hàng thường A(1..3), B(1..3)
const layout: SeatRow[] = [
  { row: "A", isCouple: false, seats: [mk("A", 1), mk("A", 2), mk("A", 3)] },
  { row: "B", isCouple: false, seats: [mk("B", 1), mk("B", 2), mk("B", 3)] },
];

describe("nextSeat", () => {
  it("phải: sang ghế kế cùng hàng", () => {
    expect(nextSeat(layout, mk("A", 1), "right")?.seatNumber).toBe("A2");
  });
  it("phải ở cuối hàng: kẹp biên (giữ nguyên)", () => {
    expect(nextSeat(layout, mk("A", 3), "right")?.seatNumber).toBe("A3");
  });
  it("xuống: sang hàng dưới, chọn ghế cột gần nhất", () => {
    expect(nextSeat(layout, mk("A", 2), "down")?.seatNumber).toBe("B2");
  });
  it("lên ở hàng đầu: kẹp biên", () => {
    expect(nextSeat(layout, mk("A", 2), "up")?.seatNumber).toBe("A2");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm run test:run -- src/lib/seatNav.test.ts`
Expected: FAIL — `nextSeat is not a function` / module không tồn tại.

- [ ] **Step 3: Tạo `src/lib/seatNav.ts`**:

```ts
import type { SeatRow, Seat } from "types";

export type SeatDir = "left" | "right" | "up" | "down";

// Ghe ke tiep khi bam mui ten. Nhay qua khe trong (aisle) bang cach chon ghe
// co `col` gan nhat o hang dich. Ket bien -> tra chinh ghe hien tai (khong wrap).
export function nextSeat(
  layout: SeatRow[],
  current: Seat,
  dir: SeatDir,
): Seat | null {
  const rowIdx = layout.findIndex((r) => r.row === current.row);
  if (rowIdx < 0) return null;
  const row = layout[rowIdx];

  if (dir === "left" || dir === "right") {
    const seats = row.seats;
    const i = seats.findIndex((s) => s.seatNumber === current.seatNumber);
    const j = dir === "right" ? i + 1 : i - 1;
    return j >= 0 && j < seats.length ? seats[j] : current;
  }

  const targetIdx = dir === "down" ? rowIdx + 1 : rowIdx - 1;
  if (targetIdx < 0 || targetIdx >= layout.length) return current;
  const target = layout[targetIdx];
  // Chon ghe co col gan current.col nhat (xu ly hang ghe doi it cot hon).
  return target.seats.reduce((best, s) =>
    Math.abs(s.col - current.col) < Math.abs(best.col - current.col) ? s : best,
  );
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm run test:run -- src/lib/seatNav.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Tạo `src/pages/booking/SeatStep.tsx`** — kinetic + roving tabindex. Toàn văn:

```tsx
import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import type { SeatRow, Seat, Room } from "types";
import { priceOf, seatType, SEAT_TYPE, aisleColsForRow } from "lib/pricing";
import { nextSeat, type SeatDir } from "lib/seatNav";

const fmt = (n: number) => n.toLocaleString("vi-VN") + "₫";

const KEY_DIR: Record<string, SeatDir> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

export default function SeatStep({
  layout,
  booked,
  selected,
  base,
  room,
  onToggle,
}: {
  layout: SeatRow[];
  booked: Set<string>;
  selected: Seat[];
  base: number;
  room: Room | null;
  onToggle: (seat: Seat) => void;
}) {
  const selKeys = new Set(selected.map((s) => s.seatNumber));
  const firstSeat = layout[0]?.seats[0]?.seatNumber ?? "";
  const [focused, setFocused] = useState<string>(firstSeat);
  const gridRef = useRef<HTMLDivElement>(null);

  // Neu ghe dang focus bien mat khoi layout (doi phong), ve ghe dau.
  useEffect(() => {
    const exists = layout.some((r) =>
      r.seats.some((s) => s.seatNumber === focused),
    );
    if (!exists && firstSeat) setFocused(firstSeat);
  }, [layout, focused, firstSeat]);

  const move = (current: Seat, dir: SeatDir) => {
    const next = nextSeat(layout, current, dir);
    if (!next) return;
    setFocused(next.seatNumber);
    // Doi focus DOM sang nut moi (roving tabindex).
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-seat="${CSS.escape(next.seatNumber)}"]`,
        )
        ?.focus();
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, seat: Seat) => {
    const dir = KEY_DIR[e.key];
    if (dir) {
      e.preventDefault();
      move(seat, dir);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!booked.has(seat.seatNumber)) onToggle(seat);
    }
  };

  return (
    <div className="seatmap-k">
      <div className="seatmap-k__screen">
        <div className="seatmap-k__screen-arc" aria-hidden="true" />
        <span className="seatmap-k__screen-label">MÀN HÌNH CHIẾU</span>
      </div>

      <div className="seatmap-k__scroll">
        <div
          className="seatmap-k__grid"
          role="grid"
          aria-label="Sơ đồ ghế"
          ref={gridRef}
        >
          {layout.map(({ row, seats, isCouple }) => {
            const aisles = aisleColsForRow(room as Room, isCouple);
            return (
              <div key={row} className="seatmap-k__row" role="row">
                <span className="seatmap-k__rowlabel" aria-hidden="true">
                  {row}
                </span>
                <div className="seatmap-k__seats">
                  {seats.map((seat) => {
                    const isBooked = booked.has(seat.seatNumber);
                    const isSel = selKeys.has(seat.seatNumber);
                    const type = seatType(seat);
                    const label =
                      `Ghế ${seat.seatNumber}, ${SEAT_TYPE[type].label}, ` +
                      `${fmt(priceOf(seat, base))}` +
                      (isBooked ? ", đã đặt" : isSel ? ", đang chọn" : "");
                    return (
                      <button
                        key={seat.seatNumber}
                        type="button"
                        role="gridcell"
                        data-seat={seat.seatNumber}
                        className={
                          `seatmap-k__seat is-${type}` +
                          (isBooked ? " is-booked" : "") +
                          (isSel ? " is-selected" : "") +
                          (isCouple ? " is-couplecell" : "")
                        }
                        style={
                          aisles.includes(seat.col)
                            ? { marginRight: 22 }
                            : undefined
                        }
                        tabIndex={seat.seatNumber === focused ? 0 : -1}
                        aria-label={label}
                        aria-pressed={isSel}
                        aria-disabled={isBooked}
                        onFocus={() => setFocused(seat.seatNumber)}
                        onKeyDown={(e) => onKeyDown(e, seat)}
                        onClick={() => !isBooked && onToggle(seat)}
                      >
                        <span aria-hidden="true">
                          {isSel ? "✓" : isBooked ? "×" : seat.col}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <span className="seatmap-k__rowlabel" aria-hidden="true">
                  {row}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="seatmap-k__hint">Dùng phím mũi tên để di chuyển, Enter để chọn.</p>

      <div className="seatmap-k__legend">
        <span className="seatmap-k__leg is-standard">Thường {fmt(base)}</span>
        <span className="seatmap-k__leg is-vip">VIP</span>
        <span className="seatmap-k__leg is-couple">Đôi</span>
        <span className="seatmap-k__leg is-selected">Đang chọn</span>
        <span className="seatmap-k__leg is-booked">Đã đặt</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Xoá file cũ** — `git rm src/pages/booking/SeatStep.jsx`

- [ ] **Step 7: `Booking.css` — thêm `.seatmap-k`, xoá khối seat cũ.** Class + hành vi + token:
  - `.seatmap-k { display:flex; flex-direction:column; align-items:center; gap:20px; }`.
  - `.seatmap-k__screen { width:100%; max-width:560px; text-align:center; }`; `.seatmap-k__screen-arc { height:36px; border-top:2px solid var(--border-strong); border-radius:50%/100% 100% 0 0; background:linear-gradient(to bottom, color-mix(in srgb, var(--text) 8%, transparent), transparent); }` (scanline mờ tuỳ chọn: `box-shadow: inset 0 6px 12px -8px var(--text)`); `.seatmap-k__screen-label { display:block; margin-top:6px; font-family:var(--font-mono); font-size:11px; letter-spacing:4px; color:var(--text-muted); }`.
  - `.seatmap-k__scroll { max-width:100%; overflow-x:auto; padding-bottom:8px; }` (cuộn ngang khi phòng rộng).
  - `.seatmap-k__grid { display:flex; flex-direction:column; gap:8px; width:max-content; margin:0 auto; }`.
  - `.seatmap-k__row { display:flex; align-items:center; gap:10px; }`; `.seatmap-k__rowlabel { width:16px; text-align:center; font-family:var(--font-mono); font-size:11px; color:var(--text-muted); flex:none; }`; `.seatmap-k__seats { display:flex; gap:6px; }`.
  - `.seatmap-k__seat { width:30px; height:30px; display:flex; align-items:center; justify-content:center; border:1px solid var(--border-strong); background:var(--surface); color:var(--text-muted); font-family:var(--font-mono); font-size:11px; cursor:pointer; padding:0; transition:transform .1s ease, background .1s; }` hover (không booked) `transform:translateY(-2px); border-color:var(--text);`. focus-visible `outline:2px solid var(--focus); outline-offset:2px; z-index:1;`.
  - `.seatmap-k__seat.is-vip { border-color:var(--red); color:var(--red); }`.
  - `.seatmap-k__seat.is-couplecell { width:66px; }` (ô đôi rộng gấp đôi + gap).
  - `.seatmap-k__seat.is-selected { background:var(--surface-invert); color:var(--text-invert); border-color:var(--surface-invert); }`.
  - `.seatmap-k__seat.is-booked { background:repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 3px, transparent 3px, transparent 6px); color:var(--text-dim); cursor:not-allowed; opacity:.6; }` hover `transform:none;`.
  - `.seatmap-k__hint { font-family:var(--font-mono); font-size:11px; color:var(--text-dim); }`.
  - `.seatmap-k__legend { display:flex; flex-wrap:wrap; gap:16px; justify-content:center; }`; `.seatmap-k__leg { display:flex; align-items:center; gap:6px; font-family:var(--font-mono); font-size:11px; color:var(--text-muted); }` `::before{ content:""; width:14px; height:14px; border:1px solid var(--border-strong); }` với biến thể: `.is-vip::before{border-color:var(--red)}` `.is-couple::before{width:24px}` `.is-selected::before{background:var(--surface-invert);border-color:var(--surface-invert)}` `.is-booked::before{background:var(--surface-2);opacity:.6}` `.is-standard::before{background:var(--surface)}`.
  - `@media (prefers-reduced-motion: reduce){ .seatmap-k__seat{transition:none} .seatmap-k__seat:hover{transform:none} }`.
  - **Xoá** mọi rule cũ: `.seat-step, .seat-zoom-controls, .seat-map-wrap, .seat-map-inner, .screen-container, .screen-curve, .screen-label, .seat-map, .seat-row, .row-label, .seats-in-row, .seat-slot, .seat, .seat-standard, .seat-vip, .seat-couple, .seat.booked, .seat.selected, .seat-tip, .seat-legend, .legend-item, .legend-dot, .lg-*`.

- [ ] **Step 8: Chạy gate** — `typecheck · lint · format:check · test:run · build` (fix format: `npx prettier --write src/lib/seatNav.ts src/lib/seatNav.test.ts src/pages/booking/SeatStep.tsx src/pages/booking/Booking.css`).

- [ ] **Step 9: Verify** — vào bước ① (restart dev nếu trắng). Kiểm: ghế ô vuông, VIP viền đỏ, ghế đôi rộng, đã đặt gạch chéo disabled, chọn ghế đảo bone + ✓; **Tab vào lưới → mũi tên di chuyển focus, Enter chọn**; mobile phòng rộng cuộn ngang. Screenshot desktop + mobile.

- [ ] **Step 10: Commit**

```bash
git add src/lib/seatNav.ts src/lib/seatNav.test.ts src/pages/booking/SeatStep.tsx src/pages/booking/Booking.css
git commit -m "$(cat <<'EOF'
feat(GD2e/3): SeatStep kinetic + roving tabindex (mui ten + Enter), helper seatNav

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4 (2e/4): Concession + Payment kinetic

**Files:**
- Create: `src/pages/booking/ConcessionStep.tsx` · Delete: `ConcessionStep.jsx`
- Create: `src/pages/booking/PaymentStep.tsx` · Delete: `PaymentStep.jsx`
- Modify: `src/pages/booking/Booking.css` (thêm `.fnb-k`/`.pay-k`; xoá khối cũ `.fnb-*`/`.pay-*`)

**Interfaces:**
- Consumes: `Concession` (types); `MAX_ITEM_QTY` (`lib/pricing`).
- Produces: `ConcessionStep({ catalog: Concession[]; qty: Record<number,number>; onChange:(id:number,delta:number)=>void; loading?:boolean; error?:boolean; onRetry?:()=>void })`; `PaymentStep({ method: string; onChange:(m:string)=>void })`.

- [ ] **Step 1: `ConcessionStep.tsx`** — port logic phân nhóm từ `.jsx` hiện có, đổi class kinetic + kiểu. Toàn văn:

```tsx
import type { Concession } from "types";
import { MAX_ITEM_QTY } from "lib/pricing";

const KNOWN_LABELS: Record<string, string> = {
  combo: "Combo tiết kiệm",
  popcorn: "Bắp rang",
  drink: "Nước uống",
  snack: "Snack",
};

const labelize = (key: string) =>
  key ? key[0].toUpperCase() + key.slice(1) : "Khác";

function categoriesOf(catalog: Concession[]) {
  const present = [...new Set(catalog.map((c) => c.category || "khac"))];
  const known = Object.keys(KNOWN_LABELS).filter((k) => present.includes(k));
  const extra = present.filter((k) => !(k in KNOWN_LABELS));
  return [...known, ...extra].map((key) => ({
    key,
    label: KNOWN_LABELS[key] || labelize(key),
  }));
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "₫";

export default function ConcessionStep({
  catalog = [],
  qty = {},
  onChange,
  loading,
  error,
  onRetry,
}: {
  catalog?: Concession[];
  qty?: Record<number, number>;
  onChange: (id: number, delta: number) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  if (loading) return <div className="fnb-k__msg">Đang tải bắp nước...</div>;
  if (error)
    return (
      <div className="fnb-k__msg">
        <p>Không tải được danh sách bắp nước.</p>
        {onRetry && (
          <button type="button" className="fnb-k__retry" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </div>
    );
  if (!catalog.length)
    return <div className="fnb-k__msg">Hiện chưa có bắp nước để chọn.</div>;

  return (
    <div className="fnb-k">
      <div className="fnb-k__head">
        <h2 className="fnb-k__title">Thêm bắp nước</h2>
        <p className="fnb-k__sub">
          Không bắt buộc — bạn có thể xác nhận đặt vé mà không chọn món nào.
        </p>
      </div>

      {categoriesOf(catalog).map(({ key, label }) => {
        const items = catalog.filter((c) => (c.category || "khac") === key);
        if (!items.length) return null;
        return (
          <section key={key} className="fnb-k__group">
            <h3 className="fnb-k__grouptitle">{label}</h3>
            <div className="fnb-k__grid">
              {items.map((item) => {
                const n = qty[item.id] || 0;
                return (
                  <article
                    key={item.id}
                    className={"fnb-k__card" + (n > 0 ? " is-picked" : "")}
                  >
                    <div className="fnb-k__emoji" aria-hidden="true">
                      {item.image}
                    </div>
                    <div className="fnb-k__info">
                      <h4 className="fnb-k__name">{item.name}</h4>
                      <p className="fnb-k__desc">{item.description}</p>
                      <span className="fnb-k__price">{fmt(item.price)}</span>
                    </div>
                    <div className="fnb-k__qty">
                      <button
                        type="button"
                        className="fnb-k__btn"
                        disabled={n === 0}
                        onClick={() => onChange(item.id, -1)}
                        aria-label={`Bớt ${item.name}`}
                      >
                        −
                      </button>
                      <span className="fnb-k__count">{n}</span>
                      <button
                        type="button"
                        className="fnb-k__btn"
                        disabled={n >= MAX_ITEM_QTY}
                        onClick={() => onChange(item.id, 1)}
                        aria-label={`Thêm ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: `PaymentStep.tsx`** — port từ `.jsx`, class kinetic + kiểu. Toàn văn:

```tsx
const METHODS = [
  { key: "momo", emoji: "💗", name: "Ví Momo", desc: "Quét mã QR trên app Momo để thanh toán." },
  { key: "card", emoji: "💳", name: "Thẻ ATM / Visa", desc: "Thẻ nội địa hoặc quốc tế (Visa, Mastercard)." },
  { key: "counter", emoji: "🏦", name: "Thanh toán tại quầy", desc: "Giữ chỗ và trả tiền mặt khi tới rạp." },
];

export default function PaymentStep({
  method,
  onChange,
}: {
  method: string;
  onChange: (m: string) => void;
}) {
  return (
    <div className="pay-k">
      <div className="pay-k__head">
        <h2 className="pay-k__title">Phương thức thanh toán</h2>
        <p className="pay-k__sub">
          Đây là bản demo — không nhập và không lưu thông tin thẻ thật.
        </p>
      </div>

      <div className="pay-k__methods">
        {METHODS.map((m) => (
          <label
            key={m.key}
            className={"pay-k__card" + (method === m.key ? " is-picked" : "")}
          >
            <input
              type="radio"
              name="payment"
              value={m.key}
              checked={method === m.key}
              onChange={() => onChange(m.key)}
            />
            <span className="pay-k__emoji" aria-hidden="true">
              {m.emoji}
            </span>
            <span className="pay-k__info">
              <span className="pay-k__name">{m.name}</span>
              <span className="pay-k__desc">{m.desc}</span>
            </span>
          </label>
        ))}
      </div>

      <p className="pay-k__note">
        🔒 Thông tin đơn hàng được mã hoá. Nhấn “Thanh toán” để hoàn tất và nhận
        vé điện tử.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Xoá file cũ** — `git rm src/pages/booking/ConcessionStep.jsx src/pages/booking/PaymentStep.jsx`

- [ ] **Step 4: `Booking.css` — thêm `.fnb-k`/`.pay-k`, xoá khối cũ.** Class + hành vi + token:
  - `.fnb-k__msg { padding:40px 0; text-align:center; color:var(--text-muted); font-family:var(--font-mono); font-size:13px; }`; `.fnb-k__retry` viền cứng mono, hover đảo.
  - `.fnb-k__head { margin-bottom:20px; }`; `.fnb-k__title` Bebas `32px`; `.fnb-k__sub` Barlow `14px` muted.
  - `.fnb-k__group { margin-bottom:24px; }`; `.fnb-k__grouptitle` mono `12px` uppercase letter-spacing muted, border-bottom 1px, padding-bottom 6px.
  - `.fnb-k__grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; }`.
  - `.fnb-k__card { display:flex; gap:12px; align-items:center; border:1px solid var(--border); background:var(--surface); padding:14px; transition:border-color .12s; }` `.is-picked{ border-color:var(--red); }`. `.fnb-k__emoji` font-size 32px flex-none. `.fnb-k__info{flex:1;min-width:0}`; `.fnb-k__name` Barlow `15px` bold; `.fnb-k__desc` `12px` muted; `.fnb-k__price` mono `13px` màu var(--red).
  - `.fnb-k__qty { display:flex; align-items:center; gap:8px; flex:none; }`; `.fnb-k__btn { width:28px;height:28px; border:1px solid var(--border-strong); background:var(--surface); color:var(--text); cursor:pointer; font-size:16px; line-height:1; }` `:disabled{opacity:.35;cursor:default}` hover(không disabled) đảo nền. `.fnb-k__count` mono `14px` min-width 20px text-center.
  - `.pay-k__head{margin-bottom:20px}`; `.pay-k__title` Bebas `32px`; `.pay-k__sub` Barlow `14px` muted.
  - `.pay-k__methods { display:flex; flex-direction:column; gap:10px; }`.
  - `.pay-k__card { display:flex; align-items:center; gap:14px; border:1px solid var(--border); background:var(--surface); padding:16px; cursor:pointer; transition:border-color .12s, background .12s; }` `.is-picked{ background:var(--surface-invert); color:var(--text-invert); border-color:var(--surface-invert); }`. `.pay-k__card input{ position:absolute; opacity:0; }` (ẩn radio, focus-visible ring trên card: `.pay-k__card:has(input:focus-visible){ outline:2px solid var(--focus); outline-offset:2px; }`). `.pay-k__emoji` font-size 26px. `.pay-k__info{display:flex;flex-direction:column;gap:2px}`; `.pay-k__name` Barlow `15px` bold; `.pay-k__desc` `12px` muted; `.is-picked .pay-k__desc{ color:color-mix(in srgb, var(--text-invert) 70%, transparent) }`.
  - `.pay-k__note { margin-top:16px; font-family:var(--font-mono); font-size:12px; color:var(--text-muted); }`.
  - `@media (prefers-reduced-motion: reduce){ .fnb-k__card, .pay-k__card{ transition:none } }`.
  - **Xoá** rule cũ: `.fnb-step,.fnb-head,.fnb-title,.fnb-sub,.fnb-empty,.fnb-retry,.fnb-group,.fnb-group-title,.fnb-grid,.fnb-card,.fnb-emoji,.fnb-info,.fnb-name,.fnb-desc,.fnb-price,.fnb-qty,.fnb-btn,.fnb-count` và `.pay-step,.pay-head,.pay-title,.pay-sub,.pay-methods,.pay-card,.pay-emoji,.pay-info,.pay-name,.pay-desc,.pay-radio,.pay-note`.

- [ ] **Step 5: Chạy gate** (fix format cho 2 tsx + css).

- [ ] **Step 6: Verify** — bước ② thẻ món kinetic, chọn → viền đỏ, −/+ hoạt động, chặn biên 0/10; bước ③ 3 thẻ, chọn đảo bone, focus bàn phím ring. Screenshot desktop + mobile.

- [ ] **Step 7: Commit**

```bash
git add src/pages/booking/ConcessionStep.tsx src/pages/booking/PaymentStep.tsx src/pages/booking/Booking.css
git commit -m "$(cat <<'EOF'
feat(GD2e/4): Concession + Payment kinetic (tsx)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5 (2e/5): TicketStep e-ticket "bone" + component `ETicket` tái dùng

Tách phần vé thành `ETicket` (dùng cho bước ④ **và** MyTickets ở Task 6). Đặt tại `src/components/ETicket.tsx` (chia sẻ ngoài `booking/` vì MyTickets ở `src/pages/`).

**Files:**
- Create: `src/components/ETicket.tsx`
- Create: `src/components/ETicket.css`
- Create: `src/pages/booking/TicketStep.tsx` · Delete: `TicketStep.jsx`
- Modify: `src/pages/booking/Booking.css` (thêm `.ticket-k` wrapper; xoá `.ticket-step/.ts-*/.eticket*/.booked-icon`)

**Interfaces:**
- Consumes: `Booking, Movie, Cinema, Room, Showtime` (types); `QRCodeSVG` (`qrcode.react`); `TicketEdge` (`components/ui`).
- Produces:
  - `ETicket({ booking, movie, cinema, room, showtime, size? }: { booking: Booking; movie?: Movie|null; cinema?: Cinema|null; room?: Room|null; showtime?: Showtime|null; size?: "full"|"compact" })` — khối vé bone dùng lại.
  - `TicketStep({ booking, movie, cinema, room, showtime })` — bọc `ETicket` + tiêu đề thành công + nút hành động.
  - Helper export `ticketCode(b)` và `qrValue(b)` từ `ETicket.tsx`.

- [ ] **Step 1: `src/components/ETicket.tsx`**:

```tsx
import { QRCodeSVG } from "qrcode.react";
import TicketEdge from "components/ui/TicketEdge";
import type { Booking, Movie, Cinema, Room, Showtime } from "types";
import "./ETicket.css";

const fmt = (n?: number) => (n || 0).toLocaleString("vi-VN") + "₫";
const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const fmtTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const METHOD_LABEL: Record<string, string> = {
  momo: "Ví Momo",
  card: "Thẻ ATM / Visa",
  counter: "Tại quầy",
};

export const ticketCode = (b: Booking) => `TK-${String(b.id).padStart(5, "0")}`;
export const qrValue = (b: Booking) =>
  `${ticketCode(b)}|${b.showtimeId}|${(b.seats || []).join(",")}`;

export default function ETicket({
  booking,
  movie,
  cinema,
  room,
  showtime,
  size = "full",
}: {
  booking: Booking;
  movie?: Movie | null;
  cinema?: Cinema | null;
  room?: Room | null;
  showtime?: Showtime | null;
  size?: "full" | "compact";
}) {
  const code = ticketCode(booking);
  const qrSize = size === "compact" ? 96 : 148;

  return (
    <TicketEdge className={`eticket-k eticket-k--${size}`}>
      <div className="eticket-k__main">
        <div className="eticket-k__top">
          <span className="eticket-k__brand">THE CINEMATIC EDITORIAL</span>
          <span className="eticket-k__code">N°{code}</span>
        </div>
        <h3 className="eticket-k__title">
          {movie?.title || `Phim #${booking.movieId}`}
        </h3>
        <p className="eticket-k__cinema">
          {cinema?.name}
          {room ? ` · ${room.name} · ${room.type}` : ""}
        </p>
        <div className="eticket-k__grid">
          <div>
            <span className="eticket-k__label">Ngày</span>
            <span className="eticket-k__value">{fmtDate(showtime?.time)}</span>
          </div>
          <div>
            <span className="eticket-k__label">Giờ</span>
            <span className="eticket-k__value">{fmtTime(showtime?.time)}</span>
          </div>
          <div>
            <span className="eticket-k__label">Ghế</span>
            <span className="eticket-k__value eticket-k__seats">
              {(booking.seats || []).join(", ") || "—"}
            </span>
          </div>
          <div>
            <span className="eticket-k__label">Thanh toán</span>
            <span className="eticket-k__value">
              {METHOD_LABEL[booking.paymentMethod || ""] ||
                booking.paymentMethod ||
                "—"}
            </span>
          </div>
        </div>
        {booking.concessions && booking.concessions.length > 0 && (
          <div className="eticket-k__fnb">
            <span className="eticket-k__label">Bắp nước</span>
            <span className="eticket-k__value">
              {booking.concessions.map((c) => `${c.name} ×${c.qty}`).join(", ")}
            </span>
          </div>
        )}
        <div className="eticket-k__total">
          <span>Tổng cộng</span>
          <span className="eticket-k__total-amount">{fmt(booking.totalPrice)}</span>
        </div>
      </div>

      <div className="eticket-k__stub">
        <div className="eticket-k__qr">
          <QRCodeSVG value={qrValue(booking)} size={qrSize} level="M" />
        </div>
        <span className="eticket-k__stubcode">{code}</span>
        <span className="eticket-k__stubhint">Quét để soát vé</span>
      </div>
    </TicketEdge>
  );
}
```

- [ ] **Step 2: `src/components/ETicket.css`** — khối bone. Class + hành vi + token:
  - `.eticket-k { display:grid; grid-template-columns:1fr 200px; background:var(--surface-invert); color:var(--text-invert); }` (nền bone, chữ đen). `.eticket-k--compact{ grid-template-columns:1fr 150px; }`.
  - `.eticket-k__main { padding:24px; border-right:2px dashed color-mix(in srgb, var(--text-invert) 30%, transparent); }`.
  - `.eticket-k__top { display:flex; justify-content:space-between; align-items:baseline; font-family:var(--font-mono); font-size:11px; letter-spacing:2px; }`; `.eticket-k__code` màu var(--red).
  - `.eticket-k__title { font-family:"Bebas Neue"; font-size:40px; line-height:.95; margin:12px 0 4px; }` (compact `28px`). `.eticket-k__cinema { font-family:var(--font-mono); font-size:12px; opacity:.7; }`.
  - `.eticket-k__grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; }`; `.eticket-k__label { display:block; font-family:var(--font-mono); font-size:10px; text-transform:uppercase; letter-spacing:1px; opacity:.6; }`; `.eticket-k__value { font-family:"Barlow Condensed",sans-serif; font-size:18px; font-weight:600; }`; `.eticket-k__seats{ color:var(--red); }`.
  - `.eticket-k__fnb { margin-top:12px; }`.
  - `.eticket-k__total { display:flex; justify-content:space-between; align-items:baseline; margin-top:16px; padding-top:12px; border-top:1px solid color-mix(in srgb, var(--text-invert) 20%, transparent); font-family:var(--font-mono); font-size:12px; }`; `.eticket-k__total-amount { font-family:"Bebas Neue"; font-size:30px; color:var(--red); }`.
  - `.eticket-k__stub { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:20px; }`; `.eticket-k__qr { background:#fff; padding:8px; }` (nền trắng cho QR tương phản trên bone); `.eticket-k__stubcode { font-family:var(--font-mono); font-size:12px; letter-spacing:2px; }`; `.eticket-k__stubhint { font-family:var(--font-mono); font-size:10px; opacity:.6; }`.
  - `@media (max-width:560px){ .eticket-k, .eticket-k--compact{ grid-template-columns:1fr; } .eticket-k__main{ border-right:none; border-bottom:2px dashed color-mix(in srgb, var(--text-invert) 30%, transparent); } }`.

  > **Lưu ý:** `TicketEdge` render `<div class="ui-ticket …">`; class `eticket-k` truyền qua `className` sẽ nằm cùng element. Nếu `.ui-ticket` (xem `ui.css:305`) áp padding/nền xung đột, bọc nội dung trong `.eticket-k` là con của `.ui-ticket` thay vì cùng cấp — kiểm khi chạy, ưu tiên để `eticket-k` là lớp trình bày chính (grid + nền bone).

- [ ] **Step 3: `src/pages/booking/TicketStep.tsx`**:

```tsx
import { useNavigate } from "react-router-dom";
import ETicket from "components/ETicket";
import type { Booking, Movie, Cinema, Room, Showtime } from "types";

export default function TicketStep({
  booking,
  movie,
  cinema,
  room,
  showtime,
}: {
  booking: Booking | null;
  movie?: Movie | null;
  cinema?: Cinema | null;
  room?: Room | null;
  showtime?: Showtime | null;
}) {
  const navigate = useNavigate();
  if (!booking) return null;

  return (
    <div className="ticket-k">
      <div className="ticket-k__success">
        <div className="ticket-k__check" aria-hidden="true">
          ✓
        </div>
        <h2 className="ticket-k__successtitle">Đặt vé thành công!</h2>
        <p className="ticket-k__successsub">
          Vé điện tử của bạn đã sẵn sàng. Xuất trình mã QR tại rạp để vào cửa.
        </p>
      </div>

      <ETicket
        booking={booking}
        movie={movie}
        cinema={cinema}
        room={room}
        showtime={showtime}
      />

      <div className="ticket-k__actions">
        <button
          type="button"
          className="ticket-k__primary"
          onClick={() => navigate("/tickets")}
        >
          Xem vé của tôi
        </button>
        <button
          type="button"
          className="ticket-k__ghost"
          onClick={() => navigate("/")}
        >
          Về trang chủ
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Xoá file cũ** — `git rm src/pages/booking/TicketStep.jsx`

- [ ] **Step 5: `Booking.css` — thêm `.ticket-k`, xoá khối vé cũ.** Class + hành vi + token:
  - `.ticket-k { max-width:760px; margin:0 auto; display:flex; flex-direction:column; gap:24px; align-items:center; }`.
  - `.ticket-k__success { text-align:center; }`; `.ticket-k__check { width:52px;height:52px; border-radius:50%; background:var(--red); color:#fff; display:flex; align-items:center; justify-content:center; font-size:26px; margin:0 auto 12px; }`; `.ticket-k__successtitle` Bebas `40px`; `.ticket-k__successsub` Barlow `14px` muted.
  - `.ticket-k .eticket-k { width:100%; }`.
  - `.ticket-k__actions { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }`; `.ticket-k__primary` = nút đỏ (giống `.os-k__cta`); `.ticket-k__ghost { background:none; border:1px solid var(--border-strong); color:var(--text); padding:14px 24px; font-family:var(--font-mono); font-size:13px; cursor:pointer; }`.
  - **Xoá** rule cũ: `.ticket-step,.ts-success,.ts-success-title,.ts-success-sub,.booked-icon,.eticket,.eticket-main,.eticket-top,.eticket-brand,.eticket-code,.eticket-title,.eticket-cinema,.eticket-grid,.eticket-label,.eticket-value,.eticket-seats,.eticket-fnb,.eticket-total,.eticket-total-amount,.eticket-stub,.eticket-qr,.eticket-stub-code,.eticket-stub-hint,.ts-actions`.

- [ ] **Step 6: Chạy gate** (fix format cho ETicket.tsx/.css, TicketStep.tsx, Booking.css).

- [ ] **Step 7: Verify** — đặt vé xong tới bước ④: khối bone (nền trắng ngà chữ đen), cuống QR tách răng cưa, mã `N°TK-…`, tổng đỏ; nút "Xem vé của tôi"/"Về trang chủ". Mobile: vé xếp dọc. Screenshot desktop + mobile.

- [ ] **Step 8: Commit**

```bash
git add src/components/ETicket.tsx src/components/ETicket.css src/pages/booking/TicketStep.tsx src/pages/booking/Booking.css
git commit -m "$(cat <<'EOF'
feat(GD2e/5): TicketStep e-ticket bone + component ETicket tai dung

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6 (2e/6): MyTickets kinetic + Query (dùng `ETicket`)

**Files:**
- Create: `src/pages/MyTickets.tsx` · Delete: `MyTickets.jsx`
- Rewrite: `src/pages/MyTickets.css` (kinetic; xoá class cũ `.tickets-*/.ticket-*/.tk-modal-*/.perk*/.tab-btn/.no-tickets/.loading-spinner`)

**Interfaces:**
- Consumes: `useMyBookings` (Task 1); `getMovie,getShowtime,getCinema,getRoom` (`services/api`); `useQueries` (@tanstack/react-query) để enrich; `ETicket` (`components/ETicket`); `useAuth`; `Skeleton` (`components/ui`); `Navbar/Footer`.
- Produces: `MyTickets` default (route `/tickets`).

> **Cách enrich với Query:** giữ đơn giản — sau khi `useMyBookings` có data, enrich bằng một `useQuery` phụ (`queryKey: ["myBookings","enriched", ids]`) gọi `Promise.all` như bản `.jsx`. Không cần từng entity 1 query. Tránh `useQueries` động phức tạp.

- [ ] **Step 1: `src/pages/MyTickets.tsx`**:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMovie, getShowtime, getCinema, getRoom } from "services/api";
import { useMyBookings } from "queries/booking";
import ETicket from "components/ETicket";
import { useAuth } from "context/AuthContext";
import { Skeleton } from "components/ui";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import type { Booking, Movie, Showtime, Cinema, Room } from "types";
import "./MyTickets.css";

interface Enriched extends Booking {
  movie: Movie | null;
  showtime: Showtime | null;
  cinema: Cinema | null;
  room: Room | null;
}

export default function MyTickets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const bookingsQ = useMyBookings();
  const bookings = bookingsQ.data ?? [];

  // Enrich mot lan sau khi co danh sach ve (key theo cac id vé).
  const ids = bookings.map((b) => b.id).join(",");
  const enrichedQ = useQuery({
    queryKey: ["myBookings", "enriched", ids],
    enabled: bookings.length > 0,
    queryFn: async (): Promise<Enriched[]> =>
      Promise.all(
        bookings.map(async (b) => {
          const [movie, showtime, cinema, room] = await Promise.all([
            getMovie(b.movieId).catch(() => null),
            getShowtime(b.showtimeId).catch(() => null),
            b.cinemaId ? getCinema(b.cinemaId).catch(() => null) : null,
            b.roomId ? getRoom(b.roomId).catch(() => null) : null,
          ]);
          return { ...b, movie, showtime, cinema, room };
        }),
      ),
  });

  const loading = bookingsQ.isLoading || (bookings.length > 0 && enrichedQ.isLoading);
  const enriched = enrichedQ.data ?? [];

  const now = new Date();
  const filtered = enriched.filter((b) => {
    if (!b.showtime?.time) return tab === "upcoming";
    const d = new Date(b.showtime.time);
    return tab === "upcoming" ? d >= now : d < now;
  });

  return (
    <div className="page mytk-k">
      <Navbar />
      <div className="mytk-k__content">
        <header className="mytk-k__header">
          <span className="mytk-k__label">Tài khoản</span>
          <h1 className="mytk-k__title">Vé của tôi</h1>
          {user && (
            <p className="mytk-k__hello">
              Xin chào, <strong>{user.fullName}</strong>
            </p>
          )}
        </header>

        <div className="mytk-k__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "upcoming"}
            className={"mytk-k__tab" + (tab === "upcoming" ? " is-active" : "")}
            onClick={() => setTab("upcoming")}
          >
            Sắp tới
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "past"}
            className={"mytk-k__tab" + (tab === "past" ? " is-active" : "")}
            onClick={() => setTab("past")}
          >
            Đã xem
          </button>
        </div>

        {bookingsQ.isError ? (
          <div className="mytk-k__empty">
            <p>Không tải được vé. Thử lại nhé.</p>
            <button
              type="button"
              className="mytk-k__cta"
              onClick={() => bookingsQ.refetch()}
            >
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="mytk-k__list">
            <Skeleton height="200px" />
            <Skeleton height="200px" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mytk-k__empty">
            <p className="mytk-k__empty-title">
              {tab === "upcoming" ? "Chưa có vé sắp tới" : "Chưa có vé đã xem"}
            </p>
            <button
              type="button"
              className="mytk-k__cta"
              onClick={() => navigate("/movies")}
            >
              Đặt vé ngay
            </button>
          </div>
        ) : (
          <div className="mytk-k__list">
            {filtered.map((b) => (
              <div
                key={b.id}
                className={"mytk-k__item" + (tab === "past" ? " is-past" : "")}
              >
                <ETicket
                  booking={b}
                  movie={b.movie}
                  cinema={b.cinema}
                  room={b.room}
                  showtime={b.showtime}
                  size="compact"
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Xoá file cũ** — `git rm src/pages/MyTickets.jsx`

- [ ] **Step 3: Rewrite `src/pages/MyTickets.css`** — kinetic. Class + hành vi + token:
  - `.mytk-k { background:var(--bg); min-height:100vh; }`.
  - `.mytk-k__content { max-width:var(--container-max); margin:0 auto; padding:48px var(--gutter) 72px; }`.
  - `.mytk-k__header { margin-bottom:24px; }`; `.mytk-k__label` mono `11px` uppercase muted; `.mytk-k__title` Bebas `clamp(44px,7vw,88px)` line-height .9; `.mytk-k__hello` Barlow `14px` muted, `strong{color:var(--text)}`.
  - `.mytk-k__tabs { display:flex; gap:0; border-bottom:1px solid var(--border); margin-bottom:28px; }`; `.mytk-k__tab { background:none; border:none; border-bottom:2px solid transparent; padding:10px 18px; font-family:var(--font-mono); font-size:12px; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-muted); cursor:pointer; }` `.is-active{ color:var(--text); border-bottom-color:var(--red); }`.
  - `.mytk-k__list { display:flex; flex-direction:column; gap:20px; }`.
  - `.mytk-k__item { border:1px solid var(--border); }` `.is-past{ opacity:.6; }` (vé đã xem mờ). `.mytk-k__item .eticket-k{ /* bone giữ nguyên */ }`.
  - `.mytk-k__empty { text-align:center; padding:60px 0; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:16px; }`; `.mytk-k__empty-title` Bebas `32px` màu var(--text).
  - `.mytk-k__cta { background:var(--red); color:#fff; border:none; padding:12px 24px; font-family:var(--font-mono); font-size:13px; text-transform:uppercase; letter-spacing:1.5px; cursor:pointer; }`.
  - `@media (max-width:640px){ .mytk-k__content{ padding-top:32px; } }`.
  - **Xoá** toàn bộ class cũ trong file (tickets-page/tickets-content/tickets-page-header/tickets-title/tickets-tabs/tab-btn/tickets-grid/ticket-card/ticket-poster*/ticket-badge/ticket-body/ticket-header/ticket-cinema*/ticket-id/ticket-title/ticket-info*/ticket-fnb/ticket-actions/qr-box/no-tickets/loading-spinner/perks-*/perk-*/tk-modal-*).

- [ ] **Step 4: Chạy gate** (restart dev do đổi ext; fix format).

- [ ] **Step 5: Verify** — đăng nhập, `/tickets`: header Bebas lớn, tab Sắp tới/Đã xem, mỗi vé là e-ticket bone compact (đồng bộ bước ④), vé đã xem mờ, empty state có nút "Đặt vé ngay", loading ra Skeleton. Screenshot desktop + mobile.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MyTickets.tsx src/pages/MyTickets.css
git commit -m "$(cat <<'EOF'
feat(GD2e/6): MyTickets kinetic + Query (tsx, tai dung ETicket)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7 (2e/7): Playwright smoke + rà class cũ + verify + push

**Files:**
- Modify: `e2e/smoke.spec.ts`
- Modify: `src/pages/booking/Booking.css` (rà & xoá mọi class cũ còn sót nếu có)

**Interfaces:** không sản sinh API mới.

- [ ] **Step 1: Rà `Booking.css`** — tìm còn class cũ nào không dùng (grep các tiền tố `.seat-`, `.fnb-` không `-k`, `.pay-` không `-k`, `.eticket`, `.ticket-step`, `.stepper` không `-k`, `.hold-timer`, `.order-summary`, `.os-` không `-k`, `.booking-page`, `.booking-body`, `.booking-topbar`, `.expire-banner`). Xoá những gì không còn tham chiếu trong `.tsx`.

Run: `grep -nE "\.(seat-|fnb-|pay-|eticket|ticket-step|stepper[^-]|hold-timer|order-summary|os-[a-z]+[^-k]|booking-page|booking-body|booking-topbar|expire-banner)" src/pages/booking/Booking.css` → kỳ vọng rỗng (hoặc chỉ còn class `-k`). Xoá phần thừa.

- [ ] **Step 2: Thêm smoke test** vào cuối `e2e/smoke.spec.ts` (đăng nhập trước vì `/seats` được bảo vệ; dừng ở bước ③, **không** bấm "Thanh toán"):

```ts
test("luồng đặt vé: chọn ghế và qua các bước (không thanh toán)", async ({
  page,
}) => {
  // Đăng nhập (route /seats/* được PrivateRoute bảo vệ)
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill("admin@cinema.vn");
  await page.getByPlaceholder("••••••••").fill("admin123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL("/");

  // Vào một suất thật qua phim -> nút giờ
  await page.goto("/movies");
  await page.locator(".movie-k").first().click();
  await expect(page).toHaveURL(/\/movie\/\d+/);
  await page.locator(".time-k-btn").first().click();
  await expect(page).toHaveURL(/\/seats\/\d+/);

  // Bước ①: sơ đồ ghế hiển thị, chọn một ghế trống
  await expect(page.locator(".seatmap-k__grid")).toBeVisible();
  const freeSeat = page
    .locator(".seatmap-k__seat:not(.is-booked)")
    .first();
  await freeSeat.click();
  // Ghế xuất hiện trong tóm tắt đơn
  await expect(page.locator(".os-k__seatlist")).not.toHaveText("Chưa chọn");

  // Sang bước ② rồi ③ (không bấm Thanh toán để không ghi db.json)
  await page.locator(".os-k__cta").click(); // Tiếp tục -> ②
  await expect(page.locator(".fnb-k, .fnb-k__msg")).toBeVisible();
  await page.locator(".os-k__cta").click(); // Tiếp tục -> ③
  await expect(page.locator(".pay-k")).toBeVisible();
});

test("trang vé của tôi hiển thị sau khi đăng nhập", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill("admin@cinema.vn");
  await page.getByPlaceholder("••••••••").fill("admin123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/tickets");
  await expect(
    page.getByRole("heading", { name: "Vé của tôi" }),
  ).toBeVisible();
  await expect(page.locator(".mytk-k__tab").first()).toBeVisible();
});
```

- [ ] **Step 3: Chạy toàn bộ gate**

Run: `npm run typecheck` · `npm run lint` · `npm run format:check` · `npm run test:run` · `npm run build` → tất cả xanh.
Run: `npm run e2e` → tất cả smoke PASS (gồm 2 test mới).

> Nếu phim đầu tiên không có suất (`.time-k-btn` không có) → đổi sang lấy phim/suất chắc chắn có, hoặc điều hướng trực tiếp tới một `showtimeId` tồn tại trong `db.json`. Ưu tiên ổn định; giữ read-only.

- [ ] **Step 4: Commit + push**

```bash
git add e2e/smoke.spec.ts src/pages/booking/Booking.css
git commit -m "$(cat <<'EOF'
test(GD2e/7): smoke luong dat ve + MyTickets; ra sach class cu Booking.css

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 5: Verify CI xanh** qua GitHub API:
`https://api.github.com/repos/khanhnguyen1205/cinema-full/actions/runs` — chờ run mới nhất `conclusion: success`.

---

## Self-Review

**Spec coverage:**
- §2 Tầng dữ liệu (occupied poll, concessions, myBookings, createBooking, hold/release giữ mệnh lệnh, suy dẫn booked) → Task 1 + Task 2 ✅
- §3 Kiến trúc TSX + ranh giới wizard/step → Task 2–6 ✅
- §4 Visual Kinetic từng phần (shell/stepper/timer/summary, seat, fnb, payment, e-ticket) → Task 2/3/4/5 ✅
- §5 Roving tabindex (1 tab-stop, mũi tên, Enter, aria, focus theo seatNumber) → Task 3 ✅
- §6 MyTickets Query + kinetic + ETicket tái dùng → Task 5 (ETicket) + Task 6 ✅
- §7 Test (unit key + unit seatNav + smoke đặt vé/MyTickets + screenshot) → Task 1/3/7 ✅
- §8 Chẻ 7 lát → Task 1–7 ✅
- §10 Rủi ro (helper+test cho tabindex, lát spine tách data, ETicket chống lặp, HMR, smoke không ghi) → đã nhúng ✅

**Placeholder scan:** không "TBD/TODO". CSS mô tả bằng class + hành vi + token cụ thể (khớp phong cách plan 2a–2d, polish pixel lúc chạy có chủ đích). Code TS/TSX đầy đủ; file convert nêu toàn văn (vì đổi nhiều) — không dùng "similar to".

**Type consistency:** `useOccupiedSeats/useConcessions/useMyBookings/useCreateBooking` khớp Task 1↔2↔6. `nextSeat(layout,current,dir)` + `SeatDir` khớp Task 3 test↔impl↔SeatStep. `ETicket` props (`booking,movie,cinema,room,showtime,size`) + `ticketCode/qrValue` khớp Task 5↔6. `OrderSummary` props khớp cách wizard truyền (Task 2). `qk.occupiedSeats/concessions/myBookings` nhất quán keys↔hook↔invalidate.

**Rủi ro đã ghi:** `allowJs` cho phép `.tsx` import step `.jsx` tạm ở Task 2; `TicketEdge`/`.ui-ticket` có thể chồng style → ghi chú kiểm khi chạy ở Task 5; smoke phụ thuộc phim-có-suất → phương án dự phòng ở Task 7.
