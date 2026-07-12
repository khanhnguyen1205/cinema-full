export default function Pagination({ page, totalPages, onPage, from, to, total }) {
  if (totalPages <= 1) return null;
  return (
    <div className="admin-pagination">
      <span className="admin-pag-info">{from}–{to} / {total}</span>
      <div className="admin-pag-controls">
        <button className="admin-btn ghost small" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
        <span className="admin-pag-page">Trang {page}/{totalPages}</span>
        <button className="admin-btn ghost small" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>›</button>
      </div>
    </div>
  );
}
