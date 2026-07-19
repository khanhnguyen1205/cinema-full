import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MovieCard from "./MovieCard";
import type { Movie } from "types";

const movie: Movie = {
  id: 7,
  title: "Dune",
  genre: "Sci-Fi",
  duration: 155,
  rating: 8.4,
};

function renderCard(m: Movie) {
  return render(
    <MemoryRouter>
      <MovieCard movie={m} />
    </MemoryRouter>,
  );
}

describe("MovieCard", () => {
  it("hiển thị tên, thể loại, rating", () => {
    renderCard(movie);
    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Sci-Fi")).toBeInTheDocument();
    expect(screen.getByText(/8\.4/)).toBeInTheDocument();
  });

  it("không có poster thì hiện chữ cái đầu", () => {
    renderCard({ ...movie, poster: undefined });
    expect(screen.getByText("D")).toBeInTheDocument();
  });
});
