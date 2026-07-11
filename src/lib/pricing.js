export const ROOM_TYPE_PRICE = { "2D": 75000, "3D": 95000, "IMAX": 120000 };
export const SERVICE_FEE = 15000;

const rowLetter = (i) => String.fromCharCode(65 + i); // 0 -> A

export const vipPrice = (basePrice) => Math.round((basePrice * 1.3) / 1000) * 1000;
export const isVipRow = (row, vipRows = []) => vipRows.includes(row);

export function buildSeatLayout(room) {
  if (!room) return [];
  const rows = [];
  for (let r = 0; r < room.rows; r++) {
    const row = rowLetter(r);
    const seats = [];
    for (let c = 1; c <= room.cols; c++) {
      seats.push({ seatNumber: `${row}${c}`, row, col: c, isVip: isVipRow(row, room.vipRows) });
    }
    rows.push({ row, seats });
  }
  return rows;
}

export function bookedSeatSet(showtime, bookings = []) {
  const set = new Set(showtime?.bookedSeats || []);
  bookings
    .filter((b) => b.showtimeId === showtime?.id)
    .forEach((b) => (b.seats || []).forEach((s) => set.add(s)));
  return set;
}

export const priceOf = (seat, basePrice) => (seat.isVip ? vipPrice(basePrice) : basePrice);
