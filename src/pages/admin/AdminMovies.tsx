import { useMemo, useState } from "react";
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
      setError("Nhập đủ tên, thể loại, thời lượng.");
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
      alert(`Không thể xóa: còn ${used} suất chiếu liên quan.`);
      setConfirmId(null);
      return;
    }
    await deleteM.mutateAsync(confirmId);
    setConfirmId(null);
  };

  return (
    <div>
      <div className="adm-k__head">
        <span className="adm-k__eyebrow">Quản trị</span>
        <h1 className="adm-k__title">Phim</h1>
        <span className="adm-k__count">{total} mục</span>
      </div>
      <div className="adm-k__toolbar">
        <input
          className="adm-k__search"
          placeholder="Tìm phim theo tên..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="adm-k__btn" onClick={openNew}>
          + Thêm phim
        </button>
      </div>
      <div className="adm-k__tablewrap">
        <table className="adm-k__table">
          <thead>
            <tr>
              <th scope="col">Tên</th>
              <th scope="col">Thể loại</th>
              <th scope="col">Thời lượng</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((m) => (
              <tr key={m.id}>
                <td>{m.title}</td>
                <td>{m.genre}</td>
                <td className="num">{m.duration} phút</td>
                <td>
                  <div className="adm-k__rowact">
                    <button
                      className="adm-k__btn ghost sm"
                      onClick={() => openEdit(m)}
                    >
                      Sửa
                    </button>
                    <button
                      className="adm-k__btn danger sm"
                      onClick={() => setConfirmId(m.id)}
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="adm-k__empty">
                  Không có phim
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
          title={editing === "new" ? "Thêm phim" : "Sửa phim"}
          onClose={() => setEditing(null)}
        >
          <div className="adm-k__field">
            <label>Tên phim</label>
            <input value={form.title} onChange={set("title")} />
          </div>
          <div className="adm-k__field-two">
            <div className="adm-k__field">
              <label>Thể loại</label>
              <input value={form.genre} onChange={set("genre")} />
            </div>
            <div className="adm-k__field">
              <label>Thời lượng (phút)</label>
              <input
                type="number"
                value={form.duration}
                onChange={set("duration")}
              />
            </div>
          </div>
          <div className="adm-k__field">
            <label>Mô tả</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={set("description")}
            />
          </div>
          <div className="adm-k__field">
            <label>Poster (URL, tùy chọn)</label>
            <input value={form.poster} onChange={set("poster")} />
          </div>
          {error && <div className="adm-k__formerr">{error}</div>}
          <div className="adm-k__modalact">
            <button
              className="adm-k__btn ghost"
              onClick={() => setEditing(null)}
            >
              Hủy
            </button>
            <button className="adm-k__btn" onClick={save}>
              Lưu
            </button>
          </div>
        </Modal>
      )}
      {confirmId != null && (
        <ConfirmDialog
          message="Bạn chắc chắn muốn xóa phim này?"
          onConfirm={doDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
