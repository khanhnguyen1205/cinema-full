# Email vé (Resend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sau khi đặt vé thành công, người dùng nhận email chứa vé (mã vé, phim, rạp,
ngày giờ, ghế, bắp nước, tổng tiền + QR đính kèm), kèm nút "Gửi lại vé" ở bước ④ và
trang "Vé của tôi".

**Architecture:** Module mới `server/src/email/` với hai file **thuần** (`templates.ts`,
`lang.ts` — unit test chạy được ở CI không có database) và ba file chạm hạ tầng
(`qr.ts`, `resend.ts`, `send.ts`) + `routes.ts` mount tại `/api/emails`. Gateway bắn
email ở **nền** sau khi tạo booking; endpoint "gửi lại" thì **đồng bộ** và trả lỗi thật.
Thiếu `RESEND_API_KEY` ⇒ tính năng tắt êm, app không đổi hành vi.

**Tech Stack:** Express 5 + TypeScript, Prisma/Postgres, Resend HTTP API gọi bằng
`fetch` trần (Node 22), `qrcode` sinh PNG, React 18 + TanStack Query v5 + react-i18next.

**Spec:** `docs/superpowers/specs/2026-07-28-phase4-ticket-email-design.md`

## Global Constraints

- **Bảy cổng CI phải xanh sau MỖI task:** `npm run typecheck` · `npm run lint` (0 warning
  — một warning cũng làm đỏ CI) · `npm run format:check` · `npm run test:run` ·
  `npm run e2e` · `npm run build` · job `docker`.
- **Mỗi task = 1 commit, push thẳng `main`** (repo cá nhân, không dùng nhánh/PR).
- **File server có unit test thì KHÔNG được import `server/src/env.ts`** — `env.ts` throw
  khi thiếu `DATABASE_URL`, mà job CI `checks` không có database. `templates.ts` và
  `lang.ts` chỉ được import lẫn nhau, không import Prisma/env/qrcode/resend.
- **Mọi chuỗi hiển thị phía client phải qua `t("area.key")`** và key phải thêm vào **cả**
  `src/i18n/locales/vi.json` **lẫn** `en.json` (kể cả aria-label).
- **Giá luôn là VND.** Email tự format bằng helper thuần của mình (không dùng
  `src/i18n/format.ts` — server không import chéo được `src/`).
- **Thứ tự mount trong `server/src/app.ts` là load-bearing:** route riêng phải khai báo
  TRƯỚC catch-all `/api`. Thứ tự cuối cùng: `/auth` → `/api/occupied-seats` →
  `/api/holds` → `/api/payments` → `/api/emails` → `/api` → SPA.
- **Server chạy `tsx` KHÔNG watch:** sửa `server/**` phải **kill listener :4000 rồi
  `npm run auth`** mới có hiệu lực. Trên Windows server đang chạy **khoá Prisma client**
  ⇒ phải kill :4000 **trước** mọi `npm install`, và **nhớ bật lại** (quên là toàn bộ e2e
  đỏ hàng loạt, trông hệt như lỗi code).
- **Không commit key thật.** `.env` đã gitignored; `.env.example` chỉ chứa placeholder.
- Pattern query bắt buộc khi list được dùng trong `useMemo` khác:
  `const xQ = useHook(); const x = useMemo(() => xQ.data ?? [], [xQ.data]);`

---

## File Structure

**Tạo mới — server**
| File | Trách nhiệm |
|---|---|
| `server/src/email/lang.ts` | `pickLang(header)` → `"vi" \| "en"`. **Thuần.** |
| `server/src/email/lang.test.ts` | Test cho trên. |
| `server/src/email/templates.ts` | `renderTicketEmail(data, lang)` → `{subject, html, text}`, bảng chuỗi vi/en, `formatVnd`, `splitTime`, escape HTML. **Thuần.** |
| `server/src/email/templates.test.ts` | Test cho trên. |
| `server/src/email/qr.ts` | `qrPng(value)` → `Buffer \| null`. |
| `server/src/email/resend.ts` | `isEmailEnabled()`, `sendMail()` qua `fetch`. |
| `server/src/email/send.ts` | `sendTicketEmail(bookingId, lang)`: tra DB → QR → template → gửi. Không bao giờ throw. |
| `server/src/email/routes.ts` | `GET /config`, `POST /ticket` (chủ-hoặc-admin, rate-limit). |

**Tạo mới — client**
| File | Trách nhiệm |
|---|---|
| `src/services/email.ts` | `getEmailConfig()`, `resendTicketEmail(bookingId)`. |
| `src/queries/email.ts` | `useEmailConfig()`, `useResendTicket()`. |
| `src/components/ResendTicketButton.tsx` | Nút gửi lại + trạng thái; render `null` khi tắt. |
| `src/components/ResendTicketButton.css` | Style `.resend-k`. |

