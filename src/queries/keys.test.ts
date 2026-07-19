import { describe, it, expect } from "vitest";
import { qk } from "./keys";

describe("qk (query-key registry)", () => {
  it("khai báo key ổn định cho các collection Home", () => {
    expect(qk.movies).toEqual(["movies"]);
    expect(qk.cinemas).toEqual(["cinemas"]);
    expect(qk.cities).toEqual(["cities"]);
    expect(qk.showtimes).toEqual(["showtimes"]);
  });

  it("khai báo key cho rooms và key có tham số của Detail", () => {
    expect(qk.rooms).toEqual(["rooms"]);
    expect(qk.movie(7)).toEqual(["movie", 7]);
    expect(qk.showtimesByMovie(7)).toEqual(["showtimes", "byMovie", 7]);
  });

  it("khai báo key có tham số cho Cinema detail", () => {
    expect(qk.cinema(3)).toEqual(["cinema", 3]);
    expect(qk.showtimesByCinema(3)).toEqual(["showtimes", "byCinema", 3]);
  });
});
