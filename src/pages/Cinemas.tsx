import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import {
  Container,
  Grid,
  KineticHeading,
  Tag,
  Skeleton,
  Button,
} from "components/ui";
import { useCities, useCinemas, useRooms } from "queries/catalog";
import "./Cinemas.css";

export default function Cinemas() {
  const navigate = useNavigate();
  const citiesQ = useCities();
  const cinemasQ = useCinemas();
  const roomsQ = useRooms();

  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);

  const [cityId, setCityId] = useState<number | "all">("all");

  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );
  const roomCount = useMemo(() => {
    const m = new Map<number, number>();
    rooms.forEach((r) => m.set(r.cinemaId, (m.get(r.cinemaId) ?? 0) + 1));
    return m;
  }, [rooms]);

  const visible = useMemo(
    () =>
      cityId === "all" ? cinemas : cinemas.filter((c) => c.cityId === cityId),
    [cinemas, cityId],
  );

  const isLoading = cinemasQ.isLoading;
  const isError = cinemasQ.isError;

  return (
    <div className="page cinemas-page">
      <Navbar />
      <Container>
        <header className="cinemas-k__header">
          <span className="cinemas-k__label">Hệ thống rạp</span>
          <h1 className="cinemas-k__title">
            <KineticHeading text="Rạp chiếu phim" />
          </h1>
          {!isLoading && !isError && (
            <span className="cinemas-k__count">
              <b>{visible.length}</b> rạp
            </span>
          )}
        </header>

        <div
          className="cinemas-k__cities"
          role="group"
          aria-label="Lọc theo thành phố"
        >
          <button
            type="button"
            className={"city-k-chip" + (cityId === "all" ? " is-active" : "")}
            aria-pressed={cityId === "all"}
            onClick={() => setCityId("all")}
          >
            Tất cả
          </button>
          {cities.map((c) => (
            <button
              key={c.id}
              type="button"
              className={"city-k-chip" + (cityId === c.id ? " is-active" : "")}
              aria-pressed={cityId === c.id}
              onClick={() => setCityId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {isError ? (
          <div className="cinemas-k__empty">
            <p>Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.</p>
            <Button onClick={() => cinemasQ.refetch()}>Thử lại</Button>
          </div>
        ) : isLoading ? (
          <Grid min="280px">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height="200px" />
            ))}
          </Grid>
        ) : visible.length === 0 ? (
          <div className="cinemas-k__empty">
            <p className="cinemas-k__empty-title">Không có rạp nào</p>
          </div>
        ) : (
          <Grid min="280px">
            {visible.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className="venue-k"
                onClick={() => navigate(`/cinema/${c.id}`)}
              >
                <span className="venue-k__no" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Tag className="venue-k__city">{cityName[c.cityId] ?? "—"}</Tag>
                <span className="venue-k__name">{c.name}</span>
                {c.address && (
                  <span className="venue-k__addr">{c.address}</span>
                )}
                <span className="venue-k__rooms">
                  {roomCount.get(c.id) ?? 0} phòng
                </span>
                <span className="venue-k__link">Xem lịch chiếu →</span>
              </button>
            ))}
          </Grid>
        )}
      </Container>
      <Footer />
    </div>
  );
}