**Sửa**
| File | Sửa gì |
|---|---|
| `server/src/api/repo.ts` | `handleRest` trả về bản ghi vừa ghi (`Promise<unknown>`). |
| `server/src/api/gateway.ts` | Nhánh `bookings POST`: bắn `sendTicketEmail` ở nền. |
| `server/src/app.ts` | Mount `/api/emails` trước `/api`. |
| `src/services/api.ts` | `createBooking` gửi kèm header `x-lang`. |
| `src/queries/keys.ts` | Thêm `emailConfig`. |
| `src/pages/booking/TicketStep.tsx` | Dòng "đã gửi tới…" + nút gửi lại. |
| `src/pages/MyTickets.tsx` | Nút gửi lại trên vé sắp tới. |
| `src/i18n/locales/vi.json`, `en.json` | Namespace `email`. |
| `.env.example` | `RESEND_API_KEY`, `MAIL_FROM`. |
| `package.json` | dep `qrcode`, devDep `@types/qrcode`. |
| `CLAUDE.md`, `README.md` | Tài liệu (task 5). |

---

## Task 1 (E1): Hai module thuần — `lang.ts` + `templates.ts`

**Files:**
- Create: `server/src/email/lang.ts`
- Create: `server/src/email/lang.test.ts`
- Create: `server/src/email/templates.ts`
- Create: `server/src/email/templates.test.ts`

**Interfaces:**
- Consumes: không có (task đầu tiên, chưa ai gọi).
- Produces:
  - `type Lang = "vi" | "en"`
  - `pickLang(header?: string | string[]): Lang`
  - `interface TicketEmailData { code: string; movieTitle: string; cinemaName: string; roomName: string; roomType: string; time: string; seats: string[]; concessions: { name: string; qty: number }[]; totalPrice: number; ticketsUrl: string }`
  - `interface RenderedEmail { subject: string; html: string; text: string }`
  - `renderTicketEmail(data: TicketEmailData, lang: Lang): RenderedEmail`
  - `formatVnd(n: number, lang: Lang): string`
  - `splitTime(iso: string, lang: Lang): { date: string; time: string }`

Vitest đã được cấu hình quét `server/**/*.{test,spec}.ts` (xem khối `test.include` trong
`vite.config.mjs`) nên file test mới tự động được nhận.

- [ ] **Step 1: Viết test thất bại cho `lang.ts`**

Tạo `server/src/email/lang.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickLang } from "./lang";

describe("pickLang", () => {
  it("nhận 'en' -> en", () => {
    expect(pickLang("en")).toBe("en");
  });

  it("nhận 'en-US' -> en (i18next có thể trả mã vùng)", () => {
    expect(pickLang("en-US")).toBe("en");
  });

  it("thiếu header hoặc giá trị lạ -> vi (mặc định của app)", () => {
    expect(pickLang(undefined)).toBe("vi");
    expect(pickLang("")).toBe("vi");
    expect(pickLang("fr")).toBe("vi");
    expect(pickLang("vi")).toBe("vi");
  });

  it("header dạng mảng -> lấy phần tử đầu", () => {
    expect(pickLang(["en", "vi"])).toBe("en");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận nó ĐỎ**

Run: `npx vitest run server/src/email/lang.test.ts`
Expected: FAIL — `Failed to resolve import "./lang"`.

- [ ] **Step 3: Viết `lang.ts`**

```ts
// Thuần — KHÔNG import Prisma/env/resend: unit test của file này chạy trong job CI
// `checks` vốn không có database.
export type Lang = "vi" | "en";

// Client gửi header `x-lang` lấy từ i18n.language. Mọi giá trị khác đều rơi về "vi"
// (khớp fallbackLng trong src/i18n/index.ts).
export function pickLang(header?: string | string[]): Lang {
  const raw = Array.isArray(header) ? header[0] : header;
  return String(raw || "")
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "vi";
}
```

- [ ] **Step 4: Chạy lại, xác nhận XANH**

Run: `npx vitest run server/src/email/lang.test.ts`
Expected: PASS — 4 test.

- [ ] **Step 5: Viết test thất bại cho `templates.ts`**

Tạo `server/src/email/templates.test.ts`:

```ts
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
```

- [ ] **Step 6: Chạy test, xác nhận nó ĐỎ**

Run: `npx vitest run server/src/email/templates.test.ts`
Expected: FAIL — `Failed to resolve import "./templates"`.

- [ ] **Step 7: Viết `templates.ts`**

```ts
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
```

- [ ] **Step 8: Chạy lại, xác nhận XANH**

Run: `npx vitest run server/src/email/`
Expected: PASS — 15 test (4 của `lang`, 11 của `templates`).

- [ ] **Step 9: Chạy đủ cổng**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run`
Expected: tất cả xanh, lint **0 warning**. Nếu `format:check` phàn nàn thì chạy
`npx prettier --write server/src/email/` rồi chạy lại.

- [ ] **Step 10: Commit + push**

```bash
git add server/src/email/
git commit -m "feat(GD4-email): templates.ts + lang.ts thuan (mau mail vi/en) + 15 test"
git push origin main
```

---

## Task 2 (E2): Hạ tầng gửi — `qr.ts` + `resend.ts` + `send.ts` + `routes.ts`

