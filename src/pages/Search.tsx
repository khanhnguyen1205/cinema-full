import { useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import MovieCard from "components/MovieCard";
import {
  Container,
  Section,
  Grid,
  KineticHeading,
  Tag,
  Skeleton,
  Button,
} from "components/ui";
import {
  useMovies,
  useCinemas,
  useAllShowtimes,
  useRooms,
  useCities,
} from "queries/catalog";
import { normalize, matches, scoreMatch } from "lib/search";
import type { Movie, Cinema, Showtime } from "types";
import "./Search.css";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

interface ShowResult {
  showtime: Showtime;
  movie?: Movie;
  cinema?: Cinema;
  roomType?: string;
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") ?? "";
  const qn = normalize(q);

  const moviesQ = useMovies();
  const cinemasQ = useCinemas();
  const showtimesQ = useAllShowtimes();
  const roomsQ = useRooms();
  const citiesQ = useCities();

  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);

  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );
  const roomById = useMemo(
    () => Object.fromEntries(rooms.map((r) => [r.id, r])),
    [rooms],
  );
  const cinemaById = useMemo(
    () => Object.fromEntries(cinemas.map((c) => [c.id, c])),
    [cinemas],
  );
  const movieById = useMemo(
    () => Object.fromEntries(movies.map((m) => [m.id, m])),
    [movies],
  );

  const movieHits = useMemo(() => {
    if (!qn) return [];
    return movies
      .filter((m) => matches(m.title, qn))
      .sort((a, b) => scoreMatch(b.title, qn) - scoreMatch(a.title, qn));
  }, [movies, qn]);

  const cinemaHits = useMemo(() => {
    if (!qn) return [];
    return cinemas
      .filter((c) => matches(c.name, qn) || matches(c.address ?? "", qn))
      .sort((a, b) => scoreMatch(b.name, qn) - scoreMatch(a.name, qn));
  }, [cinemas, qn]);

  const showHits = useMemo<ShowResult[]>(() => {
    if (!qn) return [];
    const now = new Date().toISOString();
    return showtimes
      .filter((s) => s.time >= now)
      .map((s) => {
        const room = roomById[s.roomId];
        const cinema = room ? cinemaById[room.cinemaId] : undefined;
        const movie = movieById[s.movieId];
        return { showtime: s, movie, cinema, roomType: room?.type };
      })
      .filter(
        (r) =>
          (r.movie && matches(r.movie.title, qn)) ||
          (r.cinema && matches(r.cinema.name, qn)),
      )
      .sort((a, b) => a.showtime.time.localeCompare(b.showtime.time));
  }, [showtimes, roomById, cinemaById, movieById, qn]);

  const total = movieHits.length + cinemaHits.length + showHits.length;
  const isLoading =
    moviesQ.isLoading || cinemasQ.isLoading || showtimesQ.isLoading;
  const isError = moviesQ.isError || cinemasQ.isError;

  return (
    <div className="page search-page">
      <Navbar />
      <Container>
        <header className="search-k__header">
          <span className="search-k__label">Tìm kiếm</span>
          <h1 className="search-k__title">
            <KineticHeading text={q.trim() ? q.trim() : "Tìm kiếm"} />
          </h1>
          <form
            className="search-k__box"
            onSubmit={(e) => e.preventDefault()}
            role="search"
          >
            <input
              type="text"
              aria-label="Tìm phim, rạp, suất chiếu"
              placeholder="Tìm phim, rạp, suất chiếu..."
              value={q}
              onChange={(e) =>
                setParams({ q: e.target.value }, { replace: true })
              }
              autoFocus
            />
          </form>
          {qn && !isLoading && (
            <span className="search-k__count">
              <b>{total}</b> kết quả
            </span>
          )}
        </header>

        {isError ? (
          <div className="search-k__empty">
            <p>Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.</p>
            <Button onClick={() => moviesQ.refetch()}>Thử lại</Button>
          </div>
        ) : !qn ? (
          <div className="search-k__hint">
            <p>Nhập từ khoá để tìm phim, rạp, suất chiếu.</p>
          </div>
        ) : isLoading ? (
          <Grid min="200px">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="320px" />
            ))}
          </Grid>
        ) : total === 0 ? (
          <div className="search-k__empty">
            <p className="search-k__empty-title">
              Không tìm thấy kết quả cho “{q.trim()}”
            </p>
            <p className="search-k__empty-sub">Thử từ khoá ngắn hơn.</p>
          </div>
        ) : (
          <>
            {movieHits.length > 0 && (
              <Section>
                <div className="search-k__sechd">
                  <KineticHeading text="Phim" />
                  <span className="search-k__seccount">{movieHits.length}</span>
                  <Link
                    to={`/movies?q=${encodeURIComponent(q)}`}
                    className="search-k__more"
                  >
                    Lọc chi tiết trên trang Phim →
                  </Link>
                </div>
                <Grid min="200px">
                  {movieHits.map((m) => (
                    <MovieCard key={m.id} movie={m} />
                  ))}
                </Grid>
              </Section>
            )}

            {cinemaHits.length > 0 && (
              <Section>
                <div className="search-k__sechd">
                  <KineticHeading text="Rạp" />
                  <span className="search-k__seccount">
                    {cinemaHits.length}
                  </span>
                </div>
                <Grid min="280px">
                  {cinemaHits.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="venue-k"
                      onClick={() => navigate(`/cinema/${c.id}`)}
                    >
                      <Tag className="venue-k__city">
                        {cityName[c.cityId] ?? "—"}
                      </Tag>
                      <span className="venue-k__name">{c.name}</span>
                      {c.address && (
                        <span className="venue-k__addr">{c.address}</span>
                      )}
                      <span className="venue-k__link">Xem lịch chiếu →</span>
                    </button>
                  ))}
                </Grid>
              </Section>
            )}

            {showHits.length > 0 && (
              <Section>
                <div className="search-k__sechd">
                  <KineticHeading text="Suất chiếu" />
                  <span className="search-k__seccount">{showHits.length}</span>
                </div>
                <ul className="search-k__shows">
                  {showHits.map((r) => (
                    <li key={r.showtime.id}>
                      <button
                        type="button"
                        className="search-k__show"
                        onClick={() => navigate(`/seats/${r.showtime.id}`)}
                      >
                        <span className="search-k__showtitle">
                          {r.movie?.title ?? "Phim"}
                        </span>
                        <span className="search-k__showmeta">
                          {fmtTime(r.showtime.time)} · {r.cinema?.name ?? ""}
                          {r.roomType ? ` · ${r.roomType}` : ""}
                        </span>
                        <span className="search-k__showgo">Chọn ghế →</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </Container>
      <Footer />
    </div>
  );
}
