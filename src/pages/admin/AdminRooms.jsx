import { useEffect, useMemo, useState } from "react";
import { getRooms, getCinemas, createRoom, updateRoom, deleteRoom, getAllShowtimes } from "services/api";
import Modal from "components/admin/Modal";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import Pagination from "components/admin/Pagination";

const TYPES = ["2D", "3D", "IMAX"];
const EMPTY = { cinemaId: "", name: "", type: "2D", rows: 8, cols: 12, vipRows: "E,F" };

export default function AdminRooms() {
  const [rooms, setRooms] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [q, setQ] = useState("");
  const [cinemaFilter, setCinemaFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const load = () => { getRooms().then(setRooms); getCinemas().then(setCinemas); getAllShowtimes().then(setShowtimes); };
  useEffect(load, []);
  const cinemaName = (id) => cinemas.find(c => c.id === id)?.name || "—";

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rooms.filter(r => {
      const okCinema = cinemaFilter === "all" || r.cinemaId === Number(cinemaFilter);
      const okTerm = !term || r.name.toLowerCase().includes(term) || cinemaName(r.cinemaId).toLowerCase().includes(term);
      return okCinema && okTerm;
    });
  }, [rooms, q, cinemaFilter, cinemas]);

  const { pageItems, page, totalPages, setPage, from, to, total } = usePagination(visible);

  const openNew = () => { setForm(EMPTY); setError(""); setEditing("new"); };
  const openEdit = (r) => { setForm({ cinemaId: r.cinemaId, name: r.name, type: r.type, rows: r.rows, cols: r.cols, vipRows: (r.vipRows || []).join(",") }); setError(""); setEditing(r); };
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.cinemaId || !form.name.trim() || !form.rows || !form.cols) { setError("Nhập đủ rạp, tên, số hàng, số cột."); return; }
    const body = { cinemaId: Number(form.cinemaId), name: form.name.trim(), type: form.type, rows: Number(form.rows), cols: Number(form.cols), vipRows: form.vipRows.split(",").map(s => s.trim().toUpperCase()).filter(Boolean) };
    if (editing === "new") await createRoom(body); else await updateRoom(editing.id, body);
    setEditing(null); load();
  };
  const doDelete = async () => {
    const used = showtimes.filter(s => s.roomId === confirmId).length;
    if (used > 0) { alert(`Không thể xóa: còn ${used} suất chiếu liên quan.`); setConfirmId(null); return; }
    await deleteRoom(confirmId); setConfirmId(null); load();
  };

  return (
    <div>
      <div className="admin-head"><h1 className="admin-title">Phòng</h1></div>
      <div className="admin-toolbar">
        <input className="admin-search" placeholder="Tìm phòng hoặc rạp..." value={q} onChange={e => setQ(e.target.value)} />
        <select className="admin-filter" value={cinemaFilter} onChange={e => setCinemaFilter(e.target.value)}>
          <option value="all">Tất cả rạp</option>
          {cinemas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="admin-btn" onClick={openNew}>+ Thêm phòng</button>
      </div>
      <table className="admin-table">
        <thead><tr><th>Rạp</th><th>Phòng</th><th>Loại</th><th>Layout</th><th>Hàng VIP</th><th></th></tr></thead>
        <tbody>
          {pageItems.map(r => (
            <tr key={r.id}>
              <td>{cinemaName(r.cinemaId)}</td><td>{r.name}</td><td>{r.type}</td>
              <td>{r.rows}×{r.cols}</td><td>{(r.vipRows || []).join(", ") || "—"}</td>
              <td><div className="admin-row-actions">
                <button className="admin-btn ghost small" onClick={() => openEdit(r)}>Sửa</button>
                <button className="admin-btn danger small" onClick={() => setConfirmId(r.id)}>Xóa</button>
              </div></td>
            </tr>
          ))}
          {visible.length === 0 && <tr><td colSpan={6} className="admin-empty">Không có phòng</td></tr>}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} onPage={setPage} from={from} to={to} total={total} />

      {editing && (
        <Modal title={editing === "new" ? "Thêm phòng" : "Sửa phòng"} onClose={() => setEditing(null)}>
          <div className="field-row"><label>Rạp</label>
            <select value={form.cinemaId} onChange={set("cinemaId")}>
              <option value="">— Chọn rạp —</option>
              {cinemas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field-two">
            <div className="field-row"><label>Tên phòng</label><input value={form.name} onChange={set("name")} /></div>
            <div className="field-row"><label>Loại</label><select value={form.type} onChange={set("type")}>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          </div>
          <div className="field-two">
            <div className="field-row"><label>Số hàng</label><input type="number" value={form.rows} onChange={set("rows")} /></div>
            <div className="field-row"><label>Số cột</label><input type="number" value={form.cols} onChange={set("cols")} /></div>
          </div>
          <div className="field-row"><label>Hàng VIP (vd: E,F)</label><input value={form.vipRows} onChange={set("vipRows")} /></div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button className="admin-btn ghost" onClick={() => setEditing(null)}>Hủy</button>
            <button className="admin-btn" onClick={save}>Lưu</button>
          </div>
        </Modal>
      )}
      {confirmId && <ConfirmDialog message="Bạn chắc chắn muốn xóa phòng này?" onConfirm={doDelete} onCancel={() => setConfirmId(null)} />}
    </div>
  );
}