**Files:**
- Create: `server/src/email/qr.ts`, `server/src/email/resend.ts`, `server/src/email/send.ts`, `server/src/email/routes.ts`
- Modify: `server/src/app.ts` (mount), `.env.example`, `package.json` (dep `qrcode`)

**Interfaces:**
- Consumes: `renderTicketEmail`, `TicketEmailData` (task 1); `pickLang`, `Lang` (task 1);
  `ownerOrAdmin(userId: number, user: {id:number;role:string}|null): boolean` từ
  `server/src/api/reviews-validate.ts`; `getUserFromReq(req)` từ `server/src/auth/middleware.ts`;
  `prisma` từ `server/src/db/prisma.ts`; `WEB_ORIGIN` từ `server/src/env.ts`.
- Produces:
  - `isEmailEnabled(): boolean`
  - `sendMail(input: SendMailInput): Promise<SendMailResult>`
  - `qrPng(value: string): Promise<Buffer | null>`
  - `sendTicketEmail(bookingId: number, lang: Lang): Promise<SendTicketResult>` với
    `SendTicketResult = { ok: true } | { ok: false; status: number; error: string }`
  - `emailsRouter: Router` phục vụ `GET /api/emails/config` và `POST /api/emails/ticket`

- [ ] **Step 1: Kill server :4000 rồi cài `qrcode`**

Windows: server đang chạy khoá Prisma client ⇒ `npm install` sẽ fail EPERM ở
postinstall nếu không kill trước.

```bash
netstat -ano | grep ":4000" | head -1     # lấy PID ở cột cuối
taskkill //PID <PID> //F
npm install qrcode
npm install -D @types/qrcode
```

Expected: cài xong không lỗi EPERM. **Chưa bật lại server** — sẽ bật ở Step 8.

- [ ] **Step 2: Viết `qr.ts`**

```ts
import QRCode from "qrcode";

// PNG cho ảnh đính kèm. Trả null nếu sinh lỗi: email vẫn phải đi được vì mã vé
// dạng chữ đủ dùng ở quầy.
export async function qrPng(value: string): Promise<Buffer | null> {
  try {
    return await QRCode.toBuffer(value, { type: "png", width: 480, margin: 1 });
  } catch (e) {
    console.error("[email] qr", e);
    return null;
  }
}
```

- [ ] **Step 3: Viết `resend.ts`**

```ts
// KHÔNG import ./env: env.ts throw khi thiếu DATABASE_URL, mà thư mục email/ có unit
// test chạy trong job CI `checks` (không có database). Cùng khuôn payments/stripe.ts.
const API = "https://api.resend.com/emails";

// Thiếu key => tính năng email tắt êm, server vẫn khởi động bình thường.
export const isEmailEnabled = (): boolean =>
  Boolean(process.env.RESEND_API_KEY);

const sender = (): string =>
  process.env.MAIL_FROM || "Cinema <onboarding@resend.dev>";

export interface MailAttachment {
  filename: string;
  content: string; // base64
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}

export type SendMailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

// Gọi thẳng HTTP API của Resend — Node 22 có fetch sẵn nên không cần SDK.
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  if (!isEmailEnabled()) return { ok: false, error: "Chưa cấu hình email." };
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.attachments?.length
          ? { attachments: input.attachments }
          : {}),
      }),
    });
    const data = (await r.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!r.ok) return { ok: false, error: data.message || `Resend ${r.status}` };
    return { ok: true, id: data.id || "" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Lỗi mạng khi gửi email.",
    };
  }
}
```

- [ ] **Step 4: Viết `send.ts`**

