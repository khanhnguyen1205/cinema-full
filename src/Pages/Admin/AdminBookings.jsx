import { useEffect, useMemo, useState } from "react";
import { getBookings, getMovies, getCinemas, getRooms, getAllShowtimes, deleteBooking } from "../../Services/api";
import ConfirmDialog from "../../Components/admin/ConfirmDialog";

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [movies, setMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [q, setQ] = useState("");
  const [cancelId, setCancelId] = useState(null);

  useEffect(() => {
    getBookings().then(setBookings); getMovies().then(setMovies);
    getCinemas().then(setCinemas); getRooms().then(setRooms); getAllShowtimes().then(setShowtimes);
  }, []);

  const movieMap = Object.fromEntries(movies.map(m => [m.id, m]));
  const cinemaMap = Object.fromEntries(cinemas.map(c => [c.id, c]));
  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));
  const showtimeMap = Object.fromEntries(showtimes.map(s => [s.id, s]));
  const fmt = (iso) => iso ? new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return bookings.filter(b => !term || (b.userName || "").toLowerCase().includes(term) || (movieMap[b.movieId]?.title || "").toLowerCase().includes(term));
  }, [bookings, q, movies]);

  const doCancel = async () => {
    await deleteBooking(cancelId);
    setBookings(prev => prev.filter(b => b.id !== cancelId));
    setCancelId(null);
  };

  return (
    <div>
      <div className="admin-head"><h1 className="admin-title">Đơn đặt vé</h1></div>
      <div className="admin-toolbar">
        <input className="admin-search" placeholder="Tìm theo khách hoặc phim..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <table className="admin-table">
        <thead><tr><th>Mã</th><th>Khách</th><th>Phim</th><th>Rạp · Phòng</th><th>Ghế</th><th>Tổng</th><th>Suất</th><th>Thao tác</th></tr></thead>
        <tbody>
          {visible.map(b => (
            <tr key={b.id}>
              <td>#TK-{String(b.id).padStart(5, "0")}</td>
              <td>{b.userName}</td>
              <td>{movieMap[b.movieId]?.title || "—"}</td>
              <td>{cinemaMap[b.cinemaId]?.name || "—"}{roomMap[b.roomId] ? ` · ${roomMap[b.roomId].name}` : ""}</td>
              <td>{(b.seats || []).join(", ")}</td>
              <td>{(b.totalPrice || 0).toLocaleString("vi-VN")}₫</td>
              <td>{fmt(showtimeMap[b.showtimeId]?.time)}</td>
              <td><div className="admin-row-actions">
                <button className="admin-btn danger small" onClick={() => setCancelId(b.id)}>Hủy</button>
              </div></td>
            </tr>
          ))}
          {visible.length === 0 && <tr><td colSpan={8} className="admin-empty">Không có đơn đặt vé</td></tr>}
        </tbody>
      </table>
      {cancelId && <ConfirmDialog message="Bạn chắc chắn muốn hủy đơn đặt vé này? Ghế sẽ được mở lại." onConfirm={doCancel} onCancel={() => setCancelId(null)} />}
    </div>
  );
}
