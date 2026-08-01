import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRooms, useCinemas, useAllShowtimes } from "queries/catalog";
import { useCreateRoom, useUpdateRoom, useDeleteRoom } from "queries/admin";
import Modal from "components/admin/Modal";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import Pagination from "components/admin/Pagination";
import type { Room } from "types";

const TYPES = ["2D", "3D", "IMAX"];
const EMPTY = {
  cinemaId: "",
  name: "",
  type: "2D",
  rows: "8",
  cols: "12",
  vipRows: "E,F",
};

export default function AdminRooms() {
  const { t } = useTranslation();
  const roomsQ = useRooms();
  const cinemasQ = useCinemas();
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const showtimes = useAllShowtimes().data ?? [];
  const createR = useCreateRoom();
  const updateR = useUpdateRoom();
  const deleteR = useDeleteRoom();

  const [q, setQ] = useState("");
  const [cinemaFilter, setCinemaFilter] = useState("all");
  const [editing, setEditing] = useState<Room | "new" | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const cinemaName = useCallback(
    (id: number) => cinemas.find((c) => c.id === id)?.name || "—",
    [cinemas],
  );

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rooms.filter((r) => {
      const okCinema =
        cinemaFilter === "all" || r.cinemaId === Number(cinemaFilter);
      const okTerm =
        !term ||
        r.name.toLowerCase().includes(term) ||
        cinemaName(r.cinemaId).toLowerCase().includes(term);
      return okCinema && okTerm;
    });
  }, [rooms, q, cinemaFilter, cinemaName]);

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(visible);

  const openNew = () => {
    setForm(EMPTY);
    setError("");
    setEditing("new");
  };
  const openEdit = (r: Room) => {
    setForm({
      cinemaId: String(r.cinemaId),
      name: r.name,
      type: r.type,
      rows: String(r.rows),
      cols: String(r.cols),
      vipRows: (r.vipRows || []).join(","),
    });
    setError("");
    setEditing(r);
  };
  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.cinemaId || !form.name.trim() || !form.rows || !form.cols) {
      setError(t("admin.roomsFormErr"));
      return;
    }
    const body = {
      cinemaId: Number(form.cinemaId),
      name: form.name.trim(),
      type: form.type as Room["type"],
      rows: Number(form.rows),
      cols: Number(form.cols),
      vipRows: form.vipRows
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    };
    if (editing === "new") await createR.mutateAsync(body);
    else if (editing) await updateR.mutateAsync({ id: editing.id, body });
    setEditing(null);
  };
  const doDelete = async () => {
    if (confirmId == null) return;
    const used = showtimes.filter((s) => s.roomId === confirmId).length;
    if (used > 0) {
      alert(t("admin.inUseShowtimes", { count: used }));
      setConfirmId(null);
      return;
    }
    await deleteR.mutateAsync(confirmId);
    setConfirmId(null);
  };

  return (
    <div>
      <div className="adm-k__head">
        <span className="adm-k__eyebrow">{t("admin.role")}</span>
        <h1 className="adm-k__title">{t("admin.roomsTitle")}</h1>
        <span className="adm-k__count">
          {t("admin.items", { count: total })}
        </span>
      </div>
      <div className="adm-k__toolbar">
        <input
          className="adm-k__search"
          placeholder={t("admin.roomSearchPh")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="adm-k__filter"
          aria-label={t("admin.cinemaFilter")}
          value={cinemaFilter}
          onChange={(e) => setCinemaFilter(e.target.value)}
        >
          <option value="all">{t("admin.allCinemas")}</option>
          {cinemas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="adm-k__btn" onClick={openNew}>
          {t("admin.addRoom")}
        </button>
      </div>
      <div className="adm-k__tablewrap">
        <table className="adm-k__table">
          <thead>
            <tr>
              <th scope="col">{t("admin.thCinema")}</th>
              <th scope="col">{t("admin.thRoom")}</th>
              <th scope="col">{t("admin.thType")}</th>
              <th scope="col">{t("admin.thLayout")}</th>
              <th scope="col">{t("admin.thVipRows")}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r) => (
              <tr key={r.id}>
                <td>{cinemaName(r.cinemaId)}</td>
                <td>{r.name}</td>
                <td>{r.type}</td>
                <td className="num">
                  {r.rows}×{r.cols}
                </td>
                <td>{(r.vipRows || []).join(", ") || "—"}</td>
                <td>
                  <div className="adm-k__rowact">
                    <button
                      className="adm-k__btn ghost sm"
                      onClick={() => openEdit(r)}
                    >
                      {t("admin.edit")}
                    </button>
                    <button
                      className="adm-k__btn danger sm"
                      onClick={() => setConfirmId(r.id)}
                    >
                      {t("admin.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="adm-k__empty">
                  {t("admin.roomsEmpty")}
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
          title={editing === "new" ? t("admin.newRoom") : t("admin.editRoom")}
          onClose={() => setEditing(null)}
        >
          <div className="adm-k__field">
            <label htmlFor="adm-room-cinema">{t("admin.thCinema")}</label>
            <select
              id="adm-room-cinema"
              value={form.cinemaId}
              onChange={set("cinemaId")}
            >
              <option value="">{t("admin.chooseCinema")}</option>
              {cinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="adm-k__field-two">
            <div className="adm-k__field">
              <label htmlFor="adm-room-name">{t("admin.fRoomName")}</label>
              <input
                id="adm-room-name"
                value={form.name}
                onChange={set("name")}
              />
            </div>
            <div className="adm-k__field">
              <label htmlFor="adm-room-type">{t("admin.fType")}</label>
              <select
                id="adm-room-type"
                value={form.type}
                onChange={set("type")}
              >
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {ty}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="adm-k__field-two">
            <div className="adm-k__field">
              <label htmlFor="adm-room-rows">{t("admin.fRows")}</label>
              <input
                id="adm-room-rows"
                type="number"
                value={form.rows}
                onChange={set("rows")}
              />
            </div>
            <div className="adm-k__field">
              <label htmlFor="adm-room-cols">{t("admin.fCols")}</label>
              <input
                id="adm-room-cols"
                type="number"
                value={form.cols}
                onChange={set("cols")}
              />
            </div>
          </div>
          <div className="adm-k__field">
            <label htmlFor="adm-room-viprows">{t("admin.fVipRows")}</label>
            <input
              id="adm-room-viprows"
              value={form.vipRows}
              onChange={set("vipRows")}
            />
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
          message={t("admin.confirmDeleteRoom")}
          onConfirm={doDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
