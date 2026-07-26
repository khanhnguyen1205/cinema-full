import { useTranslation } from "react-i18next";

export default function Pagination({
  page,
  totalPages,
  onPage,
  from,
  to,
  total,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  from: number;
  to: number;
  total: number;
}) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <div className="adm-k__pag">
      <span className="adm-k__pag-info">
        {from}–{to} / {total}
      </span>
      <div className="adm-k__pag-ctrl">
        <button
          className="adm-k__btn ghost sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={t("admin.pagPrev")}
        >
          ‹
        </button>
        <span className="adm-k__pag-page">
          {t("admin.pagPage", { page, total: totalPages })}
        </span>
        <button
          className="adm-k__btn ghost sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label={t("admin.pagNext")}
        >
          ›
        </button>
      </div>
    </div>
  );
}
