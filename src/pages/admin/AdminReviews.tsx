import { useMemo, useState } from "react";
import { useMovies } from "queries/catalog";
import { useAllReviews } from "queries/admin";
import { useDeleteReview } from "queries/reviews";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import Pagination from "components/admin/Pagination";
import { StarRating } from "components/ui";

export default function AdminReviews() {
  const reviewsQ = useAllReviews();
  const moviesQ = useMovies();
  const reviews = useMemo(() => reviewsQ.data ?? [], [reviewsQ.data]);
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const deleteM = useDeleteReview();

  const [q, setQ] = useState("");
  const [star, setStar] = useState("all");
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const movieTitle = useMemo(() => {
    const map = new Map(movies.map((mv) => [mv.id, mv.title]));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [movies]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...reviews]
      .sort((a, b) => b.id - a.id)
      .filter((r) => (star === "all" ? true : r.rating === Number(star)))
      .filter(
        (r) =>
          !needle ||
          r.userName.toLowerCase().includes(needle) ||
          movieTitle(r.movieId).toLowerCase().includes(needle) ||
          (r.comment ?? "").toLowerCase().includes(needle),
      );
  }, [reviews, q, star, movieTitle]);

  const { pageItems, page, totalPages, setPage, from, to, total } =
    usePagination(visible);

  const doDelete = async () => {
    if (confirmId == null) return;
    const r = reviews.find((x) => x.id === confirmId);
    await deleteM.mutateAsync({ id: confirmId, movieId: r?.movieId });
    setConfirmId(null);
  };

  return (
    <div>
      <div className="adm-k__head">
        <span className="adm-k__eyebrow">Quản trị</span>
        <h1 className="adm-k__title">Đánh giá</h1>
        <span className="adm-k__count">{total} mục</span>
      </div>
      <div className="adm-k__toolbar">
        <input
          className="adm-k__search"
          placeholder="Tìm theo phim / người dùng / nội dung..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="adm-k__search"
          value={star}
          onChange={(e) => setStar(e.target.value)}
          aria-label="Lọc theo số sao"
        >
          <option value="all">Tất cả sao</option>
          {[5, 4, 3, 2, 1].map((s) => (
            <option key={s} value={s}>
              {s} sao
            </option>
          ))}
        </select>
      </div>
      <div className="adm-k__tablewrap">
        <table className="adm-k__table">
          <thead>
            <tr>
              <th scope="col">Phim</th>
              <th scope="col">Người dùng</th>
              <th scope="col">Sao</th>
              <th scope="col">Bình luận</th>
              <th scope="col">Đã xem</th>
              <th scope="col">Ngày</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r) => (
              <tr key={r.id}>
                <td>{movieTitle(r.movieId)}</td>
                <td>{r.userName}</td>
                <td>
                  <StarRating value={r.rating} readonly size="sm" />
                </td>
                <td>{r.comment ?? "—"}</td>
                <td className="num">{r.verified ? "✓" : ""}</td>
                <td className="num">
                  {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                </td>
                <td>
                  <button
                    className="adm-k__btn danger sm"
                    onClick={() => setConfirmId(r.id)}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="adm-k__empty">
                  Không có đánh giá
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

      {confirmId != null && (
        <ConfirmDialog
          message="Bạn chắc chắn muốn xóa đánh giá này?"
          onConfirm={doDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
