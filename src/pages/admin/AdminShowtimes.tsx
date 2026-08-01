import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAllShowtimes,
  useMovies,
  useRooms,
  useCinemas,
} from "queries/catalog";
import { formatDateTime, formatPrice } from "i18n/format";
import {
  useCreateShowtime,
  useUpdateShowtime,
  useDeleteShowtime,
} from "queries/admin";
import { ROOM_TYPE_PRICE } from "lib/pricing";
import Modal from "components/admin/Modal";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import Pagination from "components/admin/Pagination";
import type { Showtime } from "types";

const EMPTY = { movieId: "", roomId: "", date: "", time: "", price: "" };

export default function AdminShowtimes() {
  const { t } = useTranslation();
  const showtimesQ = useAllShowtimes();
  const moviesQ = useMovies();
  const roomsQ = useRooms();
  const cinemasQ = useCinemas();
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const createS = useCreateShowtime();
  const updateS = useUpdateShowtime();
  const deleteS = useDeleteShowtime();

  const [q, setQ] = useState("");
  const [cinemaFilter, setCinemaFilter] = useState("all");
  const [editing, setEditing] = useState<Showtime | "new" | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const roomMap = useMemo(
    () => Object.fromEntries(rooms.map((r) => [r.id, r])),
    [rooms],
  );
  const cinemaMap = useMemo(
    () => Object.fromEntries(cinemas.map((c) => [c.id, c])),
    [cinemas],
  );
  const movieMap = useMemo(
    () => Object.fromEntries(movies.map((m) => [m.id, m])),
    [movies],
  );
  const roomLabel = (rid: number) => {
    const r = roomMap[rid];
    return r ? `${cinemaMap[r.cinemaId]?.name} · ${r.name} · ${r.type}` : "—";
  };

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return showtimes
      .filter((s) => {
        const r = roomMap[s.roomId];
        const okCinema =
          cinemaFilter === "all" || (r && r.cinemaId === Number(cinemaFilter));
        const okTerm =
          !term ||
          (movieMap[s.movieId]?.title || "").toLowerCase().includes(term);
        return okCinema && okTerm;
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [showtimes, q, cinemaFilter, roomMap, movieMap]);

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(visible);

  const openNew = () => {
    setForm(EMPTY);
    setError("");
    setEditing("new");
  };
  const openEdit = (s: Showtime) => {
    setForm({
      movieId: String(s.movieId),
      roomId: String(s.roomId),
      date: s.time.slice(0, 10),
      time: s.time.slice(11, 16),
      price: String(s.price),
    });
    setError("");
    setEditing(s);
  };
  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const v = e.target.value;
      setForm((f) => {
        const next = { ...f, [k]: v };
        if (k === "roomId") {
          const r = roomMap[Number(v)];
          if (r && !next.price) next.price = String(ROOM_TYPE_PRICE[r.type]);
        }
        return next;
      });
    };

  const save = async () => {
    if (
      !form.movieId ||
      !form.roomId ||
      !form.date ||
      !form.time ||
      !form.price
    ) {
      setError(t("admin.showtimesFormErr"));
      return;
    }
    const body = {
      movieId: Number(form.movieId),
      roomId: Number(form.roomId),
      time: `${form.date}T${form.time}:00`,
      price: Number(form.price),
      bookedSeats:
        editing === "new" ? [] : editing ? editing.bookedSeats || [] : [],
    };
    if (editing === "new") await createS.mutateAsync(body);
    else if (editing) await updateS.mutateAsync({ id: editing.id, body });
    setEditing(null);
  };
  const doDelete = async () => {
    if (confirmId == null) return;
    await deleteS.mutateAsync(confirmId);
    setConfirmId(null);
  };

  const fmt = (iso: string) =>
    formatDateTime(iso, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <div className="adm-k__head">
        <span className="adm-k__eyebrow">{t("admin.role")}</span>
        <h1 className="adm-k__title">{t("admin.showtimesTitle")}</h1>
        <span className="adm-k__count">
          {t("admin.items", { count: total })}
        </span>
      </div>
      <div className="adm-k__toolbar">
        <input
          className="adm-k__search"
          placeholder={t("admin.showtimeSearchPh")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="adm-k__filter"
          value={cinemaFilter}
          onChange={(e) => setCinemaFilter(e.target.value)}
        >
          <option value="all">{t("admin.allCinemas")}</option>
          {cinemas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="adm-k__btn" onClick={openNew}>
          {t("admin.addShowtime")}
        </button>
      </div>
      <div className="adm-k__tablewrap">
        <table className="adm-k__table">
          <thead>
            <tr>
              <th scope="col">{t("admin.fMovie")}</th>
              <th scope="col">{t("admin.thRoomCinema")}</th>
              <th scope="col">{t("admin.thTime")}</th>
              <th scope="col">{t("admin.thPrice")}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((s) => (
              <tr key={s.id}>
                <td>{movieMap[s.movieId]?.title || "—"}</td>
                <td>{roomLabel(s.roomId)}</td>
                <td className="num">{fmt(s.time)}</td>
                <td className="num">{formatPrice(s.price)}</td>
                <td>
                  <div className="adm-k__rowact">
                    <button
                      className="adm-k__btn ghost sm"
                      onClick={() => openEdit(s)}
                    >
                      {t("admin.edit")}
                    </button>
                    <button
                      className="adm-k__btn danger sm"
                      onClick={() => setConfirmId(s.id)}
                    >
                      {t("admin.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="adm-k__empty">
                  {t("admin.showtimesEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        from={from}
        to={to}
        total={total}
      />

      {editing && (
        <Modal
          title={
            editing === "new" ? t("admin.newShowtime") : t("admin.editShowtime")
          }
          onClose={() => setEditing(null)}
        >
          <div className="adm-k__field">
            <label htmlFor="adm-showtime-movie">{t("admin.fMovie")}</label>
            <select
              id="adm-showtime-movie"
              value={form.movieId}
              onChange={set("movieId")}
            >
              <option value="">{t("admin.chooseMovie")}</option>
              {movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
          <div className="adm-k__field">
            <label htmlFor="adm-showtime-room">
              {t("admin.fRoomCinemaType")}
            </label>
            <select
              id="adm-showtime-room"
              value={form.roomId}
              onChange={set("roomId")}
            >
              <option value="">{t("admin.chooseRoom")}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {roomLabel(r.id)}
                </option>
              ))}
            </select>
          </div>
          <div className="adm-k__field-two">
            <div className="adm-k__field">
              <label htmlFor="adm-showtime-date">{t("admin.fDate")}</label>
              <input
                id="adm-showtime-date"
                type="date"
                value={form.date}
                onChange={set("date")}
              />
            </div>
            <div className="adm-k__field">
              <label htmlFor="adm-showtime-time">{t("admin.fTime")}</label>
              <input
                id="adm-showtime-time"
                type="time"
                value={form.time}
                onChange={set("time")}
              />
            </div>
          </div>
          <div className="adm-k__field">
            <label htmlFor="adm-showtime-price">{t("admin.fPriceVnd")}</label>
            <input
              id="adm-showtime-price"
              type="number"
              value={form.price}
              onChange={set("price")}
            />
          </div>
          {error && <div className="adm-k__formerr">{error}</div>}
          <div className="adm-k__modalact">
            <button
              className="adm-k__btn ghost"
              onClick={() => setEditing(null)}
            >
              {t("admin.cancel")}
            </button>
            <button className="adm-k__btn" onClick={save}>
              {t("admin.save")}
            </button>
          </div>
        </Modal>
      )}
      {confirmId != null && (
        <ConfirmDialog
          message={t("admin.confirmDeleteShowtime")}
          onConfirm={doDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
