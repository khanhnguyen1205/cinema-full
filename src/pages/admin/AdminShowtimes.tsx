import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAllShowtimes,
  useMovies,
  useRooms,
  useCinemas,
} from "queries/catalog";
import { formatPrice } from "i18n/format";
import {
  useCreateShowtime,
  useUpdateShowtime,
  useDeleteShowtime,
} from "queries/admin";
import { ROOM_TYPE_PRICE } from "lib/pricing";
import Modal from "components/admin/Modal";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import type { Showtime } from "types";
import {
  AdminHead,
  CinemaFilter,
  ModalActions,
  RowActions,
  SearchBox,
  TablePager,
} from "./AdminUI";
import {
  adminDateTime,
  useAdminForm,
  useById,
  useConfirmDelete,
} from "./adminUtils";

const EMPTY = { movieId: "", roomId: "", date: "", time: "", price: "" };

const toForm = (s: Showtime): typeof EMPTY => ({
  movieId: String(s.movieId),
  roomId: String(s.roomId),
  date: s.time.slice(0, 10),
  time: s.time.slice(11, 16),
  price: String(s.price),
});

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

  const roomMap = useById(rooms);
  const cinemaMap = useById(cinemas);
  const movieMap = useById(movies);
  const roomLabel = (rid: number) => {
    const r = roomMap[rid];
    return r ? `${cinemaMap[r.cinemaId]?.name} · ${r.name} · ${r.type}` : "—";
  };

  // Chọn phòng khi chưa nhập giá thì điền sẵn giá gợi ý của loại phòng đó.
  const { editing, form, error, setError, openNew, openEdit, close, set } =
    useAdminForm<Showtime, typeof EMPTY>(EMPTY, (next, key) => {
      if (key !== "roomId" || next.price) return next;
      const r = roomMap[Number(next.roomId)];
      return r ? { ...next, price: String(ROOM_TYPE_PRICE[r.type]) } : next;
    });

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

  const { pageItems, ...pag } = usePagination(visible);

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
      // Suất mới luôn trống ghế; sửa suất cũ thì giữ nguyên ghế đã bán.
      bookedSeats: editing === "new" ? [] : editing?.bookedSeats || [],
    };
    if (editing === "new") await createS.mutateAsync(body);
    else if (editing) await updateS.mutateAsync({ id: editing.id, body });
    close();
  };

  const del = useConfirmDelete((id) => deleteS.mutateAsync(id));

  return (
    <div>
      <AdminHead title={t("admin.showtimesTitle")} count={pag.total} />
      <div className="adm-k__toolbar">
        <SearchBox
          placeholder={t("admin.showtimeSearchPh")}
          value={q}
          onChange={setQ}
        />
        <CinemaFilter
          cinemas={cinemas}
          value={cinemaFilter}
          onChange={setCinemaFilter}
        />
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
                <td className="num">{adminDateTime(s.time)}</td>
                <td className="num">{formatPrice(s.price)}</td>
                <td>
                  <RowActions
                    onEdit={() => openEdit(s, toForm(s))}
                    onDelete={() => del.ask(s.id)}
                  />
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
      <TablePager {...pag} />

      {editing && (
        <Modal
          title={
            editing === "new" ? t("admin.newShowtime") : t("admin.editShowtime")
          }
          onClose={close}
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
          <ModalActions onCancel={close} onSave={save} />
        </Modal>
      )}
      {del.confirmId != null && (
        <ConfirmDialog
          message={t("admin.confirmDeleteShowtime")}
          onConfirm={del.confirm}
          onCancel={del.cancel}
        />
      )}
    </div>
  );
}
