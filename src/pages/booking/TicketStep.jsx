import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "₫";
const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const METHOD_LABEL = {
  momo: "Ví Momo",
  card: "Thẻ ATM / Visa",
  counter: "Tại quầy",
};

export default function TicketStep({ booking, movie, cinema, room, showtime }) {
  const navigate = useNavigate();
  const code = `TK-${String(booking.id).padStart(5, "0")}`;
  const qrValue = `${code}|${booking.showtimeId}|${(booking.seats || []).join(",")}`;

  return (
    <div className="ticket-step">
      <div className="ts-success">
        <div className="booked-icon">✓</div>
        <h2 className="ts-success-title">Đặt vé thành công!</h2>
        <p className="ts-success-sub">
          Vé điện tử của bạn đã sẵn sàng. Xuất trình mã QR tại rạp để vào cửa.
        </p>
      </div>

      <div className="eticket">
        <div className="eticket-main">
          <div className="eticket-top">
            <span className="eticket-brand">THE CINEMATIC EDITORIAL</span>
            <span className="eticket-code">#{code}</span>
          </div>

          <h3 className="eticket-title">
            {movie?.title || `Phim #${booking.movieId}`}
          </h3>
          <p className="eticket-cinema">
            {cinema?.name}
            {room ? ` · ${room.name} · ${room.type}` : ""}
          </p>

          <div className="eticket-grid">
            <div>
              <span className="eticket-label">Ngày</span>
              <span className="eticket-value">{fmtDate(showtime?.time)}</span>
            </div>
            <div>
              <span className="eticket-label">Giờ</span>
              <span className="eticket-value">{fmtTime(showtime?.time)}</span>
            </div>
            <div>
              <span className="eticket-label">Ghế</span>
              <span className="eticket-value eticket-seats">
                {(booking.seats || []).join(", ") || "—"}
              </span>
            </div>
            <div>
              <span className="eticket-label">Thanh toán</span>
              <span className="eticket-value">
                {METHOD_LABEL[booking.paymentMethod] || booking.paymentMethod}
              </span>
            </div>
          </div>

          {booking.concessions?.length > 0 && (
            <div className="eticket-fnb">
              <span className="eticket-label">Bắp nước</span>
              <span className="eticket-value">
                {booking.concessions
                  .map((c) => `${c.name} ×${c.qty}`)
                  .join(", ")}
              </span>
            </div>
          )}

          <div className="eticket-total">
            <span>Tổng cộng</span>
            <span className="eticket-total-amount">
              {fmt(booking.totalPrice)}
            </span>
          </div>
        </div>

        <div className="eticket-stub">
          <div className="eticket-qr">
            <QRCodeSVG
              value={qrValue}
              size={148}
              level="M"
              includeMargin={false}
            />
          </div>
          <span className="eticket-stub-code">{code}</span>
          <span className="eticket-stub-hint">Quét để soát vé</span>
        </div>
      </div>

      <div className="ts-actions">
        <button className="btn-primary" onClick={() => navigate("/tickets")}>
          Xem vé của tôi
        </button>
        <button className="btn-ghost" onClick={() => navigate("/")}>
          Về trang chủ
        </button>
      </div>
    </div>
  );
}
