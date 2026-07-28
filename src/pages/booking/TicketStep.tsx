import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ETicket from "components/ETicket";
import ResendTicketButton from "components/ResendTicketButton";
import { useAuth } from "context/AuthContext";
import { useEmailConfig } from "queries/email";
import type { Booking, Movie, Cinema, Room, Showtime } from "types";

export default function TicketStep({
  booking,
  movie,
  cinema,
  room,
  showtime,
}: {
  booking: Booking | null;
  movie?: Movie | null;
  cinema?: Cinema | null;
  room?: Room | null;
  showtime?: Showtime | null;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Hook phải chạy vô điều kiện -> đặt TRƯỚC early-return dưới đây.
  const { user } = useAuth();
  const emailConfig = useEmailConfig();
  if (!booking) return null;

  return (
    <div className="ticket-k">
      <div className="ticket-k__success">
        <div className="ticket-k__check" aria-hidden="true">
          ✓
        </div>
        <h2 className="ticket-k__successtitle">{t("booking.ticketSuccess")}</h2>
        <p className="ticket-k__successsub">{t("booking.ticketSub")}</p>
      </div>

      <ETicket
        booking={booking}
        movie={movie}
        cinema={cinema}
        room={room}
        showtime={showtime}
      />

      {emailConfig.data?.enabled && user?.email && (
        <p className="ticket-k__mailed">
          {t("email.sentTo", { email: user.email })}
        </p>
      )}
      <ResendTicketButton bookingId={booking.id} />

      <div className="ticket-k__actions">
        <button
          type="button"
          className="ticket-k__primary"
          onClick={() => navigate("/tickets")}
        >
          {t("booking.ticketViewMine")}
        </button>
        <button
          type="button"
          className="ticket-k__ghost"
          onClick={() => navigate("/")}
        >
          {t("booking.ticketHome")}
        </button>
      </div>
    </div>
  );
}
