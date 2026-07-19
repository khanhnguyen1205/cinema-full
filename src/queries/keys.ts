// Registry query-key tập trung — một nguồn sự thật cho cache & invalidate.
// Key có tham số (movie(id), occupiedSeats(id)...) thêm ở lát sau khi cần.
export const qk = {
  movies: ["movies"] as const,
  cinemas: ["cinemas"] as const,
  cities: ["cities"] as const,
  showtimes: ["showtimes"] as const,
};