```ts
// Tra DB rồi dựng email. Có Prisma => KHÔNG viết unit test cho file này (job CI
// `checks` không có database).
import { prisma } from "../db/prisma";
import { WEB_ORIGIN } from "../env";
import { renderTicketEmail } from "./templates";
import type { Lang } from "./lang";
import { qrPng } from "./qr";
import { isEmailEnabled, sendMail } from "./resend";

export type SendTicketResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const ticketCode = (id: number): string => `TK-${String(id).padStart(5, "0")}`;

// KHÔNG BAO GIỜ throw: hàm này được gọi ở nền ngay sau khi đơn đã trả về cho client.
export async function sendTicketEmail(
  bookingId: number,
  lang: Lang,
): Promise<SendTicketResult> {
  if (!isEmailEnabled())
    return { ok: false, status: 503, error: "Chưa cấu hình gửi email." };
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) return { ok: false, status: 404, error: "Không tìm thấy vé." };

    const [user, movie, showtime, cinema, room] = await Promise.all([
      prisma.user.findUnique({ where: { id: booking.userId } }),
      prisma.movie.findUnique({ where: { id: booking.movieId } }),
      prisma.showtime.findUnique({ where: { id: booking.showtimeId } }),
      prisma.cinema.findUnique({ where: { id: booking.cinemaId } }),
      prisma.room.findUnique({ where: { id: booking.roomId } }),
    ]);
    if (!user?.email)
      return { ok: false, status: 404, error: "Tài khoản chưa có email." };

    const code = ticketCode(booking.id);
    const raw = Array.isArray(booking.concessions)
      ? (booking.concessions as { name?: unknown; qty?: unknown }[])
      : [];
    const mail = renderTicketEmail(
      {
        code,
        movieTitle: movie?.title ?? `#${booking.movieId}`,
        cinemaName: cinema?.name ?? "",
        roomName: room?.name ?? "",
        roomType: room?.type ?? "",
        time: showtime?.time ?? "",
        seats: booking.seats,
        concessions: raw.map((c) => ({
          name: String(c.name ?? ""),
          qty: Number(c.qty) || 0,
        })),
        totalPrice: booking.totalPrice,
        ticketsUrl: `${WEB_ORIGIN}/tickets`,
      },
      lang,
    );

    // Cùng nội dung QR với src/components/ETicket.tsx để quầy quét được cả hai.
    const png = await qrPng(
      `${code}|${booking.showtimeId}|${booking.seats.join(",")}`,
    );
    const res = await sendMail({
      to: user.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: png
        ? [{ filename: `ve-${code}.png`, content: png.toString("base64") }]
        : [],
    });
    if (!res.ok) {
      console.error("[email]", res.error);
      return { ok: false, status: 502, error: res.error };
    }
    console.log(`[email] đã gửi vé ${code} -> ${user.email}`);
    return { ok: true };
  } catch (e) {
    console.error("[email]", e);
    return { ok: false, status: 502, error: "Không gửi được email." };
  }
}
```

- [ ] **Step 5: Viết `routes.ts`**

```ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getUserFromReq } from "../auth/middleware";
import { prisma } from "../db/prisma";
import { ownerOrAdmin } from "../api/reviews-validate";
import { isEmailEnabled } from "./resend";
import { pickLang } from "./lang";
import { sendTicketEmail } from "./send";

export const emailsRouter: Router = Router();

// Công khai: client cần biết có bật email không để ẩn/hiện nút "Gửi lại vé".
emailsRouter.get("/config", (_req, res) => {
  res.json({ enabled: isEmailEnabled() });
});

// Gửi lại tốn quota nhà cung cấp -> giới hạn nhịp theo IP.
const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Bạn gửi lại quá nhiều lần. Vui lòng đợi ít phút." },
});

emailsRouter.post("/ticket", resendLimiter, async (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: "Vui lòng đăng nhập." });
    return;
  }
  if (!isEmailEnabled()) {
    res.status(503).json({ error: "Chưa cấu hình gửi email." });
    return;
  }
  const bookingId = Number((req.body ?? {}).bookingId);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ error: "Thiếu mã vé." });
    return;
  }
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    res.status(404).json({ error: "Không tìm thấy vé." });
    return;
  }
  // Dùng lại luật chủ-hoặc-admin của reviews: không ai gửi vé người khác đi đâu được.
  if (!ownerOrAdmin(booking.userId, user)) {
    res.status(403).json({ error: "Không có quyền." });
    return;
  }
  const r = await sendTicketEmail(bookingId, pickLang(req.headers["x-lang"]));
  if (!r.ok) {
    res.status(r.status).json({ error: r.error });
    return;
  }
  res.json({ sent: true });
});
```

- [ ] **Step 6: Mount router trong `app.ts`**

Thêm import cạnh các import router khác:

```ts
import { emailsRouter } from "./email/routes";
```

và thêm đúng MỘT dòng, **trước** `app.use("/api", gatewayRouter)`:

```ts
app.use("/api/payments", paymentsRouter);
app.use("/api/emails", emailsRouter);
app.use("/api", gatewayRouter);
```

- [ ] **Step 7: Thêm biến vào `.env.example`**

Thêm vào cuối khối Server:

```
# Email vé (Resend) — thiếu RESEND_API_KEY thì tính năng email tắt êm, app chạy như cũ
RESEND_API_KEY=re_xxx
MAIL_FROM=Cinema <onboarding@resend.dev>
```

- [ ] **Step 8: Bật lại server rồi verify bằng curl**

```bash
npm run auth &        # hoặc chạy nền theo cách vẫn dùng
sleep 3
curl -s localhost:4000/api/emails/config
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:4000/api/emails/ticket \
  -H "Content-Type: application/json" -d '{"bookingId":1}'
```

Expected:
- `/config` → `{"enabled":false}` nếu `.env` chưa có `RESEND_API_KEY`, `{"enabled":true}` nếu có.
- `POST /ticket` chưa đăng nhập → **401**.
- Quan trọng: `/api/emails/config` **không** được trả `{"error":"Không có quyền."}` —
  nếu thấy chuỗi đó nghĩa là gateway catch-all đã nuốt request ⇒ mount sai thứ tự.

- [ ] **Step 9: Chạy đủ cổng**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`
Expected: xanh, 0 warning. `npm run e2e` cũng phải xanh (server đã bật lại ở Step 8).

- [ ] **Step 10: Commit + push**

```bash
git add server/src/email/ server/src/app.ts .env.example package.json package-lock.json
git commit -m "feat(GD4-email): qr/resend/send + router /api/emails (config + gui lai ve)"
git push origin main
```

---

