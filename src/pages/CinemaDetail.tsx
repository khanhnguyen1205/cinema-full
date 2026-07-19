import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import { Container, KineticHeading, Reveal, Spinner } from "components/ui";
import {
  useCinema,
  useShowtimesByCinema,
  useMovies,
  useRooms,
  useCities,
} from "queries/catalog";
import "./CinemaDetail.css";

export default function CinemaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cinemaId = id!;

  const cinemaQ = useCinema(cinemaId);
  const showtimesQ = useShowtimesByCinema(cinemaId);
  const moviesQ = useMovies();
  const roomsQ = useRooms();
  const citiesQ = useCities();

  const cinema = cinemaQ.data;
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);

  const roomMap = useMemo(
    () => Object.fromEntries(rooms.map((r) => [r.id, r])),
    [rooms],
  );
  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtDate = (k: string) =>
    new Date(k).toLocaleDateString("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

  const byMovie = useMemo(
    () =>
      movies
        .map((m) => ({
          movie: m,
          sts: showtimes.filter((s) => s.movieId === m.id),
        }))
        .filter((x) => x.sts.length > 0),
    [movies, showtimes],
  );

  const roomsCount = useMemo(
    () => rooms.filter((r) => r.cinemaId === Number(cinemaId)).length,
    [rooms, cinemaId],
  );

  if (cinemaQ.isLoading || !cinema) {
    return (
      <div className="page cinema-detail-page cinema-detail-page--center">
        <Navbar back="/cinemas" />
        <Spinner />
        <Footer />
      </div>
    );
  }

  return (
    <div className="page cinema-detail-page">
      <Navbar back="/cinemas" />

      <section className="venue-hero">
        <Container>
          <span className="venue-hero__label">Lịch chiếu tại rạp</span>
          <h1 className="venue-hero__title">
            <KineticHeading text={cinema.name} />
          </h1>
          <p className="venue-hero__addr">
            <span className="venue-hero__city">
              {cityName[cinema.cityId] ?? "—"}
            </span>
            {cinema.address ? ` · ${cinema.address}` : ""}
          </p>
          <div className="venue-hero__stats">
            <div className="stat-k">
              <span className="stat-k__num">{roomsCount}</span>
              <span className="stat-k__label">Phòng</span>
            </div>
            <div className="stat-k">
              <span className="stat-k__num">{byMovie.length}</span>
              <span className="stat-k__label">Phim</span>
            </div>
            <div className="stat-k">
              <span className="stat-k__num">{showtimes.length}</span>
              <span className="stat-k__label">Suất</span>
            </div>
          </div>
        </Container>
      </section>

      <Container>
        {byMovie.length === 0 ? (
          <div className="cinema-detail-empty">Rạp này chưa có suất chiếu</div>
        ) : (
          byMovie.map(({ movie, sts }) => {
            const dates = [
              ...new Set(sts.map((s) => s.time.slice(0, 10))),
            ].sort();
            return (
              <Reveal key={movie.id}>
                <div className="sched-k">
                  <button
                    type="button"
                    className="sched-k__poster"
                    onClick={() => navigate(`/movie/${movie.id}`)}
                    aria-label={`Chi tiết ${movie.title}`}
                  >
                    {movie.poster ? (
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        loading="lazy"
                      />
                    ) : (
                      <span className="sched-k__initial">{movie.title[0]}</span>
                    )}
                  </button>
                  <div className="sched-k__body">
                    <button
                      type="button"
                      className="sched-k__title"
                      onClick={() => navigate(`/movie/${movie.id}`)}
                    >
                      {movie.title}
                    </button>
                    <span className="sched-k__meta">
                      {movie.genre} · {movie.duration} phút
                    </span>
                    {dates.map((d) => (
                      <div key={d} className="sched-k__date-row">
                        <span className="sched-k__date">{fmtDate(d)}</span>
                        <div className="sched-k__times">
                          {sts
                            .filter((s) => s.time.slice(0, 10) === d)
                            .sort((a, b) => a.time.localeCompare(b.time))
                            .map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                className="time-k-btn"
                                onClick={() => navigate(`/seats/${s.id}`)}
                              >
                                <span className="time-k-btn__t">
                                  {fmtTime(s.time)}
                                </span>
                                <span className="time-k-btn__meta">
                                  {roomMap[s.roomId]?.type} ·{" "}
                                  {s.price.toLocaleString("vi-VN")}₫
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            );
          })
        )}
      </Container>

      <Footer />
    </div>
  );
}
