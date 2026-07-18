import { describe, it, expect } from "vitest";
import type { Booking, Concession, Room, Seat, Showtime } from "types";
import {
  ROOM_TYPE_PRICE,
  SERVICE_FEE,
  MAX_SEATS,
  MAX_ITEM_QTY,
  COUPLE_MULTIPLIER,
  vipPrice,
  couplePrice,
  isVipRow,
  isCoupleRow,
  seatType,
  aisleCols,
  coupleUnits,
  seatsInRow,
  aisleColsForRow,
  buildSeatLayout,
  bookedSeatSet,
  priceOf,
  fnbLines,
  fnbTotal,
} from "./pricing";

// Helpers dựng fixture gọn, chỉ khai báo trường cần cho phép tính.
const room = (over: Partial<Room> = {}): Room => ({
  id: 1,
  cinemaId: 1,
  name: "P1",
  type: "2D",
  rows: 2,
  cols: 12,
  ...over,
});
const seat = (over: Partial<Seat> = {}): Seat => ({
  seatNumber: "A1",
  row: "A",
  col: 1,
  isVip: false,
  isCouple: false,
  ...over,
});

describe("hằng số", () => {
  it("bảng giá theo loại phòng", () => {
    expect(ROOM_TYPE_PRICE).toEqual({ "2D": 75000, "3D": 95000, IMAX: 120000 });
  });
  it("giới hạn & phí cố định", () => {
    expect(SERVICE_FEE).toBe(15000);
    expect(MAX_SEATS).toBe(8);
    expect(MAX_ITEM_QTY).toBe(10);
    expect(COUPLE_MULTIPLIER).toBe(1.6);
  });
});

describe("vipPrice (×1.3, làm tròn tới 1.000)", () => {
  it("làm tròn lên khi .5", () => {
    expect(vipPrice(75000)).toBe(98000); // 97.500 -> 98.000
    expect(vipPrice(95000)).toBe(124000); // 123.500 -> 124.000
  });
  it("làm tròn xuống", () => {
    expect(vipPrice(77000)).toBe(100000); // 100.100 -> 100.000
  });
  it("giá trị chẵn giữ nguyên", () => {
    expect(vipPrice(70000)).toBe(91000); // 91.000 đúng
  });
});

describe("couplePrice (×1.6, làm tròn tới 1.000)", () => {
  it("nhân đúng hệ số", () => {
    expect(couplePrice(75000)).toBe(120000);
    expect(couplePrice(95000)).toBe(152000);
    expect(couplePrice(70000)).toBe(112000);
  });
});

describe("isVipRow / isCoupleRow", () => {
  it("mặc định danh sách rỗng -> false", () => {
    expect(isVipRow("A")).toBe(false);
    expect(isCoupleRow("A")).toBe(false);
  });
  it("khớp theo tên hàng", () => {
    expect(isVipRow("E", ["E", "F"])).toBe(true);
    expect(isVipRow("A", ["E", "F"])).toBe(false);
    expect(isCoupleRow("H", ["H"])).toBe(true);
  });
});

describe("seatType (ưu tiên couple > vip > standard)", () => {
  it("phân loại đúng", () => {
    expect(seatType({ isVip: false, isCouple: false })).toBe("standard");
    expect(seatType({ isVip: true, isCouple: false })).toBe("vip");
    expect(seatType({ isVip: false, isCouple: true })).toBe("couple");
  });
  it("couple thắng khi vừa vip vừa couple", () => {
    expect(seatType({ isVip: true, isCouple: true })).toBe("couple");
  });
});

describe("aisleCols", () => {
  it("null/undefined -> mảng rỗng", () => {
    expect(aisleCols(null)).toEqual([]);
    expect(aisleCols()).toEqual([]);
  });
  it("mặc định 1 lối giữa = floor(cols/2)", () => {
    expect(aisleCols(room({ cols: 12 }))).toEqual([6]);
    expect(aisleCols(room({ cols: 11 }))).toEqual([5]);
  });
  it("đọc trực tiếp aisleAfterCols khi có", () => {
    expect(aisleCols(room({ cols: 12, aisleAfterCols: [4, 8] }))).toEqual([
      4, 8,
    ]);
  });
});

describe("coupleUnits & seatsInRow", () => {
  it("ghế đôi chiếm nửa số cột (làm tròn xuống)", () => {
    expect(coupleUnits(12)).toBe(6);
    expect(coupleUnits(13)).toBe(6);
    expect(coupleUnits(1)).toBe(0);
  });
  it("seatsInRow theo loại hàng", () => {
    const r = room({ cols: 12 });
    expect(seatsInRow(r, false)).toBe(12);
    expect(seatsInRow(r, true)).toBe(6);
  });
});

