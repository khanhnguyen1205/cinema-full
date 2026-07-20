import { QRCodeSVG } from "qrcode.react";
import TicketEdge from "components/ui/TicketEdge";
import type { Booking, Movie, Cinema, Room, Showtime } from "types";
import "./ETicket.css";

const fmt = (n?: number) => (n || 0).toLocaleString("vi-VN") + "₫";
const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const fmtTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const METHOD_LABEL: Record<string, string> = {
  momo: "Ví Momo",
  card: "Thẻ ATM / Visa",
  counter: "Tại quầy",
};

const ticketCode = (b: Booking) => `TK-${String(b.id).padStart(5, "0")}`;
const qrValue = (b: Booking) =>
  `${ticketCode(b)}|${b.showtimeId}|${(b.seats || []).join(",")}`;

export default function ETicket({
  booking,
  movie,
  cinema,
  room,
  showtime,
  size = "full",
}: {
  booking: Booking;
  movie?: Movie | null;
  cinema?: Cinema | null;
  room?: Room | null;
  showtime?: Showtime | null;
  size?: "full" | "compact";
}) {
  const code = ticketCode(booking);
  const qrSize = size === "compact" ? 96 : 148;

  return (
    <TicketEdge className={`eticket-k eticket-k--${size}`}>
      <div className="eticket-k__main">
        <div className="eticket-k__top">
          <span className="eticket-k__brand">THE CINEMATIC EDITORIAL</span>
          <span className="eticket-k__code">N°{code}</span>
        </div>
        <h3 className="eticket-k__title">
          {movie?.title || `Phim #${booking.movieId}`}
        </h3>
        <p className="eticket-k__cinema">
          {cinema?.name}
          {room ? ` · ${room.name} · ${room.type}` : ""}
        </p>
        <div className="eticket-k__grid">
          <div>
            <span className="eticket-k__label">Ngày</span>
            <span className="eticket-k__value">{fmtDate(showtime?.time)}</span>
          </div>
          <div>
            <span className="eticket-k__label">Giờ</span>
            <span className="eticket-k__value">{fmtTime(showtime?.time)}</span>
          </div>
          <div>
            <span className="eticket-k__label">Ghế</span>
            <span className="eticket-k__value eticket-k__seats">
              {(booking.seats || []).join(", ") || "—"}
            </span>
          </div>
          <div>
            <span className="eticket-k__label">Thanh toán</span>
            <span className="eticket-k__value">
              {METHOD_LABEL[booking.paymentMethod || ""] ||
                booking.paymentMethod ||
                "—"}
            </span>
          </div>
        </div>
        {booking.concessions && booking.concessions.length > 0 && (
          <div className="eticket-k__fnb">
            <span className="eticket-k__label">Bắp nước</span>
            <span className="eticket-k__value">
              {booking.concessions.map((c) => `${c.name} ×${c.qty}`).join(", ")}
            </span>
          </div>
        )}
        <div className="eticket-k__total">
          <span>Tổng cộng</span>
          <span className="eticket-k__total-amount">
            {fmt(booking.totalPrice)}
          </span>
        </div>
      </div>

      <div className="eticket-k__stub">
        <div className="eticket-k__qr">
          <QRCodeSVG value={qrValue(booking)} size={qrSize} level="M" />
        </div>
        <span className="eticket-k__stubcode">{code}</span>
        <span className="eticket-k__stubhint">Quét để soát vé</span>
      </div>
    </TicketEdge>
  );
}
