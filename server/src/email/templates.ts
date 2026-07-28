// Thuần — KHÔNG import Prisma/env/resend/qrcode: unit test của file này chạy trong
// job CI `checks` vốn không có database.
import type { Lang } from "./lang";

export interface TicketEmailData {
  code: string; // "TK-00007"
  movieTitle: string;
  cinemaName: string;
  roomName: string;
  roomType: string;
  time: string; // chuỗi thô trong DB: "2026-08-02T19:30:00"
  seats: string[];
  concessions: { name: string; qty: number }[];
  totalPrice: number;
  ticketsUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const STR = {
  vi: {
    subject: (code: string, movie: string) => `Vé của bạn · ${movie} · ${code}`,
    brand: "THE CINEMATIC EDITORIAL",
    heading: "VÉ ĐIỆN TỬ",
    intro: "Đặt vé thành công. Xuất trình mã dưới đây tại quầy soát vé.",
    movie: "Phim",
    cinema: "Rạp",
    date: "Ngày",
    time: "Giờ",
    seats: "Ghế",
    fnb: "Bắp nước",
    total: "Tổng tiền",
    qrNote: "Mã QR nằm ở tệp đính kèm của email này.",
    cta: "Xem vé trong ứng dụng",
    footer: "Email tự động — vui lòng không trả lời.",
  },
  en: {
    subject: (code: string, movie: string) =>
      `Your ticket · ${movie} · ${code}`,
    brand: "THE CINEMATIC EDITORIAL",
    heading: "E-TICKET",
    intro: "Your booking is confirmed. Show the code below at the gate.",
    movie: "Movie",
    cinema: "Cinema",
    date: "Date",
    time: "Time",
    seats: "Seats",
    fnb: "Snacks",
    total: "Total",
    qrNote: "The QR code is attached to this email.",
    cta: "View ticket in the app",
    footer: "Automated email — please do not reply.",
  },
} as const;

const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const esc = (s: string): string =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Tự nhóm chữ số thay vì toLocaleString: kết quả không phụ thuộc bản ICU của Node.
export const formatVnd = (n: number, lang: Lang): string => {
  const sep = lang === "en" ? "," : ".";
  const digits = String(Math.round(Math.abs(Number(n) || 0))).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    sep,
  );
  return `${digits} ₫`;
};

// "2026-08-02T19:30:00" -> {date, time}. Cắt CHUỖI, không dùng new Date(): chuỗi
// trong DB không mang múi giờ, mà server chạy UTC trên Render còn trình duyệt ở
// UTC+7 — đi qua Date sẽ khiến email lệch giờ so với vé hiển thị trên web.
export function splitTime(
  iso: string,
  lang: Lang,
): { date: string; time: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || "");
  if (!m) return { date: "—", time: "—" };
  const [, y, mo, d, hh, mm] = m;
  const date =
    lang === "en"
      ? `${d} ${MONTHS_EN[Number(mo) - 1]} ${y}`
      : `${d}/${mo}/${y}`;
  return { date, time: `${hh}:${mm}` };
}

export function renderTicketEmail(
  d: TicketEmailData,
  lang: Lang,
): RenderedEmail {
  const s = STR[lang];
  const { date, time } = splitTime(d.time, lang);
  const seats = d.seats.length ? d.seats.join(", ") : "—";
  const fnb = d.concessions
    .filter((c) => c.qty > 0)
    .map((c) => `${c.name} ×${c.qty}`)
    .join(", ");
  const total = formatVnd(d.totalPrice, lang);
  const venue = [d.cinemaName, d.roomName, d.roomType]
    .filter(Boolean)
    .join(" · ");

  const row = (label: string, value: string) =>
    `<tr>` +
    `<td style="padding:8px 0;border-bottom:1px solid #e5e5e5;font:11px/1.4 'Courier New',Courier,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8a8a8a;width:38%">${esc(label)}</td>` +
    `<td style="padding:8px 0;border-bottom:1px solid #e5e5e5;font:15px/1.4 Arial,Helvetica,sans-serif;color:#111;font-weight:bold">${esc(value)}</td>` +
    `</tr>`;

  const html =
    `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f4f4f4">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#fffdf7;border:2px solid #111">` +
    `<tr><td style="background:#0a0a0a;padding:20px 24px">` +
    `<div style="font:11px/1.4 'Courier New',Courier,monospace;letter-spacing:.2em;color:#8a8a8a">${esc(s.brand)}</div>` +
    `<div style="font:bold 30px/1.1 Arial,Helvetica,sans-serif;letter-spacing:.04em;color:#fff;margin-top:6px">${esc(s.heading)}</div>` +
    `</td></tr>` +
    `<tr><td style="padding:24px">` +
    `<p style="margin:0 0 18px;font:14px/1.6 Arial,Helvetica,sans-serif;color:#444">${esc(s.intro)}</p>` +
    `<div style="font:bold 34px/1 Arial,Helvetica,sans-serif;color:#e63030;letter-spacing:.04em">N°${esc(d.code)}</div>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:18px">` +
    row(s.movie, d.movieTitle) +
    row(s.cinema, venue) +
    row(s.date, date) +
    row(s.time, time) +
    row(s.seats, seats) +
    (fnb ? row(s.fnb, fnb) : "") +
    row(s.total, total) +
    `</table>` +
    `<p style="margin:18px 0 0;font:12px/1.6 'Courier New',Courier,monospace;color:#8a8a8a">${esc(s.qrNote)}</p>` +
    `<a href="${esc(d.ticketsUrl)}" style="display:inline-block;margin-top:18px;padding:12px 20px;background:#0a0a0a;color:#fff;text-decoration:none;font:bold 13px/1 Arial,Helvetica,sans-serif;letter-spacing:.08em;text-transform:uppercase">${esc(s.cta)}</a>` +
    `</td></tr>` +
    `<tr><td style="padding:14px 24px;border-top:1px solid #e5e5e5;font:11px/1.5 'Courier New',Courier,monospace;color:#8a8a8a">${esc(s.footer)}</td></tr>` +
    `</table></body></html>`;

  const text = [
    `${s.brand} — ${s.heading}`,
    `N°${d.code}`,
    "",
    s.intro,
    "",
    `${s.movie}: ${d.movieTitle}`,
    `${s.cinema}: ${venue}`,
    `${s.date}: ${date}`,
    `${s.time}: ${time}`,
    `${s.seats}: ${seats}`,
    ...(fnb ? [`${s.fnb}: ${fnb}`] : []),
    `${s.total}: ${total}`,
    "",
    s.qrNote,
    `${s.cta}: ${d.ticketsUrl}`,
    "",
    s.footer,
  ].join("\n");

  return { subject: s.subject(d.code, d.movieTitle), html, text };
}
