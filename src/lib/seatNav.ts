import type { SeatRow, Seat } from "types";

export type SeatDir = "left" | "right" | "up" | "down";

// Ghế kế tiếp khi bấm mũi tên. Nhảy qua khe trống (aisle) bằng cách chọn ghế
// có `col` gần nhất ở hàng đích. Kẹt biên -> trả chính ghế hiện tại (không wrap).
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
  // Chọn ghế có col gần current.col nhất (xử lý hàng ghế đôi ít cột hơn).
  return target.seats.reduce((best, s) =>
    Math.abs(s.col - current.col) < Math.abs(best.col - current.col) ? s : best,
  );
}
