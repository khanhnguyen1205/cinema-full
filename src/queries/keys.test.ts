import { describe, it, expect } from "vitest";
import { qk } from "./keys";

describe("qk (query-key registry)", () => {
  it("khai báo key ổn định cho các collection Home", () => {
    expect(qk.movies).toEqual(["movies"]);
    expect(qk.cinemas).toEqual(["cinemas"]);
    expect(qk.cities).toEqual(["cities"]);
    expect(qk.showtimes).toEqual(["showtimes"]);
  });
});
