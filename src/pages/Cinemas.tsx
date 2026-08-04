import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import { Container, Grid, Tag, Skeleton, Button } from "components/ui";
import { useCities, useCinemas, useRooms } from "queries/catalog";
import "./Cinemas.css";

export default function Cinemas() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
          <span className="cinemas-k__label">{t("cinemas.eyebrow")}</span>
          <h1 className="cinemas-k__title">{t("cinemas.title")}</h1>
          {!isLoading && !isError && (
            <span className="cinemas-k__count">
              {t("cinemas.count", { count: visible.length })}
            </span>
          )}
        </header>

        <div
          className="cinemas-k__cities"
          role="group"
          aria-label={t("cinemas.filterByCity")}
        >
          <button
            type="button"
            className={"city-k-chip" + (cityId === "all" ? " is-active" : "")}
            aria-pressed={cityId === "all"}
            onClick={() => setCityId("all")}
          >
            {t("common.all")}
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
            <p>{t("common.loadError")}</p>
            <Button onClick={() => cinemasQ.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : isLoading ? (
          <Grid min="280px">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height="200px" />
            ))}
          </Grid>
        ) : visible.length === 0 ? (
          <div className="cinemas-k__empty">
            <p className="cinemas-k__empty-title">{t("cinemas.empty")}</p>
          </div>
        ) : (
          <Grid min="280px">
            {visible.map((c) => (
              <button
                key={c.id}
                type="button"
                className="venue-k"
                onClick={() => navigate(`/cinema/${c.id}`)}
              >
                <Tag className="venue-k__city">{cityName[c.cityId] ?? "—"}</Tag>
                <span className="venue-k__name">{c.name}</span>
                {c.address && (
                  <span className="venue-k__addr">{c.address}</span>
                )}
                <span className="venue-k__rooms">
                  {t("cinemas.roomCount", { count: roomCount.get(c.id) ?? 0 })}
                </span>
                <span className="venue-k__link">
                  {t("search.viewSchedule")}
                </span>
              </button>
            ))}
          </Grid>
        )}
      </Container>
      <Footer />
    </div>
  );
}
