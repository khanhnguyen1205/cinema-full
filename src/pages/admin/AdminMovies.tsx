import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMovies, useAllShowtimes } from "queries/catalog";
import { useCreateMovie, useUpdateMovie, useDeleteMovie } from "queries/admin";
import Modal from "components/admin/Modal";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import type { Movie } from "types";
import {
  AdminHead,
  ModalActions,
  RowActions,
  SearchBox,
  TablePager,
} from "./AdminUI";
import { useAdminForm, useConfirmDelete } from "./adminUtils";

const EMPTY = {
  title: "",
  genre: "",
  duration: "",
  description: "",
  poster: "",
};

const toForm = (m: Movie): typeof EMPTY => ({
  title: m.title,
  genre: m.genre,
  duration: String(m.duration),
  description: m.description || "",
  poster: m.poster || "",
});

export default function AdminMovies() {
  const { t } = useTranslation();
  const moviesQ = useMovies();
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const showtimes = useAllShowtimes().data ?? [];
  const createM = useCreateMovie();
  const updateM = useUpdateMovie();
  const deleteM = useDeleteMovie();

  const [q, setQ] = useState("");
  const { editing, form, error, setError, openNew, openEdit, close, set } =
    useAdminForm<Movie, typeof EMPTY>(EMPTY);

  const visible = useMemo(
    () =>
      movies.filter((m) =>
        m.title.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [movies, q],
  );

  const { pageItems, ...pag } = usePagination(visible);

  const save = async () => {
    if (!form.title.trim() || !form.genre.trim() || !form.duration) {
      setError(t("admin.moviesFormErr"));
      return;
    }
    const body = {
      title: form.title.trim(),
      genre: form.genre.trim(),
      duration: Number(form.duration),
      description: form.description,
      poster: form.poster || "",
    };
    if (editing === "new") await createM.mutateAsync(body);
    else if (editing) await updateM.mutateAsync({ id: editing.id, body });
    close();
  };

  // Chặn xoá phim còn suất chiếu: báo bằng alert, không gọi API.
  const del = useConfirmDelete(async (id) => {
    const used = showtimes.filter((s) => s.movieId === id).length;
    if (used > 0) {
      alert(t("admin.inUseShowtimes", { count: used }));
      return;
    }
    await deleteM.mutateAsync(id);
  });

  return (
    <div>
      <AdminHead title={t("admin.moviesTitle")} count={pag.total} />
      <div className="adm-k__toolbar">
        <SearchBox
          placeholder={t("admin.movieSearchPh")}
          value={q}
          onChange={setQ}
        />
        <button className="adm-k__btn" onClick={openNew}>
          {t("admin.addMovie")}
        </button>
      </div>
      <div className="adm-k__tablewrap">
        <table className="adm-k__table">
          <thead>
            <tr>
              <th scope="col">{t("admin.thName")}</th>
              <th scope="col">{t("admin.thGenre")}</th>
              <th scope="col">{t("admin.thDuration")}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((m) => (
              <tr key={m.id}>
                <td>{m.title}</td>
                <td>{m.genre}</td>
                <td className="num">
                  {m.duration} {t("common.minutes")}
                </td>
                <td>
                  <RowActions
                    onEdit={() => openEdit(m, toForm(m))}
                    onDelete={() => del.ask(m.id)}
                  />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="adm-k__empty">
                  {t("admin.moviesEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePager {...pag} />

      {editing && (
        <Modal
          title={editing === "new" ? t("admin.newMovie") : t("admin.editMovie")}
          onClose={close}
        >
          <div className="adm-k__field">
            <label htmlFor="adm-movie-title">{t("admin.fMovieTitle")}</label>
            <input
              id="adm-movie-title"
              value={form.title}
              onChange={set("title")}
            />
          </div>
          <div className="adm-k__field-two">
            <div className="adm-k__field">
              <label htmlFor="adm-movie-genre">{t("admin.fGenre")}</label>
              <input
                id="adm-movie-genre"
                value={form.genre}
                onChange={set("genre")}
              />
            </div>
            <div className="adm-k__field">
              <label htmlFor="adm-movie-duration">
                {t("admin.fDurationMin")}
              </label>
              <input
                id="adm-movie-duration"
                type="number"
                value={form.duration}
                onChange={set("duration")}
              />
            </div>
          </div>
          <div className="adm-k__field">
            <label htmlFor="adm-movie-desc">{t("admin.fDescription")}</label>
            <textarea
              id="adm-movie-desc"
              rows={3}
              value={form.description}
              onChange={set("description")}
            />
          </div>
          <div className="adm-k__field">
            <label htmlFor="adm-movie-poster">{t("admin.fPoster")}</label>
            <input
              id="adm-movie-poster"
              value={form.poster}
              onChange={set("poster")}
            />
          </div>
          {error && <div className="adm-k__formerr">{error}</div>}
          <ModalActions onCancel={close} onSave={save} />
        </Modal>
      )}
      {del.confirmId != null && (
        <ConfirmDialog
          message={t("admin.confirmDeleteMovie")}
          onConfirm={del.confirm}
          onCancel={del.cancel}
        />
      )}
    </div>
  );
}
