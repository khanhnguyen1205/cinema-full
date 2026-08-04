import { useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatShowtimeLabel } from "i18n/format";
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
import { isUpcoming, nowKey } from "lib/time";
import type { Movie, Cinema, Showtime } from "types";
import "./Search.css";

interface ShowResult {
  showtime: Showtime;
  movie?: Movie;
  cinema?: Cinema;
  roomType?: string;
}

export default function Search() {
  const { t } = useTranslation();
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
    const now = nowKey();
    return showtimes
      .filter((s) => isUpcoming(s.time, now))
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
          <span className="search-k__label">{t("search.eyebrow")}</span>
          <h1 className="search-k__title">
            <KineticHeading text={q.trim() ? q.trim() : t("search.title")} />
          </h1>
          <form
            className="search-k__box"
            onSubmit={(e) => e.preventDefault()}
            role="search"
          >
            <input
              type="text"
              aria-label={t("search.placeholder")}
              placeholder={t("search.placeholder")}
              value={q}
              onChange={(e) =>
                setParams({ q: e.target.value }, { replace: true })
              }
              autoFocus
            />
          </form>
          {qn && !isLoading && (
            <span className="search-k__count">
              {t("search.resultCount", { count: total })}
            </span>
          )}
        </header>

        {isError ? (
          <div className="search-k__empty">
            <p>{t("common.loadError")}</p>
            <Button onClick={() => moviesQ.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : !qn ? (
          <div className="search-k__hint">
            <p>{t("search.hint")}</p>
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
              {t("search.emptyTitle", { q: q.trim() })}
            </p>
            <p className="search-k__empty-sub">{t("search.emptySub")}</p>
          </div>
        ) : (
          <>
            {movieHits.length > 0 && (
              <Section>
                <div className="search-k__sechd">
                  <h2 className="search-k__sectitle">
                    {t("search.sectionMovies")}
                  </h2>
                  <span className="search-k__seccount">{movieHits.length}</span>
                  <Link
                    to={`/movies?q=${encodeURIComponent(q)}`}
                    className="search-k__more"
                  >
                    {t("search.filterOnMovies")}
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
                  <h2 className="search-k__sectitle">
                    {t("search.sectionCinemas")}
                  </h2>
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
                      <span className="venue-k__link">
                        {t("search.viewSchedule")}
                      </span>
                    </button>
                  ))}
                </Grid>
              </Section>
            )}

            {showHits.length > 0 && (
              <Section>
                <div className="search-k__sechd">
                  <h2 className="search-k__sectitle">
                    {t("search.sectionShowtimes")}
                  </h2>
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
                          {r.movie?.title ?? t("search.sectionMovies")}
                        </span>
                        <span className="search-k__showmeta">
                          {formatShowtimeLabel(r.showtime.time)} ·{" "}
                          {r.cinema?.name ?? ""}
                          {r.roomType ? ` · ${r.roomType}` : ""}
                        </span>
                        <span className="search-k__showgo">
                          {t("search.selectSeats")}
                        </span>
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
