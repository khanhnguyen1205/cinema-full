import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRooms, useCinemas, useAllShowtimes } from "queries/catalog";
import { useCreateRoom, useUpdateRoom, useDeleteRoom } from "queries/admin";
import Modal from "components/admin/Modal";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import type { Room } from "types";
import {
  AdminHead,
  CinemaFilter,
  ModalActions,
  RowActions,
  SearchBox,
  TablePager,
} from "./AdminUI";
import { useAdminForm, useConfirmDelete } from "./adminUtils";

const TYPES = ["2D", "3D", "IMAX"];
const EMPTY = {
  cinemaId: "",
  name: "",
  type: "2D",
  rows: "8",
  cols: "12",
  vipRows: "E,F",
};

const toForm = (r: Room): typeof EMPTY => ({
  cinemaId: String(r.cinemaId),
  name: r.name,
  type: r.type,
  rows: String(r.rows),
  cols: String(r.cols),
  vipRows: (r.vipRows || []).join(","),
});

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
  const { editing, form, error, setError, openNew, openEdit, close, set } =
    useAdminForm<Room, typeof EMPTY>(EMPTY);

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

  const { pageItems, ...pag } = usePagination(visible);

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
    close();
  };

  // Chặn xoá phòng còn suất chiếu: báo bằng alert, không gọi API.
  const del = useConfirmDelete(async (id) => {
    const used = showtimes.filter((s) => s.roomId === id).length;
    if (used > 0) {
      alert(t("admin.inUseShowtimes", { count: used }));
      return;
    }
    await deleteR.mutateAsync(id);
  });

  return (
    <div>
      <AdminHead title={t("admin.roomsTitle")} count={pag.total} />
      <div className="adm-k__toolbar">
        <SearchBox
          placeholder={t("admin.roomSearchPh")}
          value={q}
          onChange={setQ}
        />
        <CinemaFilter
          cinemas={cinemas}
          value={cinemaFilter}
          onChange={setCinemaFilter}
        />
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
                  <RowActions
                    onEdit={() => openEdit(r, toForm(r))}
                    onDelete={() => del.ask(r.id)}
                  />
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
      <TablePager {...pag} />

      {editing && (
        <Modal
          title={editing === "new" ? t("admin.newRoom") : t("admin.editRoom")}
          onClose={close}
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
          <ModalActions onCancel={close} onSave={save} />
        </Modal>
      )}
      {del.confirmId != null && (
        <ConfirmDialog
          message={t("admin.confirmDeleteRoom")}
          onConfirm={del.confirm}
          onCancel={del.cancel}
        />
      )}
    </div>
  );
}
