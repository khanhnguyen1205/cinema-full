import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { genreLabel } from "i18n/genres";
import { formatClock, formatDayShort } from "i18n/format";
import { isUpcoming, nowKey } from "lib/time";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import MovieCard from "components/MovieCard";
import {
  Container,
  Section,
  Grid,
  KineticHeading,
  Button,
  Skeleton,
  formatIndex,
} from "components/ui";
import {
  useMovies,
  useCinemas,
  useCities,
  useRooms,
  useAllShowtimes,
} from "queries/catalog";
import "./Home.css";

const AUTOPLAY_MS = 6000;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const moviesQ = useMovies();
  const cinemasQ = useCinemas();
  const citiesQ = useCities();
  const roomsQ = useRooms();
  const showtimesQ = useAllShowtimes();

  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);

  const featured = useMemo(() => movies.slice(0, 5), [movies]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Tự xoay hero; tắt khi reduced-motion hoặc đang hover.
  useEffect(() => {
    if (paused || featured.length <= 1 || prefersReducedMotion()) return;
    const t = setInterval(
      () => setHeroIndex((i) => (i + 1) % featured.length),
      AUTOPLAY_MS,
    );
    return () => clearInterval(t);
  }, [paused, featured.length]);

  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );
  // Ô thể loại chỉ có nghĩa khi bấm vào còn có gì để chọn. Bày cả những thể
  // loại vỏn vẹn một phim thì lưới trông dày dặn nhưng dẫn người ta tới một
  // trang gần như trống — cấu trúc nói dối về độ dày của nội dung.
  const genreStats = useMemo(() => {
    const map = new Map<string, number>();
    movies.forEach((m) => map.set(m.genre, (map.get(m.genre) ?? 0) + 1));
    return [...map.entries()]
      .map(([genre, count]) => ({ genre, count }))
      .filter(({ count }) => count >= 2)
      .sort((a, b) => b.count - a.count);
  }, [movies]);

  // Dải suất chiếu: 12 suất chưa bắt đầu, sớm nhất trước. Cố ý KHÔNG cắt theo
  // ngày — mở trang lúc 21h30 thì hôm nay chỉ còn một suất, và một cái thẻ lẻ
  // loi giữa dải trống trông như hỏng. Suất nào không phải hôm nay thì tự đeo
  // nhãn ngày, nên dải vừa luôn đầy vừa không nói dối về thời điểm.
  const today = nowKey().slice(0, 10);
  const soon = useMemo(() => {
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const cinemaById = new Map(cinemas.map((c) => [c.id, c]));
    const movieById = new Map(movies.map((m) => [m.id, m]));
    return showtimes
      .filter((s) => isUpcoming(s.time))
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 12)
      .map((s) => {
        const room = roomById.get(s.roomId);
        return {
          id: s.id,
          time: s.time,
          movie: movieById.get(s.movieId)?.title ?? "—",
          cinema: room ? (cinemaById.get(room.cinemaId)?.name ?? "—") : "—",
          room: room?.name ?? "—",
        };
      });
  }, [showtimes, rooms, cinemas, movies]);

  const soonIsToday = soon[0]?.time.slice(0, 10) === today;

  // Đếm phim thật sự còn suất — con số này đứng ngay trên lưới poster nên nó
  // phải nói đúng về chính lưới đó.
  const bookableMovies = useMemo(
    () =>
      new Set(showtimes.filter((s) => isUpcoming(s.time)).map((s) => s.movieId))
        .size,
    [showtimes],
  );

  if (moviesQ.isError) {
    return (
      <div className="page home-page">
        <Navbar />
        <Container>
          <div className="home-error">
            <p>{t("common.loadError")}</p>
            <Button onClick={() => moviesQ.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        </Container>
        <Footer />
      </div>
    );
  }

  if (moviesQ.isLoading || !featured.length) {
    return (
      <div className="page home-page">
        <Navbar />
        <Container>
          <div className="home-hero-skeleton">
            <Skeleton height="360px" />
          </div>
          <Grid min="200px">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height="320px" />
            ))}
          </Grid>
        </Container>
        <Footer />
      </div>
    );
  }

  const active = featured[heroIndex];
  const prev = () =>
    setHeroIndex((i) => (i - 1 + featured.length) % featured.length);
  const next = () => setHeroIndex((i) => (i + 1) % featured.length);

  return (
    <div className="page home-page">
      <Navbar />

      {/* HERO — kinetic carousel */}
      <section
        className="hero-k"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="hero-k__poster"
          key={"bg" + active.id}
          style={
            active.poster
              ? {
                  backgroundImage: `linear-gradient(to left, rgba(10,10,10,0) 0%, rgba(10,10,10,0.65) 45%, rgba(10,10,10,1) 82%), url(${active.poster})`,
                }
              : undefined
          }
        />
        <div className="hero-k__scanline" aria-hidden="true" />
        <Container>
          <div className="hero-k__content" key={active.id}>
            <div className="hero-k__meta">
              <span className="hero-k__label">{t("home.featured")}</span>
              {active.rating != null && (
                <span className="hero-k__rating">
                  ★ {active.rating.toFixed(1)}
                </span>
              )}
              <span className="hero-k__genre">
                {genreLabel(active.genre)} · {active.duration}{" "}
                {t("common.minutes")}
              </span>
            </div>
            <h1 className="hero-k__title">
              <KineticHeading text={active.title} />
            </h1>
            <p className="hero-k__desc">{active.description}</p>
            <div className="hero-k__actions">
              <Button size="lg" onClick={() => navigate(`/movie/${active.id}`)}>
                ▶ {t("home.book")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate(`/movie/${active.id}`)}
              >
                {t("home.details")}
              </Button>
            </div>
            <div className="hero-k__tabs">
              {featured.map((m, i) => (
                <button
                  key={m.id}
                  className={
                    "hero-k__tab" + (i === heroIndex ? " is-active" : "")
                  }
                  aria-label={t("home.featuredN", { n: i + 1 })}
                  onClick={() => setHeroIndex(i)}
                >
                  {/* Một trong hai chỗ N° còn được giữ: đây là thứ tự thật,
                      chấm số 3 nằm giữa chấm 2 và 4. */}
                  {formatIndex(i + 1)}
                </button>
              ))}
            </div>
          </div>
        </Container>
        <button
          className="hero-k__arrow hero-k__arrow--prev"
          aria-label={t("home.prevMovie")}
          onClick={prev}
        >
          ‹
        </button>
        <button
          className="hero-k__arrow hero-k__arrow--next"
          aria-label={t("home.nextMovie")}
          onClick={next}
        >
          ›
        </button>
      </section>

      {/* Dải lịch chiếu — chỗ này trước là marquee chạy tên phim, tức là trang
          trí thuần: không bấm được, không mang tin. Giờ nó là tấm bảng lịch
          chiếu ở sảnh rạp, dữ liệu thật, bấm thẳng vào chọn ghế. Nó KHÔNG tự
          chạy: một dãy nút trôi ngang là mục tiêu di động, vừa khó bấm vừa
          không dùng được bằng bàn phím. */}
      {soon.length > 0 && (
        <section className="tonight-k" aria-labelledby="tonight-h">
          <Container>
            <div className="tonight-k__head">
              <h2 className="tonight-k__title" id="tonight-h">
                {soonIsToday ? t("home.soonToday") : t("home.soonNext")}
              </h2>
              <span className="tonight-k__day">
                {formatDayShort(soon[0].time)}
              </span>
            </div>
            <ul className="tonight-k__strip">
              {soon.map((s) => (
                <li key={s.id}>
                  <button
                    className="tonight-k__slot"
                    onClick={() => navigate(`/seats/${s.id}`)}
                    aria-label={t("home.soonSlotAria", {
                      time: formatClock(s.time),
                      day: formatDayShort(s.time),
                      movie: s.movie,
                      cinema: s.cinema,
                    })}
                  >
                    <span className="tonight-k__when" aria-hidden="true">
                      <span className="tonight-k__time">
                        {formatClock(s.time)}
                      </span>
                      {s.time.slice(0, 10) !== today && (
                        <span className="tonight-k__date">
                          {formatDayShort(s.time)}
                        </span>
                      )}
                    </span>
                    <span className="tonight-k__movie" aria-hidden="true">
                      {s.movie}
                    </span>
                    <span className="tonight-k__where" aria-hidden="true">
                      {s.cinema} · {s.room}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <Container>
        {/* Phim đang chiếu */}
        <Section label={t("home.labelBookable", { count: bookableMovies })}>
          <div className="home-head">
            <h2 className="home-head__title">{t("home.nowShowing")}</h2>
            <button
              className="home-head__all"
              onClick={() => navigate("/movies")}
            >
              {t("home.seeAll")}
            </button>
          </div>
          <Grid min="200px">
            {movies.slice(0, 8).map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </Grid>
        </Section>

        {/* Duyệt theo thể loại — không có nhãn mục: "Khám phá" đứng trên
            "Duyệt theo thể loại" là nói hai lần cùng một việc. */}
        {genreStats.length > 0 && (
          <Section>
            <h2 className="home-head__title">{t("home.browseByGenre")}</h2>
            <div className="genre-k-grid">
              {genreStats.map(({ genre, count }) => (
                <button
                  key={genre}
                  className="genre-k"
                  onClick={() => navigate("/movies", { state: { genre } })}
                >
                  <span className="genre-k__name">{genreLabel(genre)}</span>
                  <span className="genre-k__count">
                    {t("home.movieCount", { count })}
                  </span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Dải "16 · 5 · 3 · 52" từng đứng ở đây đã bỏ hẳn: không ai đi xem
            phim vì hệ thống có 3 thành phố, và số đếm to đùng chỉ là số đếm.
            Phần thông tin còn dùng được của nó nằm lại ở nhãn mục bên dưới. */}

        {/* Hệ thống rạp */}
        <Section
          label={t("home.labelNetwork", {
            cinemas: cinemas.length,
            cities: cities.length,
          })}
        >
          <div className="home-head">
            <h2 className="home-head__title">{t("home.cinemaSystem")}</h2>
            <button
              className="home-head__all"
              onClick={() => navigate("/cinemas")}
            >
              {t("home.allCinemas")}
            </button>
          </div>
          <div className="cinema-k-grid">
            {cinemas.map((c) => (
              <button
                key={c.id}
                className="cinema-k"
                onClick={() => navigate(`/cinema/${c.id}`)}
              >
                <span className="cinema-k__body">
                  <span className="cinema-k__name">{c.name}</span>
                  <span className="cinema-k__city">
                    {cityName[c.cityId] ?? "—"}
                  </span>
                </span>
                <span className="cinema-k__arrow">→</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Khối "Sẵn sàng cho suất chiếu tiếp theo? → Đặt vé ngay" đã bỏ. Bên
            trên đã có dải suất chiếu bấm thẳng vào chọn ghế và tám tấm poster
            cũng bấm được; nhắc lại "đặt vé" lần thứ ba không thêm đường nào
            mới, chỉ thêm một khối để cuộn qua. */}
      </Container>

      <Footer />
    </div>
  );
}