## Task 3 (E3): Móc vào luồng đặt vé

**Files:**
- Modify: `server/src/api/repo.ts` (kiểu trả về của `handleRest`)
- Modify: `server/src/api/gateway.ts:60-94` (nhánh `bookings` + `POST`)

**Interfaces:**
- Consumes: `sendTicketEmail`, `pickLang` (task 2).
- Produces: `handleRest(req, res, rest, extraFilters?): Promise<unknown>` — trả bản ghi
  vừa tạo/sửa (POST/PATCH/PUT), `undefined` với các nhánh khác.

- [ ] **Step 1: Đổi kiểu trả về của `handleRest`**

Trong `server/src/api/repo.ts`, đổi chữ ký:

```ts
export async function handleRest(
  req: Request,
  res: Response,
  rest: string,
  extraFilters?: Record<string, string | number>,
): Promise<unknown> {
```

rồi trả bản ghi ở hai nhánh ghi (chỉ thêm `return row;`, giữ nguyên mọi status code):

```ts
      const row = await delegate(c).create({ data });
      res.status(201).json(row); // json-server trả 201 khi tạo
      return row;
```

```ts
      const row = await delegate(c).update({ where: { id }, data });
      res.json(row);
      return row;
```

Các `return;` còn lại giữ nguyên (trả `undefined`). **Không** đụng bất kỳ status code
hay thân phản hồi nào — hợp đồng HTTP phải y nguyên.

- [ ] **Step 2: Kiểm tra typecheck vẫn xanh**

Run: `npm run typecheck`
Expected: PASS. 7 chỗ gọi `handleRest` hiện có bỏ qua giá trị trả về nên không phải sửa.

- [ ] **Step 3: Bắn email ở nền trong `gateway.ts`**

Thêm import ở đầu file:

```ts
import { sendTicketEmail } from "../email/send";
import { pickLang } from "../email/lang";
```

Trong nhánh `bookings` + `POST`, thay đoạn cuối:

```ts
        req.body = body;
        await handleRest(req, res, rest);
        if (stId != null) releaseHolds(stId, user.id); // đặt xong -> nhả hold của mình
        return;
```

bằng:

```ts
        req.body = body;
        const created = await handleRest(req, res, rest);
        if (stId != null) releaseHolds(stId, user.id); // đặt xong -> nhả hold của mình
        // Gửi vé qua email ở NỀN: đơn đã trả về client rồi (tiền cũng đã trừ), email
        // hỏng không được phép ảnh hưởng. sendTicketEmail không bao giờ throw.
        const newId = (created as { id?: number } | undefined)?.id;
        if (newId) void sendTicketEmail(newId, pickLang(req.headers["x-lang"]));
        return;
```

**Không** thêm gửi email vào nhánh `paid.existing` phía trên (đó là lần gửi lại cùng
`paymentRef` sau khi rớt mạng — vé đó đã gửi email ở lần đầu).

- [ ] **Step 4: Restart server rồi đặt vé thử khi CHƯA có key**

Tạm chắc chắn `.env` **không** có `RESEND_API_KEY` (comment lại nếu đang có), rồi:

```bash
# kill :4000 rồi npm run auth
curl -s -c /tmp/ck.txt -X POST localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@cinema.vn","password":"123456"}' -o /dev/null
curl -s -b /tmp/ck.txt -X POST localhost:4000/api/bookings \
  -H "Content-Type: application/json" -H "x-lang: vi" \
  -d '{"movieId":1,"showtimeId":1,"cinemaId":1,"roomId":1,"seats":["J9"],"seatTypes":{"standard":1,"vip":0},"totalPrice":90000,"paymentMethod":"counter"}'
```

Expected: **201** kèm đơn vừa tạo, log server **không** có dòng `[email]`, và server
không crash. Xoá đơn test ngay (đăng nhập admin rồi `DELETE /api/bookings/<id>`),
và `rm /tmp/ck.txt`.

- [ ] **Step 5: Lặp lại khi CÓ key**

Đặt `RESEND_API_KEY` thật vào `.env`, kill :4000, `npm run auth`, chạy lại đúng lệnh
đặt vé ở Step 4 (đổi ghế sang `J8` cho khỏi trùng).

Expected: vẫn **201** ngay lập tức, và trong log server xuất hiện `[email]` — hoặc dòng
"đã gửi vé TK-000xx -> a@cinema.vn", hoặc dòng lỗi Resend từ chối email giả. **Cả hai
đều là kết quả đúng**: điều cần chứng minh là đơn không bị ảnh hưởng. Xoá đơn test.

