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
          aria-label="Trang trước"
        >
          ‹
        </button>
        <span className="adm-k__pag-page">
          Trang {page}/{totalPages}
        </span>
        <button
          className="adm-k__btn ghost sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Trang sau"
        >
          ›
        </button>
      </div>
    </div>
  );
}