describe("aisleColsForRow", () => {
  it("hàng thường trả nguyên aisleCols", () => {
    expect(aisleColsForRow(room({ cols: 12 }), false)).toEqual([6]);
  });
  it("hàng ghế đôi quy đổi lối đi sang đơn vị nửa và loại biên", () => {
    // cols 12 -> lối đi mặc định sau cột 6 -> hàng đôi sau ghế 3
    expect(aisleColsForRow(room({ cols: 12 }), true)).toEqual([3]);
    // lối đi ở sát mép (sau cột cuối) bị loại vì c >= last
    expect(
      aisleColsForRow(room({ cols: 12, aisleAfterCols: [12] }), true),
    ).toEqual([]);
  });
});

describe("buildSeatLayout", () => {
  it("phòng null -> mảng rỗng", () => {
    expect(buildSeatLayout(null)).toEqual([]);
    expect(buildSeatLayout()).toEqual([]);
  });

  it("dựng lưới đánh số ghế đúng", () => {
    const rows = buildSeatLayout(room({ rows: 2, cols: 3 }));
    expect(rows).toHaveLength(2);
    expect(rows[0].row).toBe("A");
    expect(rows[1].row).toBe("B");
    expect(rows[0].seats.map((s) => s.seatNumber)).toEqual(["A1", "A2", "A3"]);
    expect(rows[1].seats.map((s) => s.seatNumber)).toEqual(["B1", "B2", "B3"]);
    expect(rows[0].seats[0]).toMatchObject({
      row: "A",
      col: 1,
      isVip: false,
      isCouple: false,
    });
  });

  it("đánh dấu ghế VIP theo vipRows", () => {
    const rows = buildSeatLayout(room({ rows: 2, cols: 2, vipRows: ["B"] }));
    expect(rows[0].seats.every((s) => !s.isVip)).toBe(true);
    expect(rows[1].seats.every((s) => s.isVip)).toBe(true);
  });

  it("hàng ghế đôi: nửa số đơn vị, isCouple, và couple thắng vip", () => {
    const rows = buildSeatLayout(
      room({ rows: 1, cols: 4, coupleRows: ["A"], vipRows: ["A"] }),
    );
    expect(rows[0].isCouple).toBe(true);
    expect(rows[0].seats.map((s) => s.seatNumber)).toEqual(["A1", "A2"]);
    expect(rows[0].seats.every((s) => s.isCouple && !s.isVip)).toBe(true);
  });
});

describe("bookedSeatSet", () => {
  const showtime: Showtime = {
    id: 10,
    movieId: 1,
    roomId: 1,
    time: "2026-08-01T19:00",
    price: 75000,
    bookedSeats: ["A1", "A2"],
  };
  const booking = (over: Partial<Booking>): Booking => ({
    id: 1,
    movieId: 1,
    showtimeId: 10,
    cinemaId: 1,
    roomId: 1,
    seats: [],
    seatTypes: { standard: 0, vip: 0 },
    userId: 1,
    totalPrice: 0,
    createdAt: "",
    ...over,
  });

  it("showtime null & không booking -> rỗng", () => {
    expect([...bookedSeatSet(null)]).toEqual([]);
  });

  it("hợp nhất bookedSeats với ghế của booking khớp showtime", () => {
    const set = bookedSeatSet(showtime, [booking({ seats: ["B1", "B2"] })]);
    expect([...set].sort()).toEqual(["A1", "A2", "B1", "B2"]);
  });

  it("bỏ qua booking của showtime khác và khử trùng lặp", () => {
    const set = bookedSeatSet(showtime, [
      booking({ id: 2, showtimeId: 99, seats: ["C1"] }), // khác suất -> bỏ
      booking({ id: 3, seats: ["A1", "B1"] }), // A1 trùng bookedSeats
    ]);
    expect([...set].sort()).toEqual(["A1", "A2", "B1"]);
  });
});

describe("priceOf", () => {
  it("thường = giá gốc, vip/couple theo hệ số", () => {
    expect(priceOf(seat(), 75000)).toBe(75000);
    expect(priceOf(seat({ isVip: true }), 75000)).toBe(vipPrice(75000));
    expect(priceOf(seat({ isCouple: true }), 75000)).toBe(couplePrice(75000));
  });
});

describe("fnbLines & fnbTotal", () => {
  const catalog: Concession[] = [
    { id: 1, name: "Bắp", category: "food", price: 50000 },
    { id: 2, name: "Coca", category: "drink", price: 30000 },
    { id: 3, name: "Combo", category: "combo", price: 90000 },
  ];

  it("chỉ lấy món có số lượng > 0, giữ thứ tự catalog", () => {
    const lines = fnbLines({ 3: 1, 1: 2 }, catalog);
    expect(lines.map((l) => l.id)).toEqual([1, 3]); // theo thứ tự catalog
    expect(lines[0]).toEqual({
      id: 1,
      name: "Bắp",
      qty: 2,
      price: 50000,
      amount: 100000,
    });
  });

  it("qtyMap rỗng -> không dòng, tổng 0", () => {
    expect(fnbLines({}, catalog)).toEqual([]);
    expect(fnbTotal({}, catalog)).toBe(0);
  });

  it("fnbTotal cộng đúng thành tiền", () => {
    expect(fnbTotal({ 1: 2, 2: 1 }, catalog)).toBe(100000 + 30000);
  });
});
