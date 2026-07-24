import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
} from "services/api";
import type { Review } from "types";
import { qk } from "./keys";

type Id = number | string;

export const useMovieReviews = (movieId: Id): UseQueryResult<Review[]> =>
  useQuery({
    queryKey: qk.reviews(movieId),
    queryFn: () => getReviews(movieId),
  });

export const useCreateReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { movieId: Id; rating: number; comment?: string }) =>
      createReview(v),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.reviews(v.movieId) });
      qc.invalidateQueries({ queryKey: qk.allReviews });
    },
  });
};

export const useUpdateReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      id: Id;
      movieId: Id;
      rating: number;
      comment?: string;
    }) => updateReview(v.id, { rating: v.rating, comment: v.comment }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.reviews(v.movieId) });
      qc.invalidateQueries({ queryKey: qk.allReviews });
    },
  });
};

export const useDeleteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: Id; movieId?: Id }) => deleteReview(v.id),
    onSuccess: (_d, v) => {
      if (v.movieId != null)
        qc.invalidateQueries({ queryKey: qk.reviews(v.movieId) });
      qc.invalidateQueries({ queryKey: qk.allReviews });
    },
  });
};
