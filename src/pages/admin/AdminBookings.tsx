import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAllShowtimes,
  useMovies,
  useCinemas,
  useRooms,
} from "queries/catalog";
import { formatPrice } from "i18n/format";
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
import type { Booking, Seat } from "types";
import {
  AdminHead,
  ModalActions,
  RowActions,
  SearchBox,
  TablePager,
} from "./AdminUI";
import { adminDateTime, useById, useConfirmDelete } from "./adminUtils";

const bookingCode = (id: number) => `#TK-${String(id).padStart(5, "0")}`;

export default function AdminBookings() {
  const { t } = useTranslation();
  const bookingsQ = useAllBookings();
  const moviesQ = useMovies();
  const cinemasQ = useCinemas();
  const roomsQ = useRooms();
  const showtimesQ = useAllShowtimes();
  const bookings = useMemo(() => bookingsQ.data ?? [], [bookingsQ.data]);
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const updateBk = useUpdateBooking();
  const deleteBk = useDeleteBooking();

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Booking | null>(null);
  const [sel, setSel] = useState<Seat[]>([]);

  const movieMap = useById(movies);
  const cinemaMap = useById(cinemas);
  const roomMap = useById(rooms);
  const showtimeMap = useById(showtimes);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return bookings.filter(
      (b) =>
        !term ||
        (b.userName || "").toLowerCase().includes(term) ||
        (movieMap[b.movieId]?.title || "").toLowerCase().includes(term),
    );
  }, [bookings, q, movieMap]);

  const { pageItems, ...pag } = usePagination(visible);

  const cancelBk = useConfirmDelete((id) =>
    deleteBk.mutateAsync({
      id,
      showtimeId: bookings.find((b) => b.id === id)?.showtimeId,
    }),
  );

  const editShowtime = editing ? showtimeMap[editing.showtimeId] : null;
  const editLayout = buildSeatLayout(editing ? roomMap[editing.roomId] : null);
  const editBase = editShowtime?.price || 0;

  // Ghế của các đơn KHÁC cho suất này (loại trừ đơn đang sửa)
  const otherBooked = useMemo(() => {
    if (!editing || !editShowtime) return new Set<string>();
    const others = bookings.filter((b) => b.id !== editing.id);
    return bookedSeatSet(editShowtime, others);
  }, [editing, editShowtime, bookings]);

  const openEdit = (b: Booking) => {
    const all = buildSeatLayout(roomMap[b.roomId]).flatMap((r) => r.seats);
    setSel(
      (b.seats || [])
        .map((sn) => all.find((s) => s.seatNumber === sn))
        .filter((s): s is Seat => Boolean(s)),
    );
    setEditing(b);
  };

  const closeEdit = () => {
    setEditing(null);
    setSel([]);
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
    const body = {
      seats: sel.map((s) => s.seatNumber),
      seatTypes: { standard: editStd, vip: editVip, couple: editCpl },
      seatTotal: editSeatTotal,
      totalPrice: editTotal,
    };
    await updateBk.mutateAsync({
      id: editing.id,
      body,
      showtimeId: editing.showtimeId,
    });
    closeEdit();
  };

  return (
    <div>
      <AdminHead title={t("admin.bookingsTitle")} count={pag.total} />
      <div className="adm-k__toolbar">
        <SearchBox
          placeholder={t("admin.bookingSearchPh")}
          value={q}
          onChange={setQ}
        />
      </div>
      <div className="adm-k__tablewrap">
        <table className="adm-k__table">
          <thead>
            <tr>
              <th scope="col">{t("admin.thCode")}</th>
              <th scope="col">{t("admin.thCustomer")}</th>
              <th scope="col">{t("admin.fMovie")}</th>
              <th scope="col">{t("admin.thRoomCinema")}</th>
              <th scope="col">{t("admin.thSeats")}</th>
              <th scope="col">{t("admin.thTotal")}</th>
              <th scope="col">{t("admin.thShowtime")}</th>
              <th scope="col">{t("admin.thActions")}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((b) => {
              const room = roomMap[b.roomId];
              return (
                <tr key={b.id}>
                  <td className="num">{bookingCode(b.id)}</td>
                  <td>{b.userName}</td>
                  <td>{movieMap[b.movieId]?.title || "—"}</td>
                  <td>
                    {cinemaMap[b.cinemaId]?.name || "—"}
                    {room ? ` · ${room.name}` : ""}
                  </td>
                  <td>{(b.seats || []).join(", ")}</td>
                  <td className="num">
                    {formatPrice(b.totalPrice || 0)}
                    {b.paymentRef ? ` · ${t("booking.paidBadge")}` : ""}
                  </td>
                  <td className="num">
                    {adminDateTime(showtimeMap[b.showtimeId]?.time)}
                  </td>
                  <td>
                    <RowActions
                      onEdit={() => openEdit(b)}
                      onDelete={() => cancelBk.ask(b.id)}
                      editLabel={t("admin.editSeats")}
                      deleteLabel={t("admin.cancel")}
                    />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="adm-k__empty">
                  {t("admin.bookingsEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePager {...pag} />
      {cancelBk.confirmId != null && (
        <ConfirmDialog
          message={t("admin.confirmCancelBooking")}
          onConfirm={cancelBk.confirm}
          onCancel={cancelBk.cancel}
        />
      )}
      {editing && (
        <Modal
          title={t("admin.editSeatsTitle", { code: bookingCode(editing.id) })}
          onClose={closeEdit}
        >
          <div className="sgm-k">
            {editLayout.map(({ row, seats }) => (
              <div key={row} className="sgm-k__row">
                <span className="sgm-k__label">{row}</span>
                {seats.map((seat) => {
                  const isBooked = otherBooked.has(seat.seatNumber);
                  const isSel = sel.some(
                    (s) => s.seatNumber === seat.seatNumber,
                  );
                  return (
                    <button
                      key={seat.seatNumber}
                      className={`sgm-k__seat${seat.isVip ? " vip" : ""}${seat.isCouple ? " couple" : ""}${isBooked ? " booked" : ""}${isSel ? " selected" : ""}`}
                      disabled={isBooked}
                      title={`${seat.seatNumber}${seat.isVip ? " · VIP" : ""}${seat.isCouple ? ` · ${t("admin.coupleTitle")}` : ""}`}
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
              {t("admin.legFree")}
            </span>
            <span>
              <i className="sgm-k__dot vip" />
              {t("admin.legVip")}
            </span>
            <span>
              <i className="sgm-k__dot selected" />
              {t("admin.legSelecting")}
            </span>
            <span>
              <i className="sgm-k__dot booked" />
              {t("admin.legBooked")}
            </span>
          </div>
          <div className="sgm-k__summary">
            <span>
              {t("admin.seatsLabel")}{" "}
              {sel.length
                ? sel.map((s) => s.seatNumber).join(", ")
                : t("admin.seatsNone")}
            </span>
            <span>
              {t("admin.seatBreakdown", { std: editStd, vip: editVip })}
              {editCpl ? t("admin.seatCoupleSuffix", { count: editCpl }) : ""}
            </span>
            <strong>{formatPrice(editTotal)}</strong>
          </div>
          <ModalActions
            onCancel={closeEdit}
            onSave={saveSeats}
            saveDisabled={sel.length === 0}
          />
        </Modal>
      )}
    </div>
  );
}
