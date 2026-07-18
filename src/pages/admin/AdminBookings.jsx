import { useEffect, useMemo, useState } from "react";
import {
  getBookings,
  getMovies,
  getCinemas,
  getRooms,
  getAllShowtimes,
  deleteBooking,
  updateBooking,
} from "services/api";
import {
  buildSeatLayout,
  bookedSeatSet,
  priceOf,
  SERVICE_FEE,
} from "lib/pricing";
import ConfirmDialog from "components/admin/ConfirmDialog";
import Modal from "components/admin/Modal";
import usePagination from "hooks/usePagination";
import Pagination from "components/admin/Pagination";

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [movies, setMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [q, setQ] = useState("");
  const [cancelId, setCancelId] = useState(null);
  const [editing, setEditing] = useState(null); // null | booking being edited
  const [sel, setSel] = useState([]); // array of seat objects {seatNumber,row,col,isVip}

  useEffect(() => {
    getBookings().then(setBookings);
    getMovies().then(setMovies);
    getCinemas().then(setCinemas);
    getRooms().then(setRooms);
    getAllShowtimes().then(setShowtimes);
  }, []);

  const movieMap = useMemo(
    () => Object.fromEntries(movies.map((m) => [m.id, m])),
    [movies],
  );
  const cinemaMap = Object.fromEntries(cinemas.map((c) => [c.id, c]));
  const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const showtimeMap = Object.fromEntries(showtimes.map((s) => [s.id, s]));
  const fmt = (iso) =>
    iso
      ? new Date(iso).toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return bookings.filter(
      (b) =>
        !term ||
        (b.userName || "").toLowerCase().includes(term) ||
        (movieMap[b.movieId]?.title || "").toLowerCase().includes(term),
    );
  }, [bookings, q, movieMap]);

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(visible);

  const doCancel = async () => {
    await deleteBooking(cancelId);
    setBookings((prev) => prev.filter((b) => b.id !== cancelId));
    setCancelId(null);
  };

  const editRoom = editing ? roomMap[editing.roomId] : null;
  const editShowtime = editing ? showtimeMap[editing.showtimeId] : null;
  const editLayout = buildSeatLayout(editRoom);
  const editBase = editShowtime?.price || 0;

  // Seats sold to OTHER bookings for this showtime (exclude the booking being edited)
  const otherBooked = useMemo(() => {
    if (!editing || !editShowtime) return new Set();
    const others = bookings.filter((b) => b.id !== editing.id);
    return bookedSeatSet(editShowtime, others);
  }, [editing, editShowtime, bookings]);

  const openEdit = (b) => {
    const room = roomMap[b.roomId];
    const layout = buildSeatLayout(room);
    const all = layout.flatMap((r) => r.seats);
    const seatObjs = (b.seats || [])
      .map((sn) => all.find((s) => s.seatNumber === sn))
      .filter(Boolean);
    setSel(seatObjs);
    setEditing(b);
  };

  const toggleSeat = (seat) => {
    if (otherBooked.has(seat.seatNumber)) return;
    setSel((prev) =>
      prev.find((s) => s.seatNumber === seat.seatNumber)
        ? prev.filter((s) => s.seatNumber !== seat.seatNumber)
        : [...prev, seat],
    );
  };

  const editStd = sel.filter((s) => !s.isVip && !s.isCouple).length;
  const editVip = sel.filter((s) => s.isVip).length;
  const editCpl = sel.filter((s) => s.isCouple).length;
  const editSeatTotal = sel.reduce((sum, s) => sum + priceOf(s, editBase), 0);
  // Giữ nguyên tiền bắp nước của đơn — sửa ghế không đụng tới F&B
  const editTotal =
    editSeatTotal + (editing?.fnbTotal || 0) + (sel.length ? SERVICE_FEE : 0);

  const saveSeats = async () => {
    const seats = sel.map((s) => s.seatNumber);
    const patchBody = {
      seats,
      seatTypes: { standard: editStd, vip: editVip, couple: editCpl },
      seatTotal: editSeatTotal,
      totalPrice: editTotal,
    };
    await updateBooking(editing.id, patchBody);
    setBookings((prev) =>
      prev.map((b) => (b.id === editing.id ? { ...b, ...patchBody } : b)),
    );
    setEditing(null);
    setSel([]);
  };

  return (
    <div>
      <div className="admin-head">
        <h1 className="admin-title">Đơn đặt vé</h1>
      </div>
      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="Tìm theo khách hoặc phim..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Khách</th>
            <th>Phim</th>
            <th>Rạp · Phòng</th>
            <th>Ghế</th>
            <th>Tổng</th>
            <th>Suất</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((b) => (
            <tr key={b.id}>
              <td>#TK-{String(b.id).padStart(5, "0")}</td>
              <td>{b.userName}</td>
              <td>{movieMap[b.movieId]?.title || "—"}</td>
              <td>
                {cinemaMap[b.cinemaId]?.name || "—"}
                {roomMap[b.roomId] ? ` · ${roomMap[b.roomId].name}` : ""}
              </td>
              <td>{(b.seats || []).join(", ")}</td>
              <td>{(b.totalPrice || 0).toLocaleString("vi-VN")}₫</td>
              <td>{fmt(showtimeMap[b.showtimeId]?.time)}</td>
              <td>
                <div className="admin-row-actions">
                  <button
                    className="admin-btn ghost small"
                    onClick={() => openEdit(b)}
                  >
                    Sửa ghế
                  </button>
                  <button
                    className="admin-btn danger small"
                    onClick={() => setCancelId(b.id)}
                  >
                    Hủy
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={8} className="admin-empty">
                Không có đơn đặt vé
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
      {cancelId && (
        <ConfirmDialog
          message="Bạn chắc chắn muốn hủy đơn đặt vé này? Ghế sẽ được mở lại."
          onConfirm={doCancel}
          onCancel={() => setCancelId(null)}
        />
      )}
      {editing && (
        <Modal
          title={`Sửa ghế · #TK-${String(editing.id).padStart(5, "0")}`}
          onClose={() => {
            setEditing(null);
            setSel([]);
          }}
        >
          <div className="seat-grid-mini">
            {editLayout.map(({ row, seats }) => (
              <div key={row} className="sgm-row">
                <span className="sgm-label">{row}</span>
                {seats.map((seat) => {
                  const isBooked = otherBooked.has(seat.seatNumber);
                  const isSel = sel.find(
                    (s) => s.seatNumber === seat.seatNumber,
                  );
                  return (
                    <button
                      key={seat.seatNumber}
                      className={`sgm-seat${seat.isVip ? " vip" : ""}${seat.isCouple ? " couple" : ""}${isBooked ? " booked" : ""}${isSel ? " selected" : ""}`}
                      disabled={isBooked}
                      title={`${seat.seatNumber}${seat.isVip ? " · VIP" : ""}${seat.isCouple ? " · Đôi" : ""}`}
                      onClick={() => toggleSeat(seat)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="sgm-legend">
            <span>
              <i className="sgm-dot available" />
              Trống
            </span>
            <span>
              <i className="sgm-dot vip" />
              VIP
            </span>
            <span>
              <i className="sgm-dot couple" />
              Đôi
            </span>
            <span>
              <i className="sgm-dot selected" />
              Đang chọn
            </span>
            <span>
              <i className="sgm-dot booked" />
              Đã đặt
            </span>
          </div>
          <div className="sgm-summary">
            <span>
              Ghế:{" "}
              {sel.length
                ? sel.map((s) => s.seatNumber).join(", ")
                : "Chưa chọn"}
            </span>
            <span>
              Thường ×{editStd} · VIP ×{editVip}
              {editCpl ? ` · Đôi ×${editCpl}` : ""}
            </span>
            <strong>{editTotal.toLocaleString("vi-VN")}₫</strong>
          </div>
          <div className="modal-actions">
            <button
              className="admin-btn ghost"
              onClick={() => {
                setEditing(null);
                setSel([]);
              }}
            >
              Hủy
            </button>
            <button
              className="admin-btn"
              disabled={sel.length === 0}
              onClick={saveSeats}
            >
              Lưu
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
