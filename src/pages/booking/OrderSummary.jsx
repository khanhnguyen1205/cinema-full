import { vipPrice, couplePrice } from "lib/pricing";

const fmt = (n) => n.toLocaleString("vi-VN") + "₫";
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

export default function OrderSummary({
  movie, cinema, room, showtime, selected, base, fnb = [],
  serviceFee, total, primaryLabel, primaryDisabled, loading, onPrimary, error,
  secondaryLabel, onSecondary,
}) {
  const std = selected.filter((s) => !s.isVip && !s.isCouple);
  const vip = selected.filter((s) => s.isVip);
  const cpl = selected.filter((s) => s.isCouple);

  return (
    <aside className="order-summary">
      {movie && (
        <div className="os-movie">
          <h2 className="os-title">{movie.title}</h2>
          <p className="os-meta">{movie.genre?.toUpperCase()} · {movie.duration} PHÚT</p>
          <p className="os-cinema">{cinema?.name} · {room?.name} · {room?.type}</p>
          <div className="os-grid">
            <div><span className="os-label">Ngày</span><span className="os-value">{fmtDate(showtime?.time)}</span></div>
            <div><span className="os-label">Giờ</span><span className="os-value">{fmtTime(showtime?.time)}</span></div>
          </div>
          <div className="os-seats">
            <span className="os-label">Ghế đã chọn</span>
            <span className="os-value os-seat-list">{selected.length ? selected.map((s) => s.seatNumber).join(", ") : "Chưa chọn"}</span>
          </div>
        </div>
      )}
      <div className="os-breakdown">
        {std.length > 0 && <div className="os-row"><span>Ghế thường (×{std.length})</span><span>{fmt(std.length * base)}</span></div>}
        {vip.length > 0 && <div className="os-row"><span>Ghế VIP (×{vip.length})</span><span>{fmt(vip.length * vipPrice(base))}</span></div>}
        {cpl.length > 0 && <div className="os-row"><span>Ghế đôi (×{cpl.length})</span><span>{fmt(cpl.length * couplePrice(base))}</span></div>}
        {fnb.length > 0 && <div className="os-subhead">Bắp nước</div>}
        {fnb.map((l) => (
          <div className="os-row" key={l.id}><span>{l.name} (×{l.qty})</span><span>{fmt(l.amount)}</span></div>
        ))}
        {selected.length > 0 && <div className="os-row"><span>Phí dịch vụ</span><span>{fmt(serviceFee)}</span></div>}
        <div className="os-row os-total"><span>TỔNG CỘNG</span><span className="os-total-amount">{fmt(total)}</span></div>
      </div>
      {error && <div className="os-error">{error}</div>}
      <button className="btn-primary os-confirm" disabled={primaryDisabled || loading} onClick={onPrimary}>
        {loading ? "Đang xử lý..." : primaryLabel}
      </button>
      {secondaryLabel && (
        <button className="os-skip" disabled={loading} onClick={onSecondary}>{secondaryLabel}</button>
      )}
    </aside>
  );
}
