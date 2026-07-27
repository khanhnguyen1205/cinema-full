// Luật giá NHÂN BẢN từ src/lib/pricing.ts — không import chéo được vì
// server/tsconfig.build.json đặt rootDir: server/src.
// ⚠ Sửa giá ở một bên thì PHẢI sửa bên kia; test số cứng hai phía là chốt chặn.
export const SERVICE_FEE = 15000;
export const MAX_SEATS = 8;

const roundTo1000 = (n: number): number => Math.round(n / 1000) * 1000;

export const vipPrice = (basePrice: number): number =>
  roundTo1000(basePrice * 1.3);
export const couplePrice = (basePrice: number): number =>
  roundTo1000(basePrice * 1.6);

// "H10" -> "H" (mã ghế = chữ hàng + số cột)
export const rowOf = (seatNumber: string): string =>
  (seatNumber.match(/^[A-Za-z]+/)?.[0] ?? "").toUpperCase();

export type QuoteItem = { price: number; qty: number };

export type QuoteInput = {
  basePrice: number;
  seats: string[];
  vipRows?: string[];
  coupleRows?: string[];
  items?: QuoteItem[];
};

export type Quote = {
  seatTotal: number;
  fnbTotal: number;
  serviceFee: number;
  total: number;
};

export function quote(input: QuoteInput): Quote {
  const vip = new Set((input.vipRows ?? []).map((r) => r.toUpperCase()));
  const couple = new Set((input.coupleRows ?? []).map((r) => r.toUpperCase()));

  const seatTotal = input.seats.reduce((sum, seat) => {
    const row = rowOf(seat);
    // Ghế đôi thắng VIP khi một hàng nằm trong cả hai danh sách.
    if (couple.has(row)) return sum + couplePrice(input.basePrice);
    if (vip.has(row)) return sum + vipPrice(input.basePrice);
    return sum + input.basePrice;
  }, 0);

  const fnbTotal = (input.items ?? []).reduce(
    (sum, i) => sum + i.price * i.qty,
    0,
  );
  const serviceFee = input.seats.length > 0 ? SERVICE_FEE : 0;

  return {
    seatTotal,
    fnbTotal,
    serviceFee,
    total: seatTotal + fnbTotal + serviceFee,
  };
}
