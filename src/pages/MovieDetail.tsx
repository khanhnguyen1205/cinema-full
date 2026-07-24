import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
import { useAuth } from "context/AuthContext";
import "./MovieDetail.css";

export default function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const enriched = useMemo(() => {
    const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
    const cinemaMap = Object.fromEntries(cinemas.map((c) => [c.id, c]));
    return showtimes.map((s) => {
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

  const firstCinemaOf = (c: number) =>
    [
      ...new Set(
        enriched.filter((e) => e.cityId === c).map((e) => e.cinema?.id),
      ),
    ].filter(Boolean)[0] as number | undefined;
  const firstDateOf = (c: number, cin: number) =>
    [
      ...new Set(
        enriched
          .filter((e) => e.cityId === c && e.cinema?.id === cin)
          .map((e) => e.dateKey),
      ),
    ].sort()[0];
  const cinemaName = (cid: number) =>
    enriched.find((e) => e.cinema?.id === cid)?.cinema?.name || "";

  // Khởi tạo default khi enriched sẵn sàng và chưa chọn gì
  useEffect(() => {
    if (!enriched.length || cityId !== null) return;
    const c0 = [...new Set(enriched.map((e) => e.cityId))].filter(
      Boolean,
    )[0] as number | undefined;
    if (c0 === undefined) return;
    const cin0 = firstCinemaOf(c0);
    const d0 = cin0 !== undefined ? firstDateOf(c0, cin0) : undefined;
    setCityId(c0);
    setCinemaId(cin0 ?? null);
    setDateKey(d0 ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched]);

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

  const cityIds = useMemo(
    () =>
      [...new Set(enriched.map((e) => e.cityId))].filter(Boolean) as number[],
    [enriched],
  );
  const cinemaIds = useMemo(
    () =>
      [
        ...new Set(
          enriched.filter((e) => e.cityId === cityId).map((e) => e.cinema?.id),
        ),
      ].filter(Boolean) as number[],
    [enriched, cityId],
  );
  const dateKeys = useMemo(
    () =>
      [
        ...new Set(
          enriched
            .filter((e) => e.cityId === cityId && e.cinema?.id === cinemaId)
            .map((e) => e.dateKey),
        ),
      ].sort(),
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

  // Rạp có suất cho phim (khu N°02)
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

  // Phim cùng thể loại (khu N°03)
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
        <div
          className="detail-k__poster"
          style={
            movie.poster
              ? {
                  backgroundImage: `linear-gradient(to right, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.72) 55%, rgba(10,10,10,0.4) 100%), url(${movie.poster})`,
                }
              : undefined
          }
          aria-hidden="true"
        />
        <div className="detail-k__scanline" aria-hidden="true" />
        <Container>
          <div className="detail-k__grid">
            <div className="detail-k__info">
              <div className="detail-k__meta">
                <span className="detail-k__tag">Đang chiếu</span>
                {movie.rating != null && (
                  <span className="detail-k__rating">
                    ★ {movie.rating.toFixed(1)}
                  </span>
                )}
                <span className="detail-k__genre">
                  {movie.genre} · {movie.duration} PHÚT
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
                <div className="book-k__head">Đặt vé</div>
                {enriched.length === 0 ? (
                  <p className="book-k__empty">Chưa có suất chiếu</p>
                ) : (
                  <>
                    <div className="book-k__selects">
                      <Field label="Thành phố" htmlFor="sel-city">
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
                          aria-label="Chọn thành phố"
                        >
                          {cityIds.map((cid) => (
                            <option key={cid} value={cid}>
                              {cityMap[cid]?.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Rạp" htmlFor="sel-cinema">
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
                          aria-label="Chọn rạp"
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
                          {fmtDate(dk)}
                        </button>
                      ))}
                    </div>

                    <div className="book-k__times-label">Giờ chiếu</div>
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
                            {fmtTime(e.time)}
                          </span>
                          <span className="time-k-btn__meta">
                            {e.room?.type} · {e.price.toLocaleString("vi-VN")}₫
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
                      Đặt vé
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
        {/* N°01 — Tóm tắt + thông số */}
        <Reveal>
          <Section label="Tóm tắt" index={1}>
            <div className="detail-k__about">
              <p className="detail-k__synopsis">
                {movie.description || "Chưa có mô tả cho phim này."}
              </p>
              <div className="spec-k">
                {movie.rating != null && (
                  <div className="spec-k__item">
                    <span className="spec-k__num">
                      {movie.rating.toFixed(1)}
                    </span>
                    <span className="spec-k__label">Điểm</span>
                  </div>
                )}
                <div className="spec-k__item">
                  <span className="spec-k__val">{movie.genre}</span>
                  <span className="spec-k__label">Thể loại</span>
                </div>
                <div className="spec-k__item">
                  <span className="spec-k__val">{movie.duration}′</span>
                  <span className="spec-k__label">Thời lượng</span>
                </div>
                {formats.length > 0 && (
                  <div className="spec-k__item">
                    <span className="spec-k__val">{formats.join(" · ")}</span>
                    <span className="spec-k__label">Định dạng</span>
                  </div>
                )}
              </div>
            </div>
          </Section>
        </Reveal>

        {/* N°02 — Rạp đang chiếu */}
        {cinemasShowing.length > 0 && (
          <Reveal>
            <Section label="Đang chiếu tại" index={2}>
              <div className="detail-k__cinemas">
                {cinemasShowing.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className="cinema-k"
                    onClick={() => navigate(`/cinema/${c.id}`)}
                  >
                    <span className="cinema-k__no">
                      N°{String(i + 1).padStart(2, "0")}
                    </span>
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

        {/* N°03 — Phim cùng thể loại */}
        {related.length > 0 && (
          <Reveal>
            <Section label="Cùng thể loại" index={3}>
              <div className="detail-k__related">
                {related.map((m) => (
                  <MovieCard key={m.id} movie={m} />
                ))}
              </div>
            </Section>
          </Reveal>
        )}

        {/* N°04 — Đánh giá của khán giả */}
        <Reveal>
          <Section label="Đánh giá của khán giả" index={4}>
            <ReviewsSection movieId={movie.id} />
          </Section>
        </Reveal>
      </Container>

      <Footer />
    </div>
  );
}

function ReviewsSection({ movieId }: { movieId: number }) {
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
      setError("Vui lòng chọn số sao.");
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
      setError(e instanceof Error ? e.message : "Không thể lưu đánh giá.");
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Xoá đánh giá này?")) return;
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
          <span className="rev-k__count">{stats.count} đánh giá</span>
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
            <span className="rev-k__mine-label">Đánh giá của bạn</span>
            <StarRating value={mine.rating} readonly />
            {mine.comment && <p className="rev-k__mine-cmt">{mine.comment}</p>}
            <div className="rev-k__actions">
              <Button variant="ghost" onClick={() => setEditing(true)}>
                Sửa
              </Button>
              <Button variant="ghost" onClick={() => remove(mine.id)}>
                Xoá
              </Button>
            </div>
          </div>
        ) : (
          <div className="rev-k__form">
            <StarRating value={rating} onChange={setRating} size="lg" />
            <textarea
              className="rev-k__textarea"
              maxLength={500}
              placeholder="Chia sẻ cảm nhận của bạn (tùy chọn)…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="rev-k__form-foot">
              <span className="rev-k__counter">{comment.length}/500</span>
              <div className="rev-k__actions">
                {editing && (
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Huỷ
                  </Button>
                )}
                <Button
                  onClick={submit}
                  disabled={createM.isPending || updateM.isPending}
                >
                  {mine ? "Cập nhật" : "Gửi đánh giá"}
                </Button>
              </div>
            </div>
            {error && <p className="rev-k__error">{error}</p>}
          </div>
        )
      ) : (
        <p className="rev-k__login">
          <Link to="/login">Đăng nhập</Link> để viết đánh giá.
        </p>
      )}

      {/* Danh sách */}
      {reviewsQ.isLoading ? (
        <Skeleton />
      ) : reviews.length === 0 ? (
        <p className="rev-k__empty">
          Chưa có đánh giá — hãy là người đầu tiên!
        </p>
      ) : (
        <ul className="rev-k__list">
          {reviews.map((r) => (
            <li key={r.id} className="rev-k__item">
              <div className="rev-k__item-top">
                <span className="rev-k__name">{r.userName}</span>
                {r.verified && <span className="rev-k__badge">Đã xem</span>}
                <StarRating value={r.rating} readonly size="sm" />
              </div>
              {r.comment && <p className="rev-k__cmt">{r.comment}</p>}
              <div className="rev-k__item-foot">
                <time>{new Date(r.createdAt).toLocaleDateString("vi-VN")}</time>
                {(r.userId === user?.id || user?.role === "admin") && (
                  <button
                    type="button"
                    className="rev-k__del"
                    onClick={() => remove(r.id)}
                  >
                    Xoá
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
