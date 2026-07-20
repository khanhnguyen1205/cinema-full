import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMovie, getShowtime, getCinema, getRoom } from "services/api";
import { useMyBookings } from "queries/booking";
import ETicket from "components/ETicket";
import { useAuth } from "context/AuthContext";
import { Skeleton } from "components/ui";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import type { Booking, Movie, Showtime, Cinema, Room } from "types";
import "./MyTickets.css";

interface Enriched extends Booking {
  movie: Movie | null;
  showtime: Showtime | null;
  cinema: Cinema | null;
  room: Room | null;
}

export default function MyTickets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const bookingsQ = useMyBookings();
  const bookings = bookingsQ.data ?? [];

  // Enrich một lần sau khi có danh sách vé (key theo các id vé).
  const ids = bookings.map((b) => b.id).join(",");
  const enrichedQ = useQuery({
    queryKey: ["myBookings", "enriched", ids],
    enabled: bookings.length > 0,
    queryFn: async (): Promise<Enriched[]> =>
      Promise.all(
        bookings.map(async (b) => {
          const [movie, showtime, cinema, room] = await Promise.all([
            getMovie(b.movieId).catch(() => null),
            getShowtime(b.showtimeId).catch(() => null),
            b.cinemaId ? getCinema(b.cinemaId).catch(() => null) : null,
            b.roomId ? getRoom(b.roomId).catch(() => null) : null,
          ]);
          return { ...b, movie, showtime, cinema, room };
        }),
      ),
  });

  const loading =
    bookingsQ.isLoading || (bookings.length > 0 && enrichedQ.isLoading);
  const enriched = enrichedQ.data ?? [];

  const now = new Date();
  const filtered = enriched.filter((b) => {
    if (!b.showtime?.time) return tab === "upcoming";
    const d = new Date(b.showtime.time);
    return tab === "upcoming" ? d >= now : d < now;
  });

  return (
    <div className="page mytk-k">
      <Navbar />
      <div className="mytk-k__content">
        <header className="mytk-k__header">
          <span className="mytk-k__label">Tài khoản</span>
          <h1 className="mytk-k__title">Vé của tôi</h1>
          {user && (
            <p className="mytk-k__hello">
              Xin chào, <strong>{user.fullName}</strong>
            </p>
          )}
        </header>

        <div className="mytk-k__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "upcoming"}
            className={"mytk-k__tab" + (tab === "upcoming" ? " is-active" : "")}
            onClick={() => setTab("upcoming")}
          >
            Sắp tới
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "past"}
            className={"mytk-k__tab" + (tab === "past" ? " is-active" : "")}
            onClick={() => setTab("past")}
          >
            Đã xem
          </button>
        </div>

        {bookingsQ.isError ? (
          <div className="mytk-k__empty">
            <p>Không tải được vé. Thử lại nhé.</p>
            <button
              type="button"
              className="mytk-k__cta"
              onClick={() => bookingsQ.refetch()}
            >
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="mytk-k__list">
            <Skeleton height="200px" />
            <Skeleton height="200px" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mytk-k__empty">
            <p className="mytk-k__empty-title">
              {tab === "upcoming" ? "Chưa có vé sắp tới" : "Chưa có vé đã xem"}
            </p>
            <button
              type="button"
              className="mytk-k__cta"
              onClick={() => navigate("/movies")}
            >
              Đặt vé ngay
            </button>
          </div>
        ) : (
          <div className="mytk-k__list">
            {filtered.map((b) => (
              <div
                key={b.id}
                className={"mytk-k__item" + (tab === "past" ? " is-past" : "")}
              >
                <ETicket
                  booking={b}
                  movie={b.movie}
                  cinema={b.cinema}
                  room={b.room}
                  showtime={b.showtime}
                  size="compact"
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
