import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMovies } from "queries/catalog";
import { useAllReviews } from "queries/admin";
import { useDeleteReview } from "queries/reviews";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import Pagination from "components/admin/Pagination";
import { StarRating } from "components/ui";
import { formatDate } from "i18n/format";

export default function AdminReviews() {
  const { t } = useTranslation();
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
        <span className="adm-k__eyebrow">{t("admin.role")}</span>
        <h1 className="adm-k__title">{t("admin.reviewsTitle")}</h1>
        <span className="adm-k__count">
          {t("admin.items", { count: total })}
        </span>
      </div>
      <div className="adm-k__toolbar">
        <input
          className="adm-k__search"
          placeholder={t("admin.reviewSearchPh")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="adm-k__search"
          value={star}
          onChange={(e) => setStar(e.target.value)}
          aria-label={t("admin.starFilter")}
        >
          <option value="all">{t("admin.allStars")}</option>
          {[5, 4, 3, 2, 1].map((s) => (
            <option key={s} value={s}>
              {t("admin.starN", { n: s })}
            </option>
          ))}
        </select>
      </div>
      <div className="adm-k__tablewrap">
        <table className="adm-k__table">
          <thead>
            <tr>
              <th scope="col">{t("admin.fMovie")}</th>
              <th scope="col">{t("admin.thUser")}</th>
              <th scope="col">{t("admin.thStars")}</th>
              <th scope="col">{t("admin.thComment")}</th>
              <th scope="col">{t("admin.thWatched")}</th>
              <th scope="col">{t("admin.thDate")}</th>
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
                <td className="num">{formatDate(r.createdAt)}</td>
                <td>
                  <button
                    className="adm-k__btn danger sm"
                    onClick={() => setConfirmId(r.id)}
                  >
                    {t("admin.delete")}
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="adm-k__empty">
                  {t("admin.reviewsEmpty")}
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
          message={t("admin.confirmDeleteReview")}
          onConfirm={doDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
