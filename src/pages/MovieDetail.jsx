import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getMovie,
  getShowtimes,
  getRooms,
  getCinemas,
  getCities,
} from "services/api";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import "./MovieDetail.css";

export default function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [movie, setMovie] = useState(null);
  const [enriched, setEnriched] = useState([]); // showtimes + room + cinema + cityId + dateKey
  const [cityMap, setCityMap] = useState({});
  const [cityId, setCityId] = useState(null);
  const [cinemaId, setCinemaId] = useState(null);
  const [dateKey, setDateKey] = useState(null);
  const [selectedShowtime, setSelectedShowtime] = useState(null);

  useEffect(() => {
    (async () => {
      const [m, sts, rooms, cinemas, cities] = await Promise.all([
        getMovie(id),
        getShowtimes(id),
        getRooms(),
        getCinemas(),
        getCities(),
      ]);
      setMovie(m);
      setCityMap(Object.fromEntries(cities.map((c) => [c.id, c])));
      const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
      const cinemaMap = Object.fromEntries(cinemas.map((c) => [c.id, c]));
      const rows = sts.map((s) => {
        const room = roomMap[s.roomId];
        const cinema = room ? cinemaMap[room.cinemaId] : null;
        return {
          ...s,
          room,
          cinema,
          cityId: cinema?.cityId,
          dateKey: s.time.slice(0, 10),
        };
      });
      setEnriched(rows);
      if (rows.length) {
        const c0 = [...new Set(rows.map((e) => e.cityId))][0];
        const cin0 = [
          ...new Set(
            rows.filter((e) => e.cityId === c0).map((e) => e.cinema.id),
          ),
        ][0];
        const d0 = [
          ...new Set(
            rows
              .filter((e) => e.cityId === c0 && e.cinema.id === cin0)
              .map((e) => e.dateKey),
          ),
        ].sort()[0];
        setCityId(c0);
        setCinemaId(cin0);
        setDateKey(d0);
      }
    })();
  }, [id]);

  const firstCinemaOf = (city) =>
    [
      ...new Set(
        enriched.filter((e) => e.cityId === city).map((e) => e.cinema.id),
      ),
    ][0];
  const firstDateOf = (city, cin) =>
    [
      ...new Set(
        enriched
          .filter((e) => e.cityId === city && e.cinema.id === cin)
          .map((e) => e.dateKey),
      ),
    ].sort()[0];
  const cinemaName = (cid) =>
    enriched.find((e) => e.cinema.id === cid)?.cinema.name || "";

  const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtDate = (k) =>
    new Date(k).toLocaleDateString("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

  if (!movie)
    return (
      <div
        className="page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="loading-spinner" />
      </div>
    );

  const cityIds = [...new Set(enriched.map((e) => e.cityId))];
  const cinemaIds = [
    ...new Set(
      enriched.filter((e) => e.cityId === cityId).map((e) => e.cinema.id),
    ),
  ];
  const dateKeys = [
    ...new Set(
      enriched
        .filter((e) => e.cityId === cityId && e.cinema.id === cinemaId)
        .map((e) => e.dateKey),
    ),
  ].sort();
  const times = enriched
    .filter(
      (e) =>
        e.cityId === cityId &&
        e.cinema.id === cinemaId &&
        e.dateKey === dateKey,
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="page detail-page">
      <Navbar back="/" />

      <div className="detail-hero">
        <div className="detail-hero-bg" />
        {movie.poster && (
          <img
            className="detail-hero-poster"
            src={movie.poster}
            alt=""
            aria-hidden="true"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <div className="detail-hero-overlay" />

        <div className="detail-hero-content">
          <div className="detail-meta-top">
            <span className="tag">Đang chiếu</span>
            {movie.rating != null && (
              <span className="detail-rating">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#e63030">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {movie.rating.toFixed(1)} Điểm
              </span>
            )}
            <span className="detail-genre-badge">
              {movie.genre} · {movie.duration} PHÚT
            </span>
          </div>

          <h1 className="detail-title">
            {movie.title.split(":").map((part, i) => (
              <span key={i}>
                {i === 0 ? (
                  <>{part.trim()}</>
                ) : (
                  <>
                    <br />
                    <span className="red">{part.trim()}</span>
                  </>
                )}
              </span>
            ))}
          </h1>

          <p className="detail-description">{movie.description}</p>

          <div className="detail-credits">
            <div className="credit-item">
              <span className="credit-label">Thể loại</span>
              <span className="credit-value">{movie.genre}</span>
            </div>
            <div className="credit-item">
              <span className="credit-label">Thời lượng</span>
              <span className="credit-value">{movie.duration} phút</span>
            </div>
          </div>
        </div>

        {/* PANEL ĐẶT VÉ */}
        <div className="showtimes-panel">
          <div className="showtimes-panel-header">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Đặt vé
          </div>

          {enriched.length === 0 ? (
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: 13,
                marginTop: 12,
              }}
            >
              Chưa có suất chiếu
            </p>
          ) : (
            <>
              <div className="detail-select-row">
                <select
                  className="detail-select"
                  value={cityId ?? ""}
                  onChange={(e) => {
                    const c = Number(e.target.value);
                    const cin = firstCinemaOf(c);
                    const d = firstDateOf(c, cin);
                    setCityId(c);
                    setCinemaId(cin);
                    setDateKey(d);
                    setSelectedShowtime(null);
                  }}
                >
                  {cityIds.map((cid) => (
                    <option key={cid} value={cid}>
                      {cityMap[cid]?.name}
                    </option>
                  ))}
                </select>

                <select
                  className="detail-select"
                  value={cinemaId ?? ""}
                  onChange={(e) => {
                    const cin = Number(e.target.value);
                    const d = firstDateOf(cityId, cin);
                    setCinemaId(cin);
                    setDateKey(d);
                    setSelectedShowtime(null);
                  }}
                >
                  {cinemaIds.map((cid) => (
                    <option key={cid} value={cid}>
                      {cinemaName(cid)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="date-selector">
                {dateKeys.map((dk) => (
                  <button
                    key={dk}
                    className={`date-btn ${dateKey === dk ? "active" : ""}`}
                    onClick={() => {
                      setDateKey(dk);
                      setSelectedShowtime(null);
                    }}
                  >
                    <span className="date-day">{fmtDate(dk)}</span>
                  </button>
                ))}
              </div>

              <div className="times-label section-label">Giờ chiếu</div>
              <div className="times-grid">
                {times.map((e) => (
                  <button
                    key={e.id}
                    className={`time-btn ${selectedShowtime === e.id ? "active" : ""}`}
                    onClick={() => setSelectedShowtime(e.id)}
                  >
                    {fmtTime(e.time)}
                    <span className="time-type">
                      {e.room.type} · {e.price.toLocaleString("vi-VN")}₫
                    </span>
                  </button>
                ))}
              </div>

              <button
                className="btn-primary book-btn"
                disabled={!selectedShowtime}
                onClick={() =>
                  selectedShowtime && navigate(`/seats/${selectedShowtime}`)
                }
              >
                Đặt vé
              </button>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
