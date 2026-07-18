import type {
  Booking,
  Concession,
  Room,
  RoomType,
  Seat,
  SeatRow,
  SeatTypeKey,
  Showtime,
} from "types";

export const ROOM_TYPE_PRICE: Record<RoomType, number> = {
  "2D": 75000,
  "3D": 95000,
  IMAX: 120000,
};
export const SERVICE_FEE = 15000;
export const MAX_SEATS = 8;
export const MAX_ITEM_QTY = 10;
export const COUPLE_MULTIPLIER = 1.6;

const rowLetter = (i: number): string => String.fromCharCode(65 + i); // 0 -> A
const roundTo1000 = (n: number): number => Math.round(n / 1000) * 1000;

export const vipPrice = (basePrice: number): number =>
  roundTo1000(basePrice * 1.3);
export const couplePrice = (basePrice: number): number =>
  roundTo1000(basePrice * COUPLE_MULTIPLIER);
export const isVipRow = (row: string, vipRows: string[] = []): boolean =>
  vipRows.includes(row);
export const isCoupleRow = (row: string, coupleRows: string[] = []): boolean =>
  coupleRows.includes(row);

export const SEAT_TYPE: Record<SeatTypeKey, { label: string }> = {
  standard: { label: "Thường" },
  vip: { label: "VIP" },
  couple: { label: "Đôi" },
};

export const seatType = (
  seat: Pick<Seat, "isVip" | "isCouple">,
): SeatTypeKey => (seat.isCouple ? "couple" : seat.isVip ? "vip" : "standard");

// Cột nào chèn lối đi ngay sau: đọc từ room.aisleAfterCols, mặc định 1 lối giữa
export function aisleCols(room?: Room | null): number[] {
  if (!room) return [];
  if (Array.isArray(room.aisleAfterCols)) return room.aisleAfterCols;
  return [Math.floor(room.cols / 2)];
}

// Ghế đôi chiếm chỗ của 2 ghế thường, nên hàng ghế đôi chỉ chứa được nửa số đơn vị.
// Phòng 12 cột -> hàng ghế đôi có 6 ghế (H1..H6), không phải 12.
export const coupleUnits = (cols: number): number => Math.floor(cols / 2);

export const seatsInRow = (room: Room, isCouple: boolean): number =>
  isCouple ? coupleUnits(room.cols) : room.cols;

// Lối đi quy đổi sang đơn vị ghế của chính hàng đó: hàng thường lối đi sau cột 6
// thì hàng ghế đôi phải là sau ghế 3, để hai lối đi thẳng hàng nhau.
export function aisleColsForRow(room: Room, isCouple: boolean): number[] {
  const cols = aisleCols(room);
  if (!isCouple) return cols;
  const last = coupleUnits(room.cols);
  return [...new Set(cols.map((c) => Math.round(c / 2)))].filter(
    (c) => c > 0 && c < last,
  );
}

export function buildSeatLayout(room?: Room | null): SeatRow[] {
  if (!room) return [];
  const rows: SeatRow[] = [];
  for (let r = 0; r < room.rows; r++) {
    const row = rowLetter(r);
    const coupleR = isCoupleRow(row, room.coupleRows);
    const seats: Seat[] = [];
    for (let c = 1; c <= seatsInRow(room, coupleR); c++) {
      seats.push({
        seatNumber: `${row}${c}`,
        row,
        col: c,
        isVip: !coupleR && isVipRow(row, room.vipRows),
        isCouple: coupleR,
      });
    }
    rows.push({ row, seats, isCouple: coupleR });
  }
  return rows;
}

export function bookedSeatSet(
  showtime?: Showtime | null,
  bookings: Booking[] = [],
): Set<string> {
  const set = new Set<string>(showtime?.bookedSeats || []);
  bookings
    .filter((b) => b.showtimeId === showtime?.id)
    .forEach((b) => (b.seats || []).forEach((s) => set.add(s)));
  return set;
}

export const priceOf = (
  seat: Pick<Seat, "isVip" | "isCouple">,
  basePrice: number,
): number =>
  seat.isCouple
    ? couplePrice(basePrice)
    : seat.isVip
      ? vipPrice(basePrice)
      : basePrice;

// --- Bắp nước (F&B) ---
export interface FnbLine {
  id: number;
  name: string;
  qty: number;
  price: number;
  amount: number;
}

// qtyMap: { [concessionId]: number }. Trả về các dòng đơn theo thứ tự catalog.
export function fnbLines(
  qtyMap: Record<number, number> = {},
  catalog: Concession[] = [],
): FnbLine[] {
  return catalog
    .filter((c) => (qtyMap[c.id] || 0) > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      qty: qtyMap[c.id],
      price: c.price,
      amount: c.price * qtyMap[c.id],
    }));
}

export const fnbTotal = (
  qtyMap: Record<number, number> = {},
  catalog: Concession[] = [],
): number => fnbLines(qtyMap, catalog).reduce((sum, l) => sum + l.amount, 0);
