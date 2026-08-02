import { useTranslation } from "react-i18next";
import Pagination from "components/admin/Pagination";
import type { Pagination as PageState } from "hooks/usePagination";
import type { Cinema } from "types";

// Các mảnh khung dùng chung của 6 trang quản trị. Chúng cố tình chỉ dựng lại
// đúng DOM cũ (tên class là hợp đồng với e2e), không thêm hành vi nào.

export function AdminHead({ title, count }: { title: string; count?: number }) {
  const { t } = useTranslation();
  return (
    <div className="adm-k__head">
      <span className="adm-k__eyebrow">{t("admin.role")}</span>
      <h1 className="adm-k__title">{title}</h1>
      {count != null && (
        <span className="adm-k__count">{t("admin.items", { count })}</span>
      )}
    </div>
  );
}

export function SearchBox({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className="adm-k__search"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function CinemaFilter({
  cinemas,
  value,
  onChange,
}: {
  cinemas: Cinema[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <select
      className="adm-k__filter"
      aria-label={t("admin.cinemaFilter")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="all">{t("admin.allCinemas")}</option>
      {cinemas.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

/** Cặp nút cuối mỗi dòng bảng; nhãn mặc định là "Sửa" / "Xóa". */
export function RowActions({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: {
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="adm-k__rowact">
      <button className="adm-k__btn ghost sm" onClick={onEdit}>
        {editLabel ?? t("admin.edit")}
      </button>
      <button className="adm-k__btn danger sm" onClick={onDelete}>
        {deleteLabel ?? t("admin.delete")}
      </button>
    </div>
  );
}

export function ModalActions({
  onCancel,
  onSave,
  saveDisabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="adm-k__modalact">
      <button className="adm-k__btn ghost" onClick={onCancel}>
        {t("admin.cancel")}
      </button>
      <button className="adm-k__btn" disabled={saveDisabled} onClick={onSave}>
        {t("admin.save")}
      </button>
    </div>
  );
}

/** `usePagination` trả `setPage`, `Pagination` nhận `onPage` — nối hai đầu lại. */
export function TablePager({
  page,
  totalPages,
  setPage,
  from,
  to,
  total,
}: Omit<PageState<unknown>, "pageItems">) {
  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      onPage={setPage}
      from={from}
      to={to}
      total={total}
    />
  );
}
