import { describe, it, expect } from "vitest";
import { quote, vipPrice, couplePrice, rowOf, SERVICE_FEE } from "./quote";

// Các con số dưới đây KHOÁ luật giá cho khớp src/lib/pricing.ts (bản sao phía client).
describe("giá ghế", () => {
  it("VIP = làm tròn 1.000 của base×1.3", () => {
    expect(vipPrice(75000)).toBe(98000); // 97.500 -> 98.000
    expect(vipPrice(95000)).toBe(124000); // 123.500 -> 124.000
  });

  it("đôi = làm tròn 1.000 của base×1.6", () => {
    expect(couplePrice(75000)).toBe(120000);
    expect(couplePrice(95000)).toBe(152000);
  });

  it("rowOf lấy phần chữ cái đầu của mã ghế", () => {
    expect(rowOf("A3")).toBe("A");
    expect(rowOf("h10")).toBe("H");
  });
});

describe("quote", () => {
  const basePrice = 75000;

  it("ghế thường: tiền ghế + phí dịch vụ", () => {
    const q = quote({ basePrice, seats: ["A1", "A2"] });
    expect(q.seatTotal).toBe(150000);
    expect(q.fnbTotal).toBe(0);
    expect(q.serviceFee).toBe(SERVICE_FEE);
    expect(q.total).toBe(165000);
  });

  it("hàng VIP tính giá VIP", () => {
    const q = quote({ basePrice, seats: ["E1"], vipRows: ["E", "F"] });
    expect(q.seatTotal).toBe(98000);
  });

  it("hàng vừa VIP vừa đôi thì tính giá ĐÔI", () => {
    const q = quote({
      basePrice,
      seats: ["H1"],
      vipRows: ["H"],
      coupleRows: ["H"],
    });
    expect(q.seatTotal).toBe(120000);
  });

  it("cộng bắp nước theo price × qty", () => {
    const q = quote({
      basePrice,
      seats: ["A1"],
      items: [
        { price: 45000, qty: 2 },
        { price: 30000, qty: 1 },
      ],
    });
    expect(q.fnbTotal).toBe(120000);
    expect(q.total).toBe(75000 + 120000 + SERVICE_FEE);
  });

  it("không có ghế thì KHÔNG tính phí dịch vụ", () => {
    const q = quote({ basePrice, seats: [] });
    expect(q.serviceFee).toBe(0);
    expect(q.total).toBe(0);
  });

  it("so hàng không phân biệt hoa/thường", () => {
    const q = quote({ basePrice, seats: ["e1"], vipRows: ["E"] });
    expect(q.seatTotal).toBe(98000);
  });
});
