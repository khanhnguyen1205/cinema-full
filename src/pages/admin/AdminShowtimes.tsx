import { useMemo, useState } from "react";
import {
  useAllShowtimes,
  useMovies,
  useRooms,
  useCinemas,
} from "queries/catalog";
import {
  useCreateShowtime,
  useUpdateShowtime,
  useDeleteShowtime,
} from "queries/admin";
import { ROOM_TYPE_PRICE } from "lib/pricing";
import Modal from "components/admin/Modal";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import Pagination from "components/admin/Pagination";
import type { Showtime } from "types";

const EMPTY = { movieId: "", roomId: "", date: "", time: "", price: "" };

export default function AdminShowtimes() {
  const showtimesQ = useAllShowtimes();
  const moviesQ = useMovies();
  const roomsQ = useRooms();
  const cinemasQ = useCinemas();
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const createS = useCreateShowtime();
  const updateS = useUpdateShowtime();
  const deleteS = useDeleteShowtime();

  const [q, setQ] = useState("");
  const [cinemaFilter, setCinemaFilter] = useState("all");
  const [editing, setEditing] = useState<Showtime | "new" | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

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
  const roomLabel = (rid: number) => {
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
  const openEdit = (s: Showtime) => {
    setForm({
      movieId: String(s.movieId),
      roomId: String(s.roomId),
      date: s.time.slice(0, 10),
      time: s.time.slice(11, 16),
      price: String(s.price),
    });
    setError("");
    setEditing(s);
  };
  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const v = e.target.value;
      setForm((f) => {
        const next = { ...f, [k]: v };
        if (k === "roomId") {
          const r = roomMap[Number(v)];
          if (r && !next.price) next.price = String(ROOM_TYPE_PRICE[r.type]);
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
      bookedSeats:
        editing === "new" ? [] : editing ? editing.bookedSeats || [] : [],
    };
    if (editing === "new") await createS.mutateAsync(body);
    else if (editing) await updateS.mutateAsync({ id: editing.id, body });
    setEditing(null);
  };
  const doDelete = async () => {
    if (confirmId == null) return;
    await deleteS.mutateAsync(confirmId);
    setConfirmId(null);
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <div className="adm-k__head">
        <span className="adm-k__eyebrow">Quản trị</span>
        <h1 className="adm-k__title">Suất chiếu</h1>
        <span className="adm-k__count">{total} mục</span>
      </div>
      <div className="adm-k__toolbar">
        <input
          className="adm-k__search"
          placeholder="Tìm theo tên phim..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="adm-k__filter"
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
        <button className="adm-k__btn" onClick={openNew}>
          + Thêm suất
        </button>
      </div>
      <div className="adm-k__tablewrap">
        <table className="adm-k__table">
          <thead>
            <tr>
              <th scope="col">Phim</th>
              <th scope="col">Rạp · Phòng</th>
              <th scope="col">Thời gian</th>
              <th scope="col">Giá</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((s) => (
              <tr key={s.id}>
                <td>{movieMap[s.movieId]?.title || "—"}</td>
                <td>{roomLabel(s.roomId)}</td>
                <td className="num">{fmt(s.time)}</td>
                <td className="num">{s.price.toLocaleString("vi-VN")}₫</td>
                <td>
                  <div className="adm-k__rowact">
                    <button
                      className="adm-k__btn ghost sm"
                      onClick={() => openEdit(s)}
                    >
                      Sửa
                    </button>
                    <button
                      className="adm-k__btn danger sm"
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
                <td colSpan={5} className="adm-k__empty">
                  Không có suất chiếu
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
          title={editing === "new" ? "Thêm suất chiếu" : "Sửa suất chiếu"}
          onClose={() => setEditing(null)}
        >
          <div className="adm-k__field">
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
          <div className="adm-k__field">
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
          <div className="adm-k__field-two">
            <div className="adm-k__field">
              <label>Ngày</label>
              <input type="date" value={form.date} onChange={set("date")} />
            </div>
            <div className="adm-k__field">
              <label>Giờ</label>
              <input type="time" value={form.time} onChange={set("time")} />
            </div>
          </div>
          <div className="adm-k__field">
            <label>Giá (₫)</label>
            <input type="number" value={form.price} onChange={set("price")} />
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
          message="Bạn chắc chắn muốn xóa suất chiếu này?"
          onConfirm={doDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
