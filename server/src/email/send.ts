// Tra DB rồi dựng email. Có Prisma => KHÔNG viết unit test cho file này (job CI
// `checks` không có database).
import { prisma } from "../db/prisma";
import { WEB_ORIGIN } from "../env";
import { renderTicketEmail } from "./templates";
import type { Lang } from "./lang";
import { qrPng } from "./qr";
import { isEmailEnabled, sendMail } from "./resend";

export type SendTicketResult =
  { ok: true } | { ok: false; status: number; error: string };

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
    if (!booking)
      return { ok: false, status: 404, error: "Không tìm thấy vé." };

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
