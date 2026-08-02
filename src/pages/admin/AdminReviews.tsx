import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMovies } from "queries/catalog";
import { useAllReviews } from "queries/admin";
import { useDeleteReview } from "queries/reviews";
import ConfirmDialog from "components/admin/ConfirmDialog";
import usePagination from "hooks/usePagination";
import { StarRating } from "components/ui";
import { formatDate } from "i18n/format";
import { AdminHead, SearchBox, TablePager } from "./AdminUI";
import { useConfirmDelete } from "./adminUtils";

export default function AdminReviews() {
  const { t } = useTranslation();
  const reviewsQ = useAllReviews();
  const moviesQ = useMovies();
  const reviews = useMemo(() => reviewsQ.data ?? [], [reviewsQ.data]);
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const deleteM = useDeleteReview();

  const [q, setQ] = useState("");
  const [star, setStar] = useState("all");

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

  const { pageItems, ...pag } = usePagination(visible);

  const del = useConfirmDelete((id) =>
    deleteM.mutateAsync({
      id,
      movieId: reviews.find((r) => r.id === id)?.movieId,
    }),
  );

  return (
    <div>
      <AdminHead title={t("admin.reviewsTitle")} count={pag.total} />
      <div className="adm-k__toolbar">
        <SearchBox
          placeholder={t("admin.reviewSearchPh")}
          value={q}
          onChange={setQ}
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
                    onClick={() => del.ask(r.id)}
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
      <TablePager {...pag} />

      {del.confirmId != null && (
        <ConfirmDialog
          message={t("admin.confirmDeleteReview")}
          onConfirm={del.confirm}
          onCancel={del.cancel}
        />
      )}
    </div>
  );
}
