import { useNavigate } from "react-router-dom";
import ETicket from "components/ETicket";
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
  if (!booking) return null;

  return (
    <div className="ticket-k">
      <div className="ticket-k__success">
        <div className="ticket-k__check" aria-hidden="true">
          ✓
        </div>
        <h2 className="ticket-k__successtitle">Đặt vé thành công!</h2>
        <p className="ticket-k__successsub">
          Vé điện tử của bạn đã sẵn sàng. Xuất trình mã QR tại rạp để vào cửa.
        </p>
      </div>

      <ETicket
        booking={booking}
        movie={movie}
        cinema={cinema}
        room={room}
        showtime={showtime}
      />

      <div className="ticket-k__actions">
        <button
          type="button"
          className="ticket-k__primary"
          onClick={() => navigate("/tickets")}
        >
          Xem vé của tôi
        </button>
        <button
          type="button"
          className="ticket-k__ghost"
          onClick={() => navigate("/")}
        >
          Về trang chủ
        </button>
      </div>
    </div>
  );
}
