// Bản port thuần JS của src/lib/pricing.ts. KHÔNG import được bản gốc: file đó
// dùng path-alias "types" mà chỉ Vite/tsc phân giải. Cùng lý do với
// server/src/payments/quote.ts. Khoá bằng src/lib/seedPricing.test.ts — sửa một
// bên mà quên bên kia là test đỏ ngay.
export const ROOM_TYPE_PRICE = { "2D": 75000, "3D": 95000, IMAX: 120000 };
export const SERVICE_FEE = 15000;
export const MAX_SEATS = 8;

const roundTo1000 = (n) => Math.round(n / 1000) * 1000;
const rowLetter = (i) => String.fromCharCode(65 + i);

export const vipPrice = (base) => roundTo1000(base * 1.3);
export const couplePrice = (base) => roundTo1000(base * 1.6);
export const coupleUnits = (cols) => Math.floor(cols / 2);

export function seatType(seat) {
  if (seat.isCouple) return "couple";
  if (seat.isVip) return "vip";
  return "standard";
}

export function priceOf(seat, base) {
  if (seat.isCouple) return couplePrice(base);
  if (seat.isVip) return vipPrice(base);
  return base;
}

export function buildSeatLayout(room) {
  const rows = [];
  for (let r = 0; r < room.rows; r++) {
    const row = rowLetter(r);
    const coupleR = (room.coupleRows || []).includes(row);
    const count = coupleR ? coupleUnits(room.cols) : room.cols;
    const seats = [];
    for (let c = 1; c <= count; c++) {
      seats.push({
        seatNumber: `${row}${c}`,
        row,
        col: c,
        isVip: !coupleR && (room.vipRows || []).includes(row),
        isCouple: coupleR,
      });
    }
    rows.push({ row, seats, isCouple: coupleR });
  }
  return rows;
}

export const flatSeats = (room) =>
  buildSeatLayout(room).flatMap((r) => r.seats);