- [ ] **Step 6: Chạy đủ cổng**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run e2e && npm run build`
Expected: xanh hết. `e2e/booking.spec.ts` đặt vé thật ⇒ đây chính là phép thử hồi quy
cho việc "email lỗi không làm hỏng đặt vé".

- [ ] **Step 7: Commit + push**

```bash
git add server/src/api/repo.ts server/src/api/gateway.ts
git commit -m "feat(GD4-email): handleRest tra ban ghi + gateway ban email ve o nen sau khi dat"
git push origin main
```

---

## Task 4 (E4): Client — service, query, nút gửi lại, i18n

**Files:**
- Create: `src/services/email.ts`, `src/queries/email.ts`, `src/components/ResendTicketButton.tsx`, `src/components/ResendTicketButton.css`
- Modify: `src/queries/keys.ts`, `src/services/api.ts` (createBooking), `src/pages/booking/TicketStep.tsx`, `src/pages/MyTickets.tsx`, `src/i18n/locales/vi.json`, `src/i18n/locales/en.json`

**Interfaces:**
- Consumes: `GET /api/emails/config` → `{ enabled: boolean }`; `POST /api/emails/ticket`
  body `{ bookingId: number }` → `{ sent: true }` hoặc `{ error: string }` (task 2).
- Produces: `useEmailConfig()`, `useResendTicket()`, `<ResendTicketButton bookingId={number} />`.

- [ ] **Step 1: Viết `src/services/email.ts`**

```ts
// Email vé qua cổng phân quyền (:4000/api/emails).
import i18n from "i18n";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export interface EmailConfig {
  enabled: boolean;
}

export const getEmailConfig = (): Promise<EmailConfig> =>
  fetch(`${BASE_URL}/emails/config`, { credentials: "include" }).then(
    (r) => r.json() as Promise<EmailConfig>,
  );

export async function resendTicketEmail(bookingId: number): Promise<void> {
  const r = await fetch(`${BASE_URL}/emails/ticket`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-lang": i18n.language || "vi", // server chọn mẫu mail vi/en theo header này
    },
    body: JSON.stringify({ bookingId }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Không gửi được email.");
}
```

- [ ] **Step 2: Thêm key cache + hook**

Trong `src/queries/keys.ts`, thêm một dòng vào registry `qk`:

```ts
  emailConfig: ["emailConfig"] as const,
```

Tạo `src/queries/email.ts`:

```ts
import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getEmailConfig,
  resendTicketEmail,
  type EmailConfig,
} from "services/email";
import { qk } from "./keys";

// Cấu hình email không đổi trong một phiên -> không cần refetch.
export const useEmailConfig = (): UseQueryResult<EmailConfig> =>
  useQuery({
    queryKey: qk.emailConfig,
    queryFn: getEmailConfig,
    staleTime: Infinity,
  });

export const useResendTicket = (): UseMutationResult<
  void,
  Error,
  number
> =>
  useMutation({ mutationFn: (bookingId: number) => resendTicketEmail(bookingId) });
