import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMovies, useAllShowtimes } from "queries/catalog";
import { useCreateMovie, useUpdateMovie, useDeleteMovie } from "queries/admin";
import Modal from "components/admin/Modal";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import Pagination from "components/admin/Pagination";
import type { Movie } from "types";

const EMPTY = {
  title: "",
  genre: "",
  duration: "",
  description: "",
  poster: "",
};

export default function AdminMovies() {
  const { t } = useTranslation();
  const moviesQ = useMovies();
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const showtimes = useAllShowtimes().data ?? [];
  const createM = useCreateMovie();
  const updateM = useUpdateMovie();
  const deleteM = useDeleteMovie();

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Movie | "new" | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const visible = useMemo(
    () =>
      movies.filter((m) =>
        m.title.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [movies, q],
  );

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(visible);

  const openNew = () => {
    setForm(EMPTY);
    setError("");
    setEditing("new");
  };
  const openEdit = (m: Movie) => {
    setForm({
      title: m.title,
      genre: m.genre,
      duration: String(m.duration),
      description: m.description || "",
      poster: m.poster || "",
    });
    setError("");
    setEditing(m);
  };
  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

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
    setEditing(null);
  };

  const doDelete = async () => {
    if (confirmId == null) return;
    const used = showtimes.filter((s) => s.movieId === confirmId).length;
    if (used > 0) {
      alert(t("admin.inUseShowtimes", { count: used }));
      setConfirmId(null);
      return;
    }
    await deleteM.mutateAsync(confirmId);
    setConfirmId(null);
  };

  return (
    <div>
      <div className="adm-k__head">
        <span className="adm-k__eyebrow">{t("admin.role")}</span>
        <h1 className="adm-k__title">{t("admin.moviesTitle")}</h1>
        <span className="adm-k__count">
          {t("admin.items", { count: total })}
        </span>
      </div>
      <div className="adm-k__toolbar">
        <input
          className="adm-k__search"
          placeholder={t("admin.movieSearchPh")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
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
                  <div className="adm-k__rowact">
                    <button
                      className="adm-k__btn ghost sm"
                      onClick={() => openEdit(m)}
                    >
                      {t("admin.edit")}
                    </button>
                    <button
                      className="adm-k__btn danger sm"
                      onClick={() => setConfirmId(m.id)}
                    >
                      {t("admin.delete")}
                    </button>
                  </div>
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
          title={editing === "new" ? t("admin.newMovie") : t("admin.editMovie")}
          onClose={() => setEditing(null)}
        >
          <div className="adm-k__field">
            <label>{t("admin.fMovieTitle")}</label>
            <input value={form.title} onChange={set("title")} />
          </div>
          <div className="adm-k__field-two">
            <div className="adm-k__field">
              <label>{t("admin.fGenre")}</label>
              <input value={form.genre} onChange={set("genre")} />
            </div>
            <div className="adm-k__field">
              <label>{t("admin.fDurationMin")}</label>
              <input
                type="number"
                value={form.duration}
                onChange={set("duration")}
              />
            </div>
          </div>
          <div className="adm-k__field">
            <label>{t("admin.fDescription")}</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={set("description")}
            />
          </div>
          <div className="adm-k__field">
            <label>{t("admin.fPoster")}</label>
            <input value={form.poster} onChange={set("poster")} />
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
          message={t("admin.confirmDeleteMovie")}
          onConfirm={doDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
