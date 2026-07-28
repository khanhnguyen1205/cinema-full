import { describe, it, expect } from "vitest";
import {
  renderTicketEmail,
  formatVnd,
  splitTime,
  type TicketEmailData,
} from "./templates";

const data: TicketEmailData = {
  code: "TK-00007",
  movieTitle: "Avengers: Endgame",
  cinemaName: "CGV Vincom",
  roomName: "Phòng 3",
  roomType: "IMAX",
  time: "2026-08-02T19:30:00",
  seats: ["E5", "E6"],
  concessions: [{ name: "Bắp lớn", qty: 2 }],
  totalPrice: 291000,
  ticketsUrl: "http://localhost:3000/tickets",
};

describe("formatVnd", () => {
  it("nhóm chữ số kiểu vi bằng dấu chấm", () => {
    expect(formatVnd(291000, "vi")).toBe("291.000 ₫");
    expect(formatVnd(90000, "vi")).toBe("90.000 ₫");
  });

  it("nhóm chữ số kiểu en bằng dấu phẩy", () => {
    expect(formatVnd(291000, "en")).toBe("291,000 ₫");
  });

  it("số nhỏ và 0 không có dấu phân nhóm", () => {
    expect(formatVnd(0, "vi")).toBe("0 ₫");
    expect(formatVnd(999, "vi")).toBe("999 ₫");
  });
});

describe("splitTime", () => {
  // Chuỗi trong DB không mang múi giờ. Cắt chuỗi (không dùng Date) nên kết quả
  // KHÔNG phụ thuộc múi giờ của server — Render chạy UTC, máy dev UTC+7.
  it("cắt đúng ngày/giờ, không lệch múi giờ", () => {
    expect(splitTime("2026-08-02T19:30:00", "vi")).toEqual({
      date: "02/08/2026",
      time: "19:30",
    });
  });

  it("bản en dùng tên tháng viết tắt", () => {
    expect(splitTime("2026-08-02T19:30:00", "en")).toEqual({
      date: "02 Aug 2026",
      time: "19:30",
    });
  });

  it("chuỗi hỏng -> gạch ngang, không ném lỗi", () => {
    expect(splitTime("", "vi")).toEqual({ date: "—", time: "—" });
    expect(splitTime("hôm nay", "vi")).toEqual({ date: "—", time: "—" });
  });
});

describe("renderTicketEmail", () => {
  it("tiêu đề chứa mã vé và tên phim", () => {
    const { subject } = renderTicketEmail(data, "vi");
    expect(subject).toContain("TK-00007");
    expect(subject).toContain("Avengers: Endgame");
  });

  it("html chứa đủ thông tin vé", () => {
    const { html } = renderTicketEmail(data, "vi");
    expect(html).toContain("TK-00007");
    expect(html).toContain("Avengers: Endgame");
    expect(html).toContain("CGV Vincom");
    expect(html).toContain("E5, E6");
    expect(html).toContain("02/08/2026");
    expect(html).toContain("19:30");
    expect(html).toContain("291.000 ₫");
    expect(html).toContain("http://localhost:3000/tickets");
  });

  it("bản text chứa đủ thông tin vé (client không đọc html)", () => {
    const { text } = renderTicketEmail(data, "vi");
    expect(text).toContain("TK-00007");
    expect(text).toContain("Avengers: Endgame");
    expect(text).toContain("E5, E6");
    expect(text).toContain("291.000 ₫");
    expect(text).toContain("http://localhost:3000/tickets");
  });

  it("bản en khác bản vi ở nhãn lẫn định dạng số", () => {
    const vi = renderTicketEmail(data, "vi");
    const en = renderTicketEmail(data, "en");
    expect(vi.subject).not.toBe(en.subject);
    expect(en.html).toContain("291,000 ₫");
    expect(en.html).toContain("02 Aug 2026");
    expect(en.html).toContain("Seats");
    expect(vi.html).toContain("Ghế");
  });

  it("escape HTML trong dữ liệu từ DB", () => {
    const { html } = renderTicketEmail(
      { ...data, movieTitle: "<script>alert(1)</script>" },
      "vi",
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("có bắp nước thì in dòng bắp nước", () => {
    const { html, text } = renderTicketEmail(data, "vi");
    expect(html).toContain("Bắp lớn ×2");
    expect(text).toContain("Bắp lớn ×2");
  });

  it("không có bắp nước thì KHÔNG in khối rỗng", () => {
    const { html } = renderTicketEmail({ ...data, concessions: [] }, "vi");
    expect(html).not.toContain("Bắp nước");
  });

  it("không có ghế -> gạch ngang thay vì chuỗi rỗng", () => {
    const { html } = renderTicketEmail({ ...data, seats: [] }, "vi");
    expect(html).toContain("—");
  });
});
