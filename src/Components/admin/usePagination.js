import { useEffect, useMemo, useState } from "react";

export default function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Reset to a valid page when the list shrinks/grows (after search/delete)
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return { pageItems, page, totalPages, setPage, from, to, total };
}
