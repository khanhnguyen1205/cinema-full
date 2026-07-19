import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import MovieCard from "components/MovieCard";
import {
  Container,
  Section,
  Grid,
  Marquee,
  KineticHeading,
  Button,
  Skeleton,
} from "components/ui";
import {
  useMovies,
  useCinemas,
  useCities,
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
  const moviesQ = useMovies();
  const cinemasQ = useCinemas();
  const citiesQ = useCities();
  const showtimesQ = useAllShowtimes();

  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const cinemas = cinemasQ.data ?? [];
  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);
  const showtimeCount = showtimesQ.data?.length ?? 0;

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
  const genreStats = useMemo(() => {
    const map = new Map<string, number>();
    movies.forEach((m) => map.set(m.genre, (map.get(m.genre) ?? 0) + 1));
    return [...map.entries()].map(([genre, count]) => ({ genre, count }));
  }, [movies]);

  if (moviesQ.isError) {
    return (
      <div className="page home-page">
        <Navbar />
        <Container>
          <div className="home-error">
            <p>Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.</p>
            <Button onClick={() => moviesQ.refetch()}>Thử lại</Button>
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
              <span className="hero-k__label">Phim nổi bật</span>
              {active.rating != null && (
                <span className="hero-k__rating">
                  ★ {active.rating.toFixed(1)}
                </span>
              )}
              <span className="hero-k__genre">
                {active.genre} · {active.duration} PHÚT
              </span>
            </div>
            <h1 className="hero-k__title">
              <KineticHeading text={active.title} />
            </h1>
            <p className="hero-k__desc">{active.description}</p>
            <div className="hero-k__actions">
              <Button size="lg" onClick={() => navigate(`/movie/${active.id}`)}>
                ▶ Đặt vé
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate(`/movie/${active.id}`)}
              >
                Chi tiết
              </Button>
            </div>
            <div className="hero-k__tabs">
              {featured.map((m, i) => (
                <button
                  key={m.id}
                  className={
                    "hero-k__tab" + (i === heroIndex ? " is-active" : "")
                  }
                  aria-label={`Phim nổi bật ${i + 1}`}
                  onClick={() => setHeroIndex(i)}
                >
                  N°{String(i + 1).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </Container>
        <button
          className="hero-k__arrow hero-k__arrow--prev"
          aria-label="Phim trước"
          onClick={prev}
        >
          ‹
        </button>
        <button
          className="hero-k__arrow hero-k__arrow--next"
          aria-label="Phim sau"
          onClick={next}
        >
          ›
        </button>
      </section>

      {/* Marquee ticker */}
      <div className="home-ticker">
        <Marquee speed={26}>
          <span className="home-ticker__inner">
            {movies.map((m) => (
              <span key={m.id}>{m.title} ·&nbsp;</span>
            ))}
          </span>
        </Marquee>
      </div>

      <Container>
        {/* Phim đang chiếu */}
        <Section label="Suất chiếu hôm nay" index={1}>
          <div className="home-head">
            <h2 className="home-head__title">Phim đang chiếu</h2>
            <button
              className="home-head__all"
              onClick={() => navigate("/movies")}
            >
              Xem tất cả →
            </button>
          </div>
          <Grid min="200px">
            {movies.slice(0, 8).map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </Grid>
        </Section>

        {/* Duyệt theo thể loại */}
        <Section label="Khám phá" index={2}>
          <h2 className="home-head__title">Duyệt theo thể loại</h2>
          <div className="genre-k-grid">
            {genreStats.map(({ genre, count }) => (
              <button
                key={genre}
                className="genre-k"
                onClick={() => navigate("/movies", { state: { genre } })}
              >
                <span className="genre-k__name">{genre}</span>
                <span className="genre-k__count">{count} phim</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Thống kê */}
        <div className="stats-k">
          {[
            { n: movies.length, l: "Phim" },
            { n: cinemas.length, l: "Rạp chiếu" },
            { n: cities.length, l: "Thành phố" },
            { n: showtimeCount, l: "Suất chiếu" },
          ].map((s) => (
            <div className="stats-k__item" key={s.l}>
              <span className="stats-k__num">{s.n}</span>
              <span className="stats-k__label">{s.l}</span>
            </div>
          ))}
        </div>

        {/* Hệ thống rạp */}
        <Section label="Toàn quốc" index={3}>
          <div className="home-head">
            <h2 className="home-head__title">Hệ thống rạp</h2>
            <button
              className="home-head__all"
              onClick={() => navigate("/cinemas")}
            >
              Tất cả rạp →
            </button>
          </div>
          <div className="cinema-k-grid">
            {cinemas.map((c, i) => (
              <button
                key={c.id}
                className="cinema-k"
                onClick={() => navigate(`/cinema/${c.id}`)}
              >
                <span className="cinema-k__no">
                  N°{String(i + 1).padStart(2, "0")}
                </span>
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

        {/* CTA bone */}
        <div className="cta-k u-invert">
          <div>
            <h2 className="cta-k__title">Sẵn sàng cho suất chiếu tiếp theo?</h2>
            <p className="cta-k__sub">
              Chọn phim, chọn ghế và đặt vé chỉ trong vài bước.
            </p>
          </div>
          <Button size="lg" onClick={() => navigate("/movies")}>
            Đặt vé ngay
          </Button>
        </div>
      </Container>

      <Footer />
    </div>
  );
}