```

- [ ] **Step 3: Gửi kèm `x-lang` khi đặt vé**

Trong `src/services/api.ts`, thêm import ở đầu file:

```ts
import i18n from "i18n";
```

rồi sửa `createBooking` (dòng ~71) để header mang thêm `x-lang`:

```ts
export const createBooking = async (
  booking: Partial<Booking>,
): Promise<Booking> => {
  const r = await req(`/bookings`, {
    method: "POST",
    // x-lang: server dùng để chọn ngôn ngữ email vé (không import chéo được src/i18n).
    headers: { "Content-Type": "application/json", "x-lang": i18n.language || "vi" },
    body: JSON.stringify(booking),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Đặt vé thất bại.");
  return data as Booking;
};
```

- [ ] **Step 4: Viết `ResendTicketButton.tsx` + CSS**

`src/components/ResendTicketButton.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { useEmailConfig, useResendTicket } from "queries/email";
import "./ResendTicketButton.css";

// Không cấu hình email (thiếu RESEND_API_KEY) -> nút biến mất, không báo lỗi gì.
export default function ResendTicketButton({
  bookingId,
}: {
  bookingId: number;
}) {
  const { t } = useTranslation();
  const config = useEmailConfig();
  const resend = useResendTicket();

  if (!config.data?.enabled) return null;

  return (
    <div className="resend-k">
      <button
        type="button"
        className="resend-k__btn"
        disabled={resend.isPending}
        onClick={() => resend.mutate(bookingId)}
      >
        {resend.isPending ? t("email.sending") : t("email.resend")}
      </button>
      {resend.isSuccess && (
        <span className="resend-k__ok" role="status">
          {t("email.resendOk")}
        </span>
      )}
      {resend.isError && (
        <span className="resend-k__err" role="alert">
          {resend.error.message}
        </span>
      )}
    </div>
  );
}
```

`src/components/ResendTicketButton.css`:

```css
.resend-k {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
  margin-top: var(--sp-3);
}

.resend-k__btn {
  background: transparent;
  color: var(--text);
  border: var(--bw-1) solid var(--border-strong);
  border-radius: 0;
  padding: 10px 16px;
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
}

.resend-k__btn:hover:not(:disabled) {
  background: var(--red);
  border-color: var(--red);
  color: #fff;
}

.resend-k__btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.resend-k__ok,
.resend-k__err {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
}

.resend-k__ok {
  color: var(--text-dim);
}

.resend-k__err {
  color: var(--red);
}
```

Trước khi commit, mở `src/styles/tokens.css` xác nhận các biến dùng ở trên tồn tại
(`--sp-3`, `--bw-1`, `--border-strong`, `--font-mono`, `--fs-label`, `--dur-fast`,
`--ease`, `--red`, `--text`, `--text-dim`). **Lưu ý: KHÔNG có token `--fs-xs`** — nhỏ
nhất là `--fs-label`. Nếu tên nào lệch, đổi theo tên thật trong `tokens.css`.

- [ ] **Step 5: Thêm khoá i18n vào CẢ HAI file locale**

`src/i18n/locales/vi.json` — thêm namespace `email` ở cấp cao nhất:

```json
  "email": {
    "sentTo": "Đã gửi vé tới {{email}}",
    "resend": "Gửi lại vé qua email",
    "sending": "Đang gửi…",
    "resendOk": "Đã gửi!"
  },
```

`src/i18n/locales/en.json`:

```json
  "email": {
    "sentTo": "Ticket sent to {{email}}",
    "resend": "Resend ticket by email",
    "sending": "Sending…",
    "resendOk": "Sent!"
  },
```

- [ ] **Step 6: Gắn vào bước ④ (`TicketStep.tsx`)**

Thêm import:

```tsx
import { useAuth } from "context/AuthContext";
import { useEmailConfig } from "queries/email";
import ResendTicketButton from "components/ResendTicketButton";
```

Trong thân component, **trước** dòng `if (!booking) return null;` (hook phải chạy vô
điều kiện — gọi hook sau một early-return là lỗi react-hooks và sẽ làm đỏ lint):

```tsx
  const { user } = useAuth();
  const emailConfig = useEmailConfig();
```

Rồi chèn ngay dưới khối `<ETicket … />`:

```tsx
      {emailConfig.data?.enabled && user?.email && (
        <p className="ticket-k__mailed">
          {t("email.sentTo", { email: user.email })}
        </p>
      )}
      <ResendTicketButton bookingId={booking.id} />
```

Thêm vào `src/pages/booking/Booking.css`:

```css
.ticket-k__mailed {
  margin-top: var(--sp-4);
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  color: var(--text-dim);
  text-align: center;
}
```

- [ ] **Step 7: Gắn vào `MyTickets.tsx`**

Thêm import:

```tsx
import ResendTicketButton from "components/ResendTicketButton";
```

Trong vòng lặp `filtered.map`, thêm ngay sau `<ETicket … size="compact" />` (bên trong
`div.mytk-k__item`) — chỉ cho vé sắp tới, vé quá khứ gửi lại không có ý nghĩa:

```tsx
                {tab === "upcoming" && <ResendTicketButton bookingId={b.id} />}
```

- [ ] **Step 8: Chạy đủ cổng**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`
Expected: xanh, **0 warning**. Nếu prettier phàn nàn: `npx prettier --write src/`.

- [ ] **Step 9: Kiểm bằng mắt trên dev server**

Mở http://localhost:3000. Với `.env` **có** `RESEND_API_KEY`: đăng nhập
`a@cinema.vn/123456` → `/tickets` → mỗi vé sắp tới có nút "GỬI LẠI VÉ QUA EMAIL".
Với `.env` **không** có key (nhớ kill + `npm run auth` sau khi sửa `.env`): nút biến
mất hoàn toàn, trang không có lỗi console.

- [ ] **Step 10: Chạy e2e rồi commit + push**

Run: `npm run e2e`
Expected: 20 test xanh (nút mới không đụng selector nào của các spec sẵn có).

```bash
git add src/services/email.ts src/queries/email.ts src/queries/keys.ts src/services/api.ts \
        src/components/ResendTicketButton.tsx src/components/ResendTicketButton.css \
        src/pages/booking/TicketStep.tsx src/pages/booking/Booking.css \
        src/pages/MyTickets.tsx src/i18n/locales/vi.json src/i18n/locales/en.json
git commit -m "feat(GD4-email): client gui lai ve (service/query/ResendTicketButton) + x-lang + i18n"
git push origin main
```

---

## Task 5 (E5): Verify thật bằng Gmail + tài liệu

**Files:**
- Modify: `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: toàn bộ tính năng từ task 1–4.
- Produces: không có mã mới.

- [ ] **Step 1: Chuẩn bị key thật**

Người dùng tạo tài khoản Resend (đăng nhập bằng GitHub), lấy API key ở
**API Keys → Create API Key** (quyền *Sending access* là đủ), rồi dán vào `.env`:

```
RESEND_API_KEY=re_...
MAIL_FROM=Cinema <onboarding@resend.dev>
```

Kill :4000, `npm run auth`, rồi `curl -s localhost:4000/api/emails/config` →
kỳ vọng `{"enabled":true}`.

- [ ] **Step 2: Đặt vé thật bằng tài khoản có Gmail thật**

Trên http://localhost:3000: **Đăng ký** một tài khoản mới bằng chính địa chỉ Gmail đã
dùng để đăng ký Resend (Resend chưa verify domain thì chỉ gửi được tới đúng địa chỉ đó)
→ chọn phim → suất chiếu → ghế → bỏ qua bắp nước → "Thanh toán tại quầy" → tới bước ④.

Expected: bước ④ hiện "Đã gửi vé tới `<gmail>`" + nút gửi lại; hộp thư nhận email
tiêu đề `Vé của bạn · … · TK-000xx` kèm tệp đính kèm `ve-TK-000xx.png`.

- [ ] **Step 3: Kiểm bản tiếng Anh**

Đổi ngôn ngữ sang **EN** ở Navbar, bấm **Resend ticket by email** ở bước ④.
Expected: email thứ hai có tiêu đề `Your ticket · …`, nhãn `Movie/Cinema/Date/Seats`,
tổng tiền dạng `291,000 ₫`, ngày dạng `02 Aug 2026`.

- [ ] **Step 4: Chụp màn hình đưa người dùng duyệt**

Chụp email (desktop + mobile) và bước ④, đăng lên Artifact như mọi lát trước
(người dùng review qua điện thoại).

- [ ] **Step 5: Dọn dữ liệu test**

Xoá đơn vừa đặt qua admin (`/admin/bookings` → Huỷ) hoặc API. Tài khoản đăng ký bằng
Gmail thật thì **giữ lại** để lần sau còn thử — nhưng đừng đưa nó vào `db.json`.

- [ ] **Step 6: Cập nhật `CLAUDE.md`**

Thêm vào mục **Architecture**, ngay sau đoạn `payments/*`, một gạch đầu dòng:

```markdown
  - **`email/*`** — email vé qua **Resend** (HTTP API, gọi bằng `fetch` trần — không SDK). `templates.ts` + `lang.ts` là **pure** (no Prisma/env/resend imports, so their unit tests run in CI without a database): `renderTicketEmail(data, lang)` builds subject/HTML/plain-text in vi or en, `splitTime()` **slices the ISO string instead of `new Date()`** so the email never shifts hours (the DB string carries no timezone; Render runs UTC, the browser is UTC+7), and `formatVnd()` groups digits itself rather than trusting Node's ICU. `qr.ts` renders the QR PNG (same payload as `ETicket.tsx`) attached as `ve-TK-000xx.png` — Gmail blocks `data:` images, so an attachment is the only thing that works everywhere. `send.ts` reads the booking + user/movie/showtime/cinema/room and **never throws**: `gateway.ts` fires it with `void` **after** the booking response is already sent, so a mail failure can't cost a paid ticket. `routes.ts` serves `GET /api/emails/config` (public `{enabled}`) and `POST /api/emails/ticket` (login + **owner-or-admin**, rate-limited 5/15m) — the resend path, which is synchronous and reports the real error. `isEmailEnabled()` is false when `RESEND_API_KEY` is missing, which **hides the resend button instead of breaking the app**, exactly like the Stripe card method.
```

Cập nhật dòng mount order cho đúng:

```markdown
  - **Mount order in `app.ts` is load-bearing**: `/auth` → `/api/occupied-seats` → `/api/holds` → `/api/payments` → `/api/emails` → `/api` (catch-all) → SPA.
```

Và trong mục **Booking flow**, thêm một câu ở cuối: sau khi `POST /bookings` trả về, gateway
bắn email vé ở nền theo header `x-lang`; nhánh idempotent (`paymentRef` gửi lại) **không**
gửi email lần hai.

- [ ] **Step 7: Cập nhật `README.md`**

Thêm `RESEND_API_KEY` / `MAIL_FROM` vào bảng biến môi trường, và một dòng ở danh sách
tính năng: "Email vé (Resend) — gửi tự động sau khi đặt + nút gửi lại; thiếu key thì
tự tắt".

- [ ] **Step 8: Chạy đủ cổng lần cuối**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run e2e && npm run build`
Expected: xanh hết — 7 cổng.

- [ ] **Step 9: Commit + push**

```bash
git add CLAUDE.md README.md
git commit -m "docs(GD4-email): cap nhat CLAUDE/README + verify gui mail that qua Resend"
git push origin main
```

- [ ] **Step 10: Việc còn lại cho người dùng (không phải code)**

Thêm `RESEND_API_KEY` (và `MAIL_FROM` nếu muốn) vào **Environment của service trên
Render** thì bản live mới gửi được email — y hệt tình trạng `STRIPE_*` hiện nay. Không
thêm cũng không sao: bản live chỉ đơn giản là không có nút gửi lại.

---

## Ghi chú rủi ro (đọc trước khi bắt đầu)

1. **Resend chưa verify domain ⇒ chỉ gửi được tới email chủ tài khoản Resend.** Gửi tới
   `a@cinema.vn` sẽ bị từ chối — đó là hành vi **đúng như thiết kế**, không phải bug.
2. **Windows khoá Prisma client:** kill :4000 trước `npm install`, và nhớ bật lại.
3. **`server/**` không watch:** mọi thay đổi server cần kill :4000 + `npm run auth`.
4. **Đừng đặt `sendTicketEmail` trước `res` đã gửi** — nó phải chạy sau khi `handleRest`
   đã trả lời client, nếu không một lỗi mạng tới Resend sẽ kéo dài thời gian phản hồi.
