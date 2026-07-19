// Registry query-key tập trung — một nguồn sự thật cho cache & invalidate.
// Key có tham số (movie(id), occupiedSeats(id)...) thêm ở lát sau khi cần.
export const qk = {
  movies: ["movies"] as const,
  cinemas: ["cinemas"] as const,
  cities: ["cities"] as const,
  showtimes: ["showtimes"] as const,
  rooms: ["rooms"] as const,
  movie: (id: number | string) => ["movie", id] as const,
  showtimesByMovie: (id: number | string) =>
    ["showtimes", "byMovie", id] as const,
  cinema: (id: number | string) => ["cinema", id] as const,
  showtimesByCinema: (id: number | string) =>
    ["showtimes", "byCinema", id] as const,
};
