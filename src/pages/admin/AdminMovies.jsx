import { useEffect, useMemo, useState } from "react";
import { getMovies, createMovie, updateMovie, deleteMovie, getAllShowtimes } from "services/api";
import Modal from "components/admin/Modal";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import Pagination from "components/admin/Pagination";

const EMPTY = { title: "", genre: "", duration: "", description: "", poster: "" };

export default function AdminMovies() {
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null); // null | movie | "new"
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const load = () => { getMovies().then(setMovies); getAllShowtimes().then(setShowtimes); };
  useEffect(load, []);

  const visible = useMemo(
    () => movies.filter(m => m.title.toLowerCase().includes(q.trim().toLowerCase())),
    [movies, q]
  );

  const { pageItems, page, totalPages, setPage, from, to, total } = usePagination(visible);

  const openNew = () => { setForm(EMPTY); setError(""); setEditing("new"); };
  const openEdit = (m) => { setForm({ title: m.title, genre: m.genre, duration: m.duration, description: m.description || "", poster: m.poster || "" }); setError(""); setEditing(m); };
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.title.trim() || !form.genre.trim() || !form.duration) { setError("Nhập đủ tên, thể loại, thời lượng."); return; }
    const body = { title: form.title.trim(), genre: form.genre.trim(), duration: Number(form.duration), description: form.description, poster: form.poster || "https://via.placeholder.com/200x300" };
    if (editing === "new") await createMovie(body);
    else await updateMovie(editing.id, body);
    setEditing(null); load();
  };

  const doDelete = async () => {
    const used = showtimes.filter(s => s.movieId === confirmId).length;
    if (used > 0) { alert(`Không thể xóa: còn ${used} suất chiếu liên quan.`); setConfirmId(null); return; }
    await deleteMovie(confirmId); setConfirmId(null); load();
  };

  return (
    <div>
      <div className="admin-head"><h1 className="admin-title">Phim</h1></div>
      <div className="admin-toolbar">
        <input className="admin-search" placeholder="Tìm phim theo tên..." value={q} onChange={e => setQ(e.target.value)} />
        <button className="admin-btn" onClick={openNew}>+ Thêm phim</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Tên</th><th>Thể loại</th><th>Thời lượng</th><th></th></tr></thead>
        <tbody>
          {pageItems.map(m => (
            <tr key={m.id}>
              <td>{m.title}</td><td>{m.genre}</td><td>{m.duration} phút</td>
              <td><div className="admin-row-actions">
                <button className="admin-btn ghost small" onClick={() => openEdit(m)}>Sửa</button>
                <button className="admin-btn danger small" onClick={() => setConfirmId(m.id)}>Xóa</button>
              </div></td>
            </tr>
          ))}
          {visible.length === 0 && <tr><td colSpan={4} className="admin-empty">Không có phim</td></tr>}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} onPage={setPage} from={from} to={to} total={total} />

      {editing && (
        <Modal title={editing === "new" ? "Thêm phim" : "Sửa phim"} onClose={() => setEditing(null)}>
          <div className="field-row"><label>Tên phim</label><input value={form.title} onChange={set("title")} /></div>
          <div className="field-two">
            <div className="field-row"><label>Thể loại</label><input value={form.genre} onChange={set("genre")} /></div>
            <div className="field-row"><label>Thời lượng (phút)</label><input type="number" value={form.duration} onChange={set("duration")} /></div>
          </div>
          <div className="field-row"><label>Mô tả</label><textarea rows={3} value={form.description} onChange={set("description")} /></div>
          <div className="field-row"><label>Poster (URL, tùy chọn)</label><input value={form.poster} onChange={set("poster")} /></div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button className="admin-btn ghost" onClick={() => setEditing(null)}>Hủy</button>
            <button className="admin-btn" onClick={save}>Lưu</button>
          </div>
        </Modal>
      )}
      {confirmId && <ConfirmDialog message="Bạn chắc chắn muốn xóa phim này?" onConfirm={doDelete} onCancel={() => setConfirmId(null)} />}
    </div>
  );
}
