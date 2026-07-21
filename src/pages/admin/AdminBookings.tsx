import { useMemo, useState } from "react";
import {
  useAllShowtimes,
  useMovies,
  useCinemas,
  useRooms,
} from "queries/catalog";
import {
  useAllBookings,
  useUpdateBooking,
  useDeleteBooking,
} from "queries/admin";
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
import type { Booking, Seat } from "types";

export default function AdminBookings() {
  const bookingsQ = useAllBookings();
  const moviesQ = useMovies();
  const bookings = useMemo(() => bookingsQ.data ?? [], [bookingsQ.data]);
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const cinemas = useCinemas().data ?? [];
  const rooms = useRooms().data ?? [];
  const showtimes = useAllShowtimes().data ?? [];
  const updateBk = useUpdateBooking();
  const deleteBk = useDeleteBooking();

  const [q, setQ] = useState("");
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [sel, setSel] = useState<Seat[]>([]);

  const movieMap = useMemo(
    () => Object.fromEntries(movies.map((m) => [m.id, m])),
    [movies],
  );
  const cinemaMap = Object.fromEntries(cinemas.map((c) => [c.id, c]));
  const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const showtimeMap = Object.fromEntries(showtimes.map((s) => [s.id, s]));
  const fmt = (iso?: string) =>
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
    if (cancelId == null) return;
    const showtimeId = bookings.find((b) => b.id === cancelId)?.showtimeId;
    await deleteBk.mutateAsync({ id: cancelId, showtimeId });
    setCancelId(null);
  };

  const editRoom = editing ? roomMap[editing.roomId] : null;
  const editShowtime = editing ? showtimeMap[editing.showtimeId] : null;
  const editLayout = buildSeatLayout(editRoom);
  const editBase = editShowtime?.price || 0;

  // Ghế của các đơn KHÁC cho suất này (loại trừ đơn đang sửa)
  const otherBooked = useMemo(() => {
    if (!editing || !editShowtime) return new Set<string>();
    const others = bookings.filter((b) => b.id !== editing.id);
    return bookedSeatSet(editShowtime, others);
  }, [editing, editShowtime, bookings]);

  const openEdit = (b: Booking) => {
    const room = roomMap[b.roomId];
    const layout = buildSeatLayout(room);
    const all = layout.flatMap((r) => r.seats);
    const seatObjs = (b.seats || [])
      .map((sn) => all.find((s) => s.seatNumber === sn))
      .filter((s): s is Seat => Boolean(s));
    setSel(seatObjs);
    setEditing(b);
  };

  const toggleSeat = (seat: Seat) => {
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
    if (!editing) return;
    const seats = sel.map((s) => s.seatNumber);
    const body = {
      seats,
      seatTypes: { standard: editStd, vip: editVip, couple: editCpl },
      seatTotal: editSeatTotal,
      totalPrice: editTotal,
    };
    await updateBk.mutateAsync({
      id: editing.id,
      body,
      showtimeId: editing.showtimeId,
    });
    setEditing(null);
    setSel([]);
  };

  return (
    <div>
      <div className="adm-k__head">
        <span className="adm-k__eyebrow">Quản trị</span>
        <h1 className="adm-k__title">Đơn đặt vé</h1>
        <span className="adm-k__count">{total} mục</span>
      </div>
      <div className="adm-k__toolbar">
        <input
          className="adm-k__search"
          placeholder="Tìm theo khách hoặc phim..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="adm-k__tablewrap">
        <table className="adm-k__table">
          <thead>
            <tr>
              <th scope="col">Mã</th>
              <th scope="col">Khách</th>
              <th scope="col">Phim</th>
              <th scope="col">Rạp · Phòng</th>
              <th scope="col">Ghế</th>
              <th scope="col">Tổng</th>
              <th scope="col">Suất</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((b) => (
              <tr key={b.id}>
                <td className="num">#TK-{String(b.id).padStart(5, "0")}</td>
                <td>{b.userName}</td>
                <td>{movieMap[b.movieId]?.title || "—"}</td>
                <td>
                  {cinemaMap[b.cinemaId]?.name || "—"}
                  {roomMap[b.roomId] ? ` · ${roomMap[b.roomId].name}` : ""}
                </td>
                <td>{(b.seats || []).join(", ")}</td>
                <td className="num">
                  {(b.totalPrice || 0).toLocaleString("vi-VN")}₫
                </td>
                <td className="num">{fmt(showtimeMap[b.showtimeId]?.time)}</td>
                <td>
                  <div className="adm-k__rowact">
                    <button
                      className="adm-k__btn ghost sm"
                      onClick={() => openEdit(b)}
                    >
                      Sửa ghế
                    </button>
                    <button
                      className="adm-k__btn danger sm"
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
                <td colSpan={8} className="adm-k__empty">
                  Không có đơn đặt vé
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
      {cancelId != null && (
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
          <div className="sgm-k">
            {editLayout.map(({ row, seats }) => (
              <div key={row} className="sgm-k__row">
                <span className="sgm-k__label">{row}</span>
                {seats.map((seat) => {
                  const isBooked = otherBooked.has(seat.seatNumber);
                  const isSel = sel.find(
                    (s) => s.seatNumber === seat.seatNumber,
                  );
                  return (
                    <button
                      key={seat.seatNumber}
                      className={`sgm-k__seat${seat.isVip ? " vip" : ""}${seat.isCouple ? " couple" : ""}${isBooked ? " booked" : ""}${isSel ? " selected" : ""}`}
                      disabled={isBooked}
                      title={`${seat.seatNumber}${seat.isVip ? " · VIP" : ""}${seat.isCouple ? " · Đôi" : ""}`}
                      onClick={() => toggleSeat(seat)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="sgm-k__legend">
            <span>
              <i className="sgm-k__dot" />
              Trống
            </span>
            <span>
              <i className="sgm-k__dot vip" />
              VIP
            </span>
            <span>
              <i className="sgm-k__dot selected" />
              Đang chọn
            </span>
            <span>
              <i className="sgm-k__dot booked" />
              Đã đặt
            </span>
          </div>
          <div className="sgm-k__summary">
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
          <div className="adm-k__modalact">
            <button
              className="adm-k__btn ghost"
              onClick={() => {
                setEditing(null);
                setSel([]);
              }}
            >
              Hủy
            </button>
            <button
              className="adm-k__btn"
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
