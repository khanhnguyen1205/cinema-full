import { useEffect, useMemo, useState } from "react";
import {
  getAllShowtimes,
  getMovies,
  getRooms,
  getCinemas,
  createShowtime,
  updateShowtime,
  deleteShowtime,
} from "services/api";
import { ROOM_TYPE_PRICE } from "lib/pricing";
import Modal from "components/admin/Modal";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import Pagination from "components/admin/Pagination";

const EMPTY = { movieId: "", roomId: "", date: "", time: "", price: "" };

export default function AdminShowtimes() {
  const [showtimes, setShowtimes] = useState([]);
  const [movies, setMovies] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [q, setQ] = useState("");
  const [cinemaFilter, setCinemaFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const load = () => {
    getAllShowtimes().then(setShowtimes);
    getMovies().then(setMovies);
    getRooms().then(setRooms);
    getCinemas().then(setCinemas);
  };
  useEffect(load, []);

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
  const roomLabel = (rid) => {
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
  const openEdit = (s) => {
    setForm({
      movieId: s.movieId,
      roomId: s.roomId,
      date: s.time.slice(0, 10),
      time: s.time.slice(11, 16),
      price: s.price,
    });
    setError("");
    setEditing(s);
  };
  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "roomId") {
        const r = roomMap[Number(v)];
        if (r && !next.price) next.price = ROOM_TYPE_PRICE[r.type];
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
      setError("Nhập đủ phim, phòng, ngày, giờ, giá.");
      return;
    }
    const body = {
      movieId: Number(form.movieId),
      roomId: Number(form.roomId),
      time: `${form.date}T${form.time}:00`,
      price: Number(form.price),
      bookedSeats: editing === "new" ? [] : editing.bookedSeats || [],
    };
    if (editing === "new") await createShowtime(body);
    else await updateShowtime(editing.id, body);
    setEditing(null);
    load();
  };
  const doDelete = async () => {
    await deleteShowtime(confirmId);
    setConfirmId(null);
    load();
  };

  const fmt = (iso) =>
    new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <div className="admin-head">
        <h1 className="admin-title">Suất chiếu</h1>
      </div>
      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="Tìm theo tên phim..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="admin-filter"
          value={cinemaFilter}
          onChange={(e) => setCinemaFilter(e.target.value)}
        >
          <option value="all">Tất cả rạp</option>
          {cinemas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="admin-btn" onClick={openNew}>
          + Thêm suất
        </button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Phim</th>
            <th>Rạp · Phòng</th>
            <th>Thời gian</th>
            <th>Giá</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((s) => (
            <tr key={s.id}>
              <td>{movieMap[s.movieId]?.title || "—"}</td>
              <td>{roomLabel(s.roomId)}</td>
              <td>{fmt(s.time)}</td>
              <td>{s.price.toLocaleString("vi-VN")}₫</td>
              <td>
                <div className="admin-row-actions">
                  <button
                    className="admin-btn ghost small"
                    onClick={() => openEdit(s)}
                  >
                    Sửa
                  </button>
                  <button
                    className="admin-btn danger small"
                    onClick={() => setConfirmId(s.id)}
                  >
                    Xóa
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={5} className="admin-empty">
                Không có suất chiếu
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
          title={editing === "new" ? "Thêm suất chiếu" : "Sửa suất chiếu"}
          onClose={() => setEditing(null)}
        >
          <div className="field-row">
            <label>Phim</label>
            <select value={form.movieId} onChange={set("movieId")}>
              <option value="">— Chọn phim —</option>
              {movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <label>Phòng (Rạp · Phòng · Loại)</label>
            <select value={form.roomId} onChange={set("roomId")}>
              <option value="">— Chọn phòng —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {roomLabel(r.id)}
                </option>
              ))}
            </select>
          </div>
          <div className="field-two">
            <div className="field-row">
              <label>Ngày</label>
              <input type="date" value={form.date} onChange={set("date")} />
            </div>
            <div className="field-row">
              <label>Giờ</label>
              <input type="time" value={form.time} onChange={set("time")} />
            </div>
          </div>
          <div className="field-row">
            <label>Giá (₫)</label>
            <input type="number" value={form.price} onChange={set("price")} />
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button
              className="admin-btn ghost"
              onClick={() => setEditing(null)}
            >
              Hủy
            </button>
            <button className="admin-btn" onClick={save}>
              Lưu
            </button>
          </div>
        </Modal>
      )}
      {confirmId && (
        <ConfirmDialog
          message="Bạn chắc chắn muốn xóa suất chiếu này?"
          onConfirm={doDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
