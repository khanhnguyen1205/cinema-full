import { describe, it, expect } from "vitest";
import { isCollection, parseFilters, pickWritable } from "./collections";

describe("isCollection", () => {
  it("nhận đúng tên collection hợp lệ", () => {
    expect(isCollection("movies")).toBe(true);
    expect(isCollection("bookings")).toBe(true);
  });
  it("từ chối tên lạ", () => {
    expect(isCollection("hackers")).toBe(false);
    expect(isCollection("")).toBe(false);
  });
});

describe("parseFilters", () => {
  it("ép query string sang Int cho trường kiểu int", () => {
    expect(parseFilters("showtimes", { movieId: "5" })).toEqual({ movieId: 5 });
    expect(parseFilters("rooms", { cinemaId: "2" })).toEqual({ cinemaId: 2 });
  });
  it("bỏ qua tham số không lọc được", () => {
    expect(parseFilters("movies", { _sort: "title", junk: "1" })).toEqual({});
  });
  it("bỏ qua giá trị int không hợp lệ", () => {
    expect(parseFilters("showtimes", { movieId: "abc" })).toEqual({});
  });
  it("giữ nguyên trường kiểu chuỗi", () => {
    expect(parseFilters("users", { email: "a@b.vn" })).toEqual({
      email: "a@b.vn",
    });
  });
  it("nhận cả số (gateway truyền userId dạng number)", () => {
    expect(parseFilters("bookings", { userId: 3 })).toEqual({ userId: 3 });
  });
});

describe("pickWritable", () => {
  it("chỉ giữ trường thuộc schema, bỏ id và rác", () => {
    expect(
      pickWritable("bookings", {
        id: 9,
        seats: ["A1"],
        totalPrice: 1000,
        junk: true,
      }),
    ).toEqual({ seats: ["A1"], totalPrice: 1000 });
  });
  it("giữ nguyên mảng và object lồng", () => {
    expect(
      pickWritable("rooms", {
        vipRows: ["E", "F"],
        aisleAfterCols: [6],
        name: "P1",
      }),
    ).toEqual({ vipRows: ["E", "F"], aisleAfterCols: [6], name: "P1" });
  });
  it("bỏ trường undefined nhưng giữ trường null", () => {
    expect(
      pickWritable("bookings", { userName: undefined, concessions: null }),
    ).toEqual({ concessions: null });
  });
  it("giữ 4 trường mở rộng của booking", () => {
    expect(
      pickWritable("bookings", {
        paymentMethod: "momo",
        seatTotal: 1,
        fnbTotal: 2,
        serviceFee: 3,
      }),
    ).toEqual({
      paymentMethod: "momo",
      seatTotal: 1,
      fnbTotal: 2,
      serviceFee: 3,
    });
  });
});
