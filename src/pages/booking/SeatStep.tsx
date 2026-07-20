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

  // Nếu ghế đang focus biến mất khỏi layout (đổi phòng), về ghế đầu.
  useEffect(() => {
    const exists = layout.some((r) =>
      r.seats.some((s) => s.seatNumber === focused),
    );
    if (!exists && firstSeat) setFocused(firstSeat);
  }, [layout, focused, firstSeat]);

  // Dời focus DOM theo `focused` sau khi re-render (roving tabindex). Chỉ chuyển
  // khi bàn phím đang ở trong lưới, để không cướp focus lúc mount/re-render khác.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !grid.contains(document.activeElement)) return;
    grid
      .querySelector<HTMLButtonElement>(`[data-seat="${CSS.escape(focused)}"]`)
      ?.focus();
  }, [focused]);

  const move = (current: Seat, dir: SeatDir) => {
    const next = nextSeat(layout, current, dir);
    if (next) setFocused(next.seatNumber);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, seat: Seat) => {
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

      <p className="seatmap-k__hint">
        Dùng phím mũi tên để di chuyển, Enter để chọn.
      </p>

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
