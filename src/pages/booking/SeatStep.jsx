import { useState } from "react";
import { aisleCols, priceOf, seatType, SEAT_TYPE } from "lib/pricing";

const fmt = (n) => n.toLocaleString("vi-VN") + "₫";

export default function SeatStep({ layout, booked, selected, base, room, onToggle }) {
  const [zoom, setZoom] = useState(1);
  const aisles = aisleCols(room);
  const selKeys = new Set(selected.map((s) => s.seatNumber));

  return (
    <div className="seat-step">
      <div className="seat-zoom-controls">
        <button onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2)))} aria-label="Thu nhỏ">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} aria-label="Phóng to">+</button>
      </div>

      <div className="seat-map-wrap">
        <div className="seat-map-inner" style={{ transform: `scale(${zoom})` }}>
          <div className="screen-container"><div className="screen-curve" /><div className="screen-label">MÀN HÌNH CHIẾU</div></div>

          <div className="seat-map">
            {layout.map(({ row, seats }) => (
              <div key={row} className="seat-row">
                <span className="row-label">{row}</span>
                <div className="seats-in-row">
                  {seats.map((seat) => {
                    const isBooked = booked.has(seat.seatNumber);
                    const isSel = selKeys.has(seat.seatNumber);
                    const type = seatType(seat);
                    return (
                      <span key={seat.seatNumber} className="seat-slot" style={{ marginRight: aisles.includes(seat.col) ? 22 : undefined }}>
                        <button
                          className={`seat seat-${type} ${isBooked ? "booked" : ""} ${isSel ? "selected" : ""}`}
                          disabled={isBooked}
                          onClick={() => onToggle(seat)}
                        >
                          {isSel && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                          <span className="seat-tip">{seat.seatNumber} · {SEAT_TYPE[type].label} · {fmt(priceOf(seat, base))}</span>
                        </button>
                      </span>
                    );
                  })}
                </div>
                <span className="row-label">{row}</span>
              </div>
            ))}
          </div>

          <div className="seat-legend">
            <div className="legend-item"><span className="legend-dot lg-standard" />Thường {fmt(base)}</div>
            <div className="legend-item"><span className="legend-dot lg-vip" />VIP</div>
            <div className="legend-item"><span className="legend-dot lg-couple" />Đôi</div>
            <div className="legend-item"><span className="legend-dot lg-selected" />Đang chọn</div>
            <div className="legend-item"><span className="legend-dot lg-booked" />Đã đặt</div>
          </div>
        </div>
      </div>
    </div>
  );
}
