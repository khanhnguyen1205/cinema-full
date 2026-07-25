import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Movie } from "types";
import { Badge, Tag } from "components/ui";
import { genreLabel } from "i18n/genres";
import "./MovieCard.css";

export default function MovieCard({ movie }: { movie: Movie }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [imgOk, setImgOk] = useState(true);
  return (
    <button className="movie-k" onClick={() => navigate(`/movie/${movie.id}`)}>
      <span className="movie-k__media">
        {movie.poster && imgOk ? (
          <img
            className="movie-k__poster"
            src={movie.poster}
            alt={movie.title}
            loading="lazy"
            onError={() => setImgOk(false)}
          />
        ) : (
          <span className="movie-k__initial">{movie.title[0]}</span>
        )}
        {movie.rating != null && (
          <Badge className="movie-k__badge">★ {movie.rating.toFixed(1)}</Badge>
        )}
        <Tag className="movie-k__tag">{genreLabel(movie.genre)}</Tag>
      </span>
      <span className="movie-k__info">
        <span className="movie-k__title">{movie.title}</span>
        <span className="movie-k__meta">
          {genreLabel(movie.genre)} · {movie.duration} {t("common.minutes")}
        </span>
      </span>
    </button>
  );
}
