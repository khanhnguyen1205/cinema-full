import { vipPrice, couplePrice } from "lib/pricing";
import type { FnbLine } from "lib/pricing";
import type { Movie, Cinema, Room, Showtime, Seat } from "types";

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
