import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import TicketEdge from "components/ui/TicketEdge";
import type { Booking, Movie, Cinema, Room, Showtime } from "types";
import { formatPrice, formatDate } from "i18n/format";
import "./ETicket.css";

const fmt = (n?: number) => formatPrice(n || 0);
const fmtDate = (iso?: string) =>
  iso
    ? formatDate(iso, {
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

const METHOD_KEY: Record<string, string> = {
  momo: "tickets.payMomo",
  card: "tickets.payCard",
  counter: "tickets.payCounter",
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
  const { t } = useTranslation();
  const code = ticketCode(booking);
  const qrSize = size === "compact" ? 96 : 148;
  const method = booking.paymentMethod || "";

  return (
    <TicketEdge className={`eticket-k eticket-k--${size}`}>
      <div className="eticket-k__main">
        <div className="eticket-k__top">
          <span className="eticket-k__brand">THE CINEMATIC EDITORIAL</span>
          <span className="eticket-k__code">N°{code}</span>
        </div>
        <h3 className="eticket-k__title">
          {movie?.title || `#${booking.movieId}`}
        </h3>
        <p className="eticket-k__cinema">
          {cinema?.name}
          {room ? ` · ${room.name} · ${room.type}` : ""}
        </p>
        <div className="eticket-k__grid">
          <div>
            <span className="eticket-k__label">{t("tickets.eDate")}</span>
            <span className="eticket-k__value">{fmtDate(showtime?.time)}</span>
          </div>
          <div>
            <span className="eticket-k__label">{t("tickets.eTime")}</span>
            <span className="eticket-k__value">{fmtTime(showtime?.time)}</span>
          </div>
          <div>
            <span className="eticket-k__label">{t("tickets.eSeat")}</span>
            <span className="eticket-k__value eticket-k__seats">
              {(booking.seats || []).join(", ") || "—"}
            </span>
          </div>
          <div>
            <span className="eticket-k__label">{t("tickets.ePayment")}</span>
            <span className="eticket-k__value">
              {METHOD_KEY[method] ? t(METHOD_KEY[method]) : method || "—"}
            </span>
          </div>
        </div>
        {booking.concessions && booking.concessions.length > 0 && (
          <div className="eticket-k__fnb">
            <span className="eticket-k__label">{t("tickets.eFnb")}</span>
            <span className="eticket-k__value">
              {booking.concessions.map((c) => `${c.name} ×${c.qty}`).join(", ")}
            </span>
          </div>
        )}
        <div className="eticket-k__total">
          <span>{t("tickets.eTotal")}</span>
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
        <span className="eticket-k__stubhint">{t("tickets.eScan")}</span>
      </div>
    </TicketEdge>
  );
}
