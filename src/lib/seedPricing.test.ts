import { describe, expect, it } from "vitest";
import type { Room } from "types";
import * as seed from "../../scripts/lib/seed-pricing.mjs";
import {
  ROOM_TYPE_PRICE,
  SERVICE_FEE,
  buildSeatLayout,
  couplePrice,
  priceOf,
  seatType,
  vipPrice,
} from "./pricing";

// scripts/lib/seed-pricing.mjs là bản SAO CHÉP luật giá cho generator (không
// import được bản gốc vì path-alias "types"). Test này là thứ giữ hai bên khớp
// nhau — thiếu nó thì một hôm ai đó đổi giá VIP ở một bên và dữ liệu seed âm
// thầm lệch với app.
describe("seed-pricing.mjs khớp lib/pricing.ts", () => {
  it("hằng số giống nhau", () => {
    expect(seed.ROOM_TYPE_PRICE).toEqual(ROOM_TYPE_PRICE);
    expect(seed.SERVICE_FEE).toBe(SERVICE_FEE);
  });

  it("giá VIP và giá đôi giống nhau trên mọi giá nền đang dùng", () => {
    for (const base of [75000, 95000, 120000, 60000, 88000]) {
      expect(seed.vipPrice(base)).toBe(vipPrice(base));
      expect(seed.couplePrice(base)).toBe(couplePrice(base));
    }
  });

  it("sơ đồ ghế giống nhau, kể cả hàng ghế đôi nửa số ghế", () => {
    const room = {
      id: 1,
      name: "Phòng 1",
      type: "2D",
      rows: 8,
      cols: 12,
      vipRows: ["E", "F"],
      coupleRows: ["H"],
      aisleAfterCols: [],
      cinemaId: 1,
    } as unknown as Room;
    const mine = seed.buildSeatLayout(room);
    const theirs = buildSeatLayout(room);
    expect(mine.map((r) => r.seats.map((s) => s.seatNumber))).toEqual(
      theirs.map((r) => r.seats.map((s) => s.seatNumber)),
    );
    expect(mine[7].seats).toHaveLength(6); // hàng H là ghế đôi -> 12/2
    for (let i = 0; i < theirs.length; i++) {
      for (let j = 0; j < theirs[i].seats.length; j++) {
        const a = mine[i].seats[j];
        const b = theirs[i].seats[j];
        expect(seed.seatType(a)).toBe(seatType(b));
        expect(seed.priceOf(a, 75000)).toBe(priceOf(b, 75000));
      }
    }
  });
});
