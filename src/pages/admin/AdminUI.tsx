import { useState, type ChangeEvent } from "react";
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

// Ô nhập đường dẫn ảnh KÈM ảnh xem trước.
//
// Đây là chỗ đúng để bắt lỗi ảnh. Cổng dữ liệu chỉ kiểm được dạng đường dẫn —
// nó không thể đi tải ảnh về mà không làm request ghi treo theo máy chủ bên
// thứ ba. Còn ở đây thì trình duyệt vốn ĐANG tải ảnh để hiện, nên biết ngay
// ảnh có thật không và khung ngang hay dọc. Dán sai là thấy sai trong một
// giây, không phải đợi tới lúc có người mở trang chủ.
export function ImageField({
  id,
  label,
  value,
  onChange,
  placeholder,
  shape,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  shape: "portrait" | "landscape";
}) {
  const { t } = useTranslation();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const url = value.trim();

  const ratio = size ? size.w / size.h : 0;
  const wrongShape =
    size !== null && (shape === "landscape" ? ratio < 1.2 : ratio > 0.9);

  return (
    <div className="adm-k__field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setSize(null);
          setFailed(false);
          onChange(e);
        }}
      />
      {url !== "" && (
        <div className={"adm-k__imgprev is-" + shape}>
          {failed ? (
            <span className="adm-k__imgmsg is-bad">{t("admin.imgBad")}</span>
          ) : (
            <>
              <img
                src={url}
                alt=""
                onLoad={(e) =>
                  setSize({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
                onError={() => setFailed(true)}
              />
              <span
                className={"adm-k__imgmsg" + (wrongShape ? " is-warn" : "")}
              >
                {size === null
                  ? t("admin.imgLoading")
                  : wrongShape
                    ? t(
                        shape === "landscape"
                          ? "admin.imgWantLandscape"
                          : "admin.imgWantPortrait",
                        { w: size.w, h: size.h },
                      )
                    : `${size.w}×${size.h}`}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
