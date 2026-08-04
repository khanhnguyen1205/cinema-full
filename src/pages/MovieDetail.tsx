import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { genreLabel } from "i18n/genres";
import {
  formatDate,
  formatPrice,
  formatDayShort,
  formatClock,
} from "i18n/format";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import MovieCard from "components/MovieCard";
import {
  Container,
  Section,
  KineticHeading,
  TicketEdge,
  Field,
  Reveal,
  Spinner,
  Skeleton,
  Button,
  StarRating,
} from "components/ui";
import {
  useMovie,
  useShowtimesByMovie,
  useRooms,
  useCinemas,
  useCities,
  useMovies,
} from "queries/catalog";
import {
  useMovieReviews,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
} from "queries/reviews";
import { reviewStats, type RatingKey } from "lib/reviewStats";
import { isUpcoming, nowKey } from "lib/time";
import { useAuth } from "context/AuthContext";
import "./MovieDetail.css";

// Phễu chọn suất là thành phố -> rạp -> ngày. Hai hàm dưới là ĐỊNH NGHĨA DUY NHẤT
// của mỗi bậc: vừa đổ dữ liệu cho dropdown, vừa cho biết mục nào được chọn sẵn —
// nên danh sách hiển thị và giá trị mặc định không thể lệch nhau.
type Slot = {
  cityId: number | undefined;
  cinema: { id: number } | undefined;
  dateKey: string;
};

function cinemaIdsIn(slots: Slot[], cityId: number | null): number[] {
  const ids = slots.filter((s) => s.cityId === cityId).map((s) => s.cinema?.id);
  return [...new Set(ids)].filter(Boolean) as number[];
}

function dateKeysIn(
  slots: Slot[],
  cityId: number | null,
  cinemaId: number | null,
): string[] {
  const keys = slots
    .filter((s) => s.cityId === cityId && s.cinema?.id === cinemaId)
    .map((s) => s.dateKey);
  return [...new Set(keys)].sort();
}

