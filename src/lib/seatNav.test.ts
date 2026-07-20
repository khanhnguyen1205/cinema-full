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
