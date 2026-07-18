import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  getBookings,
  getMovie,
  getShowtime,
  getCinema,
  getRoom,
} from "services/api";
import { useAuth } from "context/AuthContext";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import "./MyTickets.css";

const METHOD_LABEL = {
  momo: "Ví Momo",
  card: "Thẻ ATM / Visa",
  counter: "Tại quầy",
};
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "₫";
const ticketCode = (b) => `TK-${String(b.id).padStart(5, "0")}`;
const qrValue = (b) =>
  `${ticketCode(b)}|${b.showtimeId}|${(b.seats || []).join(",")}`;
const formatDate = (iso) =>
  new Date(iso)
    .toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

function TicketCard({ booking, movie, showtime, cinema, room, onView }) {
  const fnb = booking.concessions || [];

  return (
    <div className="ticket-card">
      <div className="ticket-poster">
        <span className="ticket-poster-initial">
          {movie?.title?.[0] || "?"}
        </span>
        {room?.type && <span className="ticket-badge">{room.type}</span>}
      </div>

      <div className="ticket-body">
        <div className="ticket-header">
          <div>
            <div className="ticket-cinema">THE CINEMATIC EDITORIAL</div>
            <div className="ticket-id">#{ticketCode(booking)}</div>
          </div>
        </div>

        <h3 className="ticket-title">
          {movie?.title || `Movie #${booking.movieId}`}
        </h3>
        {(cinema || room) && (
          <div className="ticket-cinema-line">
            {cinema?.name}
            {room ? ` · ${room.name}` : ""}
          </div>
        )}

        <div className="ticket-info-row">
          <div className="ticket-info-cell">
            <span className="ticket-info-label">NGÀY</span>
            <span className="ticket-info-value">
              {showtime ? formatDate(showtime.time) : "—"}
            </span>
          </div>
          <div className="ticket-info-cell">
            <span className="ticket-info-label">GIỜ</span>
            <span className="ticket-info-value">
              {showtime ? formatTime(showtime.time) : "—"}
            </span>
          </div>
        </div>

        <div className="ticket-info-row">
          <div className="ticket-info-cell">
            <span className="ticket-info-label">PHÒNG</span>
            <span className="ticket-info-value">{room?.name || "—"}</span>
          </div>
          <div className="ticket-info-cell">
            <span className="ticket-info-label">GHẾ</span>
            <span className="ticket-info-value" style={{ color: "var(--red)" }}>
              {booking.seats?.join(", ") || "—"}
            </span>
          </div>
        </div>

        {fnb.length > 0 && (
          <div className="ticket-fnb">
            🍿 {fnb.map((c) => `${c.name} ×${c.qty}`).join(", ")}
          </div>
        )}

        <div className="ticket-actions">
          <div className="qr-box">
            <QRCodeSVG value={qrValue(booking)} size={56} level="M" />
          </div>
          <button
            className="btn-primary"
            style={{ fontSize: 11, padding: "10px 16px", letterSpacing: 1.5 }}
            onClick={onView}
          >
            XEM VÉ
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketModal({ entry, onClose }) {
  const { movie, showtime, cinema, room } = entry;
  const fnb = entry.concessions || [];

  return (
    <div className="tk-modal-overlay" onClick={onClose}>
      <div className="tk-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tk-modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>

        <div className="tk-modal-head">
          <span className="tk-modal-brand">THE CINEMATIC EDITORIAL</span>
          <span className="tk-modal-code">#{ticketCode(entry)}</span>
        </div>

        <h2 className="tk-modal-title">
          {movie?.title || `Phim #${entry.movieId}`}
        </h2>
        <p className="tk-modal-cinema">
          {cinema?.name}
          {room ? ` · ${room.name} · ${room.type}` : ""}
        </p>

        <div className="tk-modal-qr">
          <QRCodeSVG value={qrValue(entry)} size={188} level="M" />
        </div>
        <p className="tk-modal-scan">Xuất trình mã QR này tại quầy soát vé</p>

        <div className="tk-modal-grid">
          <div>
            <span className="tk-modal-label">Ngày</span>
            <span className="tk-modal-value">
              {showtime ? formatDate(showtime.time) : "—"}
            </span>
          </div>
          <div>
            <span className="tk-modal-label">Giờ</span>
            <span className="tk-modal-value">
              {showtime ? formatTime(showtime.time) : "—"}
            </span>
          </div>
          <div>
            <span className="tk-modal-label">Ghế</span>
            <span className="tk-modal-value tk-modal-seats">
              {entry.seats?.join(", ") || "—"}
            </span>
          </div>
          <div>
            <span className="tk-modal-label">Thanh toán</span>
            <span className="tk-modal-value">
              {METHOD_LABEL[entry.paymentMethod] || "—"}
            </span>
          </div>
        </div>

        {fnb.length > 0 && (
          <div className="tk-modal-fnb">
            <span className="tk-modal-label">Bắp nước</span>
            <div className="tk-modal-fnb-list">
              {fnb.map((c) => (
                <div className="tk-modal-fnb-row" key={c.id}>
                  <span>
                    {c.name} ×{c.qty}
                  </span>
                  <span>{fmt(c.price * c.qty)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {entry.totalPrice != null && (
          <div className="tk-modal-total">
            <span>Tổng cộng</span>
            <span className="tk-modal-total-amount">
              {fmt(entry.totalPrice)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyTickets() {
  const [enriched, setEnriched] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const [viewing, setViewing] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getBookings().then(async (data) => {
      // Filter to only this user's bookings
      const mine = data.filter((b) => b.userId === user.id);
      const rich = await Promise.all(
        mine.map(async (b) => {
          const [movie, showtime, cinema, room] = await Promise.all([
            getMovie(b.movieId).catch(() => null),
            getShowtime(b.showtimeId).catch(() => null),
            b.cinemaId
              ? getCinema(b.cinemaId).catch(() => null)
              : Promise.resolve(null),
            b.roomId
              ? getRoom(b.roomId).catch(() => null)
              : Promise.resolve(null),
          ]);
          return { ...b, movie, showtime, cinema, room };
        }),
      );
      setEnriched(rich);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!viewing) return;
    const onKey = (e) => {
      if (e.key === "Escape") setViewing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing]);

  // Tab filter by showtime date
  const now = new Date();
  const filtered = enriched.filter((b) => {
    if (!b.showtime?.time) return tab === "upcoming";
    const d = new Date(b.showtime.time);
    return tab === "upcoming" ? d >= now : d < now;
  });

  return (
    <div className="page tickets-page">
      <Navbar />

      <div className="tickets-content">
        <div className="tickets-page-header">
          <div>
            <h1 className="tickets-title">Vé của tôi</h1>
            <p
              style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}
            >
              Xin chào,{" "}
              <strong style={{ color: "var(--text)" }}>{user?.fullName}</strong>
            </p>
          </div>
        </div>

        <div className="tickets-tabs">
          <button
            className={`tab-btn ${tab === "upcoming" ? "active" : ""}`}
            onClick={() => setTab("upcoming")}
          >
            Sắp tới
          </button>
          <button
            className={`tab-btn ${tab === "past" ? "active" : ""}`}
            onClick={() => setTab("past")}
          >
            Đã xem
          </button>
        </div>

        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "80px 0",
            }}
          >
            <div className="loading-spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="no-tickets">
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
            <h3
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 24,
                marginBottom: 8,
              }}
            >
              Chưa có vé nào
            </h3>
            <p style={{ color: "var(--text-muted)" }}>
              Đặt vé phim đầu tiên của bạn ngay!
            </p>
          </div>
        ) : (
          <div className="tickets-grid">
            {filtered.map((b) => (
              <TicketCard
                key={b.id}
                booking={b}
                movie={b.movie}
                showtime={b.showtime}
                cinema={b.cinema}
                room={b.room}
                onView={() => setViewing(b)}
              />
            ))}
          </div>
        )}

        {/* VISIT PERKS */}
        <div className="perks-section">
          <h2 className="perks-title">Sẵn sàng cho chuyến đi?</h2>
          <div className="perks-grid">
            {[
              {
                icon: "🍿",
                title: "Đặt trước đồ ăn",
                desc: "Bỏ qua hàng chờ, bắp rang bơ sẽ đợi bạn tại ghế.",
              },
              {
                icon: "🗺️",
                title: "Địa điểm & Đỗ xe",
                desc: "Lấy chỉ đường và đặt trước chỗ đỗ xe VIP.",
              },
              {
                icon: "👥",
                title: "Mời bạn bè",
                desc: "Chia sẻ thông tin đặt vé và cùng đi xem phim.",
              },
            ].map((p) => (
              <div key={p.title} className="perk-card">
                <div className="perk-icon">{p.icon}</div>
                <h4 className="perk-title">{p.title}</h4>
                <p className="perk-desc">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />

      {viewing && (
        <TicketModal entry={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