export default function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const movieId = id!;

  const movieQ = useMovie(movieId);
  const showtimesQ = useShowtimesByMovie(movieId);
  const roomsQ = useRooms();
  const cinemasQ = useCinemas();
  const citiesQ = useCities();
  const allMoviesQ = useMovies();

  const movie = movieQ.data;
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);
  const allMovies = useMemo(() => allMoviesQ.data ?? [], [allMoviesQ.data]);

  const cityMap = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c])),
    [cities],
  );

  // enriched: showtime + room + cinema + cityId + dateKey
  // Chỉ suất CHƯA chiếu: phễu thành phố → rạp → ngày → giờ là để đặt vé, mà rạp
  // không bán vé cho suất đã bắt đầu.
  const enriched = useMemo(() => {
    const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
    const cinemaMap = Object.fromEntries(cinemas.map((c) => [c.id, c]));
    const now = nowKey();
    return showtimes
      .filter((s) => isUpcoming(s.time, now))
      .map((s) => {
        const room = roomMap[s.roomId];
        const cinema = room ? cinemaMap[room.cinemaId] : undefined;
        return {
          ...s,
          room,
          cinema,
          cityId: cinema?.cityId,
          dateKey: s.time.slice(0, 10),
        };
      });
  }, [showtimes, rooms, cinemas]);

  const [cityId, setCityId] = useState<number | null>(null);
  const [cinemaId, setCinemaId] = useState<number | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [selectedShowtime, setSelectedShowtime] = useState<number | null>(null);

  // Nội dung từng bậc theo lựa chọn hiện tại.
  const cityIds = useMemo(
    () =>
      [...new Set(enriched.map((e) => e.cityId))].filter(Boolean) as number[],
    [enriched],
  );
  const cinemaIds = useMemo(
    () => cinemaIdsIn(enriched, cityId),
    [enriched, cityId],
  );
  const dateKeys = useMemo(
    () => dateKeysIn(enriched, cityId, cinemaId),
    [enriched, cityId, cinemaId],
  );
  const times = useMemo(
    () =>
      enriched
        .filter(
          (e) =>
            e.cityId === cityId &&
            e.cinema?.id === cinemaId &&
            e.dateKey === dateKey,
        )
        .sort((a, b) => a.time.localeCompare(b.time)),
    [enriched, cityId, cinemaId, dateKey],
  );

  // Bậc kế tiếp của MỘT lựa chọn bất kỳ — dùng khi đổi thành phố/rạp và lúc khởi tạo.
  const firstCinemaOf = (c: number) => cinemaIdsIn(enriched, c)[0];
  const firstDateOf = (c: number, cin: number) =>
    dateKeysIn(enriched, c, cin)[0];
  const cinemaName = (cid: number) =>
    enriched.find((e) => e.cinema?.id === cid)?.cinema?.name || "";

  // Khởi tạo default khi enriched sẵn sàng và chưa chọn gì
  useEffect(() => {
    if (!enriched.length || cityId !== null) return;
    const c0 = cityIds[0];
    if (c0 === undefined) return;
    const cin0 = firstCinemaOf(c0);
    const d0 = cin0 !== undefined ? firstDateOf(c0, cin0) : undefined;
    setCityId(c0);
    setCinemaId(cin0 ?? null);
    setDateKey(d0 ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched]);

  // Rạp có suất cho phim
  const cinemasShowing = useMemo(() => {
    const seen = new Map<number, { id: number; name: string; city?: string }>();
    enriched.forEach((e) => {
      if (e.cinema && !seen.has(e.cinema.id))
        seen.set(e.cinema.id, {
          id: e.cinema.id,
          name: e.cinema.name,
          city: cityMap[e.cinema.cityId]?.name,
        });
    });
    return [...seen.values()];
  }, [enriched, cityMap]);

  // Định dạng phòng có suất (2D/3D/IMAX) — khu thông số
  const formats = useMemo(
    () =>
      [
        ...new Set(enriched.map((e) => e.room?.type).filter(Boolean)),
      ] as string[],
    [enriched],
  );

  // Phim cùng thể loại
  const related = useMemo(
    () =>
      movie
        ? allMovies
            .filter((m) => m.genre === movie.genre && m.id !== movie.id)
            .slice(0, 8)
        : [],
    [allMovies, movie],
  );

  if (movieQ.isLoading || !movie) {
    return (
      <div className="page detail-page detail-page--center">
        <Navbar back="/" />
        <Spinner />
        <Footer />
      </div>
    );
  }

  return (
    <div className="page detail-page">
      <Navbar back="/" />

      {/* HERO chia đôi */}
      <section className="detail-k__hero">
        {/* Cùng lý do như hero trang chủ: poster dọc 2:3 bị `cover` cắt mất
            phần lớn. Nền thành lớp mờ làm không khí, poster thật hiện đủ trong
            khung riêng. */}
        <div
          className="detail-k__poster"
          style={
            movie.poster
              ? { backgroundImage: `url(${movie.poster})` }
              : undefined
          }
          aria-hidden="true"
        />
        <div className="detail-k__scrim" aria-hidden="true" />
        <div className="detail-k__scanline" aria-hidden="true" />
        <Container>
          <div className="detail-k__grid">
            {movie.poster && (
              <div className="detail-k__art">
                <img
                  src={movie.poster}
                  alt=""
                  className="detail-k__artimg"
                  loading="eager"
                />
              </div>
            )}
            <div className="detail-k__info">
              <div className="detail-k__meta">
                <span className="detail-k__tag">
                  {t("movieDetail.nowShowingTag")}
                </span>
                {movie.rating != null && (
                  <span className="detail-k__rating">
                    ★ {movie.rating.toFixed(1)}
                  </span>
                )}
                <span className="detail-k__genre">
                  {genreLabel(movie.genre)} · {movie.duration}{" "}
                  {t("common.minutes")}
                </span>
              </div>
              <h1 className="detail-k__title">
                <KineticHeading text={movie.title} />
              </h1>
              {movie.description && (
                <p className="detail-k__desc">{movie.description}</p>
              )}
            </div>

            {/* PANEL ĐẶT VÉ — bone, sticky */}
            <aside className="detail-k__book">
              <TicketEdge className="book-k">
                <div className="book-k__head">{t("movieDetail.book")}</div>
                {enriched.length === 0 ? (
                  <p className="book-k__empty">
                    {t("movieDetail.noShowtimes")}
                  </p>
                ) : (
                  <>
                    <div className="book-k__selects">
                      <Field label={t("movieDetail.city")} htmlFor="sel-city">
                        <select
                          id="sel-city"
                          value={cityId ?? ""}
                          onChange={(e) => {
                            const c = Number(e.target.value);
                            const cin = firstCinemaOf(c);
                            const d =
                              cin !== undefined
                                ? firstDateOf(c, cin)
                                : undefined;
                            setCityId(c);
                            setCinemaId(cin ?? null);
                            setDateKey(d ?? null);
                            setSelectedShowtime(null);
                          }}
                          aria-label={t("movieDetail.chooseCity")}
                        >
                          {cityIds.map((cid) => (
                            <option key={cid} value={cid}>
                              {cityMap[cid]?.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label={t("movieDetail.cinema")}
                        htmlFor="sel-cinema"
                      >
                        <select
                          id="sel-cinema"
                          value={cinemaId ?? ""}
                          onChange={(e) => {
                            const cin = Number(e.target.value);
                            const d =
                              cityId !== null
                                ? firstDateOf(cityId, cin)
                                : undefined;
                            setCinemaId(cin);
                            setDateKey(d ?? null);
                            setSelectedShowtime(null);
                          }}
                          aria-label={t("movieDetail.chooseCinema")}
                        >
                          {cinemaIds.map((cid) => (
                            <option key={cid} value={cid}>
                              {cinemaName(cid)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="book-k__dates">
                      {dateKeys.map((dk) => (
                        <button
                          key={dk}
                          type="button"
                          className={
                            "date-k-btn" + (dateKey === dk ? " is-active" : "")
                          }
                          onClick={() => {
                            setDateKey(dk);
                            setSelectedShowtime(null);
                          }}
                        >
                          {formatDayShort(dk)}
                        </button>
                      ))}
                    </div>

                    <div className="book-k__times-label">
                      {t("movieDetail.showtimeLabel")}
                    </div>
                    <div className="book-k__times">
                      {times.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          className={
                            "time-k-btn" +
                            (selectedShowtime === e.id ? " is-active" : "")
                          }
                          onClick={() => setSelectedShowtime(e.id)}
                        >
                          <span className="time-k-btn__t">
                            {formatClock(e.time)}
                          </span>
                          <span className="time-k-btn__meta">
                            {e.room?.type} · {formatPrice(e.price)}
                          </span>
                        </button>
                      ))}
                    </div>

                    <Button
                      className="book-k__cta"
                      disabled={!selectedShowtime}
                      onClick={() =>
                        selectedShowtime &&
                        navigate(`/seats/${selectedShowtime}`)
                      }
                    >
                      {t("movieDetail.book")}
                    </Button>
                  </>
                )}
              </TicketEdge>
            </aside>
          </div>
        </Container>
      </section>

      {/* CHI TIẾT */}
      <Container>
        {/* Tóm tắt + thông số */}
        <Reveal>
          <Section label={t("movieDetail.secSummary")}>
            <div className="detail-k__about">
              <p className="detail-k__synopsis">
                {movie.description || t("movieDetail.noDesc")}
              </p>
              <div className="spec-k">
                {movie.rating != null && (
                  <div className="spec-k__item">
                    <span className="spec-k__num">
                      {movie.rating.toFixed(1)}
                    </span>
                    <span className="spec-k__label">
                      {t("movieDetail.specRating")}
                    </span>
                  </div>
                )}
                <div className="spec-k__item">
                  <span className="spec-k__val">{genreLabel(movie.genre)}</span>
                  <span className="spec-k__label">
                    {t("movieDetail.specGenre")}
                  </span>
                </div>
                <div className="spec-k__item">
                  <span className="spec-k__val">{movie.duration}′</span>
                  <span className="spec-k__label">
                    {t("movieDetail.specDuration")}
                  </span>
                </div>
                {formats.length > 0 && (
                  <div className="spec-k__item">
                    <span className="spec-k__val">{formats.join(" · ")}</span>
                    <span className="spec-k__label">
                      {t("movieDetail.specFormat")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Section>
        </Reveal>

        {/* Rạp đang chiếu */}
        {cinemasShowing.length > 0 && (
          <Reveal>
            <Section label={t("movieDetail.secShowingAt")}>
              <div className="detail-k__cinemas">
                {cinemasShowing.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="cinema-k"
                    onClick={() => navigate(`/cinema/${c.id}`)}
                  >
                    <span className="cinema-k__body">
                      <span className="cinema-k__name">{c.name}</span>
                      <span className="cinema-k__city">{c.city ?? "—"}</span>
                    </span>
                    <span className="cinema-k__arrow">→</span>
                  </button>
                ))}
              </div>
            </Section>
          </Reveal>
        )}

        {/* Phim cùng thể loại */}
        {related.length > 0 && (
          <Reveal>
            <Section label={t("movieDetail.secSameGenre")}>
              <div className="detail-k__related">
                {related.map((m) => (
                  <MovieCard key={m.id} movie={m} />
                ))}
              </div>
            </Section>
          </Reveal>
        )}

        {/* Đánh giá của khán giả */}
        <Reveal>
          <Section label={t("movieDetail.secReviews")}>
            <ReviewsSection movieId={movie.id} />
          </Section>
        </Reveal>
      </Container>

      <Footer />
    </div>
  );
}

function ReviewsSection({ movieId }: { movieId: number }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const reviewsQ = useMovieReviews(movieId);
  const reviews = useMemo(
    () => [...(reviewsQ.data ?? [])].sort((a, b) => b.id - a.id),
    [reviewsQ.data],
  );
  const stats = useMemo(() => reviewStats(reviews), [reviews]);
  const mine = useMemo(
    () => reviews.find((r) => r.userId === user?.id),
    [reviews, user],
  );

  const createM = useCreateReview();
  const updateM = useUpdateReview();
  const deleteM = useDeleteReview();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Nạp sẵn khi vào chế độ sửa review của mình.
  useEffect(() => {
    if (editing && mine) {
      setRating(mine.rating);
      setComment(mine.comment ?? "");
    }
  }, [editing, mine]);

  const submit = async () => {
    setError(null);
    if (rating < 1) {
      setError(t("movieDetail.chooseStars"));
      return;
    }
    try {
      if (mine && editing) {
        await updateM.mutateAsync({
          id: mine.id,
          movieId,
          rating,
          comment: comment.trim() || undefined,
        });
        setEditing(false);
      } else {
        await createM.mutateAsync({
          movieId,
          rating,
          comment: comment.trim() || undefined,
        });
        setRating(0);
        setComment("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("movieDetail.saveError"));
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm(t("movieDetail.confirmDelete"))) return;
    await deleteM.mutateAsync({ id, movieId });
    if (mine?.id === id) {
      setEditing(false);
      setRating(0);
      setComment("");
    }
  };

  const maxBar = Math.max(
    1,
    ...([5, 4, 3, 2, 1] as RatingKey[]).map((k) => stats.distribution[k]),
  );

  return (
    <div className="rev-k">
      {/* Header: điểm + phân bố */}
      <div className="rev-k__head">
        <div className="rev-k__score">
          <span className="rev-k__avg">{stats.average.toFixed(1)}</span>
          <StarRating value={stats.average} readonly size="lg" />
          <span className="rev-k__count">
            {t("movieDetail.reviewCount", { count: stats.count })}
          </span>
        </div>
        <div className="rev-k__dist" aria-hidden="true">
          {([5, 4, 3, 2, 1] as RatingKey[]).map((k) => (
            <div key={k} className="rev-k__dist-row">
              <span className="rev-k__dist-k">{k}★</span>
              <span className="rev-k__dist-bar">
                <span
                  className="rev-k__dist-fill"
                  style={{
                    width: `${(stats.distribution[k] / maxBar) * 100}%`,
                  }}
                />
              </span>
              <span className="rev-k__dist-n">{stats.distribution[k]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      {user ? (
        mine && !editing ? (
          <div className="rev-k__mine">
            <span className="rev-k__mine-label">
              {t("movieDetail.yourReview")}
            </span>
            <StarRating value={mine.rating} readonly />
            {mine.comment && <p className="rev-k__mine-cmt">{mine.comment}</p>}
            <div className="rev-k__actions">
              <Button variant="ghost" onClick={() => setEditing(true)}>
                {t("movieDetail.edit")}
              </Button>
              <Button variant="ghost" onClick={() => remove(mine.id)}>
                {t("movieDetail.delete")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rev-k__form">
            <StarRating value={rating} onChange={setRating} size="lg" />
            <textarea
              className="rev-k__textarea"
              maxLength={500}
              placeholder={t("movieDetail.reviewPlaceholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="rev-k__form-foot">
              <span className="rev-k__counter">{comment.length}/500</span>
              <div className="rev-k__actions">
                {editing && (
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    {t("movieDetail.cancel")}
                  </Button>
                )}
                <Button
                  onClick={submit}
                  disabled={createM.isPending || updateM.isPending}
                >
                  {mine ? t("movieDetail.update") : t("movieDetail.submit")}
                </Button>
              </div>
            </div>
            {error && <p className="rev-k__error">{error}</p>}
          </div>
        )
      ) : (
        <p className="rev-k__login">
          <Link to="/login">{t("nav.login")}</Link>{" "}
          {t("movieDetail.toWriteReview")}
        </p>
      )}

      {/* Danh sách */}
      {reviewsQ.isLoading ? (
        <Skeleton />
      ) : reviews.length === 0 ? (
        <p className="rev-k__empty">{t("movieDetail.noReviews")}</p>
      ) : (
        <ul className="rev-k__list">
          {reviews.map((r) => (
            <li key={r.id} className="rev-k__item">
              <div className="rev-k__item-top">
                <span className="rev-k__name">{r.userName}</span>
                {r.verified && (
                  <span className="rev-k__badge">
                    {t("movieDetail.watched")}
                  </span>
                )}
                <StarRating value={r.rating} readonly size="sm" />
              </div>
              {r.comment && <p className="rev-k__cmt">{r.comment}</p>}
              <div className="rev-k__item-foot">
                <time>{formatDate(r.createdAt)}</time>
                {(r.userId === user?.id || user?.role === "admin") && (
                  <button
                    type="button"
                    className="rev-k__del"
                    onClick={() => remove(r.id)}
                  >
                    {t("movieDetail.delete")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
