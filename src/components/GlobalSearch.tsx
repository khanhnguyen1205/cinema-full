import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useMovies,
  useCinemas,
  useAllShowtimes,
  useRooms,
  useCities,
} from "queries/catalog";
import { normalize, matches, scoreMatch } from "lib/search";
import type { Movie, Cinema, Showtime } from "types";
import "./GlobalSearch.css";

interface ShowResult {
  showtime: Showtime;
  movie?: Movie;
  cinema?: Cinema;
  roomType?: string;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState("");
  const [q, setQ] = useState(""); // đã debounce
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // chỉ số mục đang focus trong danh sách phẳng
  const boxRef = useRef<HTMLDivElement>(null);

  // debounce 150ms
  useEffect(() => {
    const t = setTimeout(() => setQ(raw), 150);
    return () => clearTimeout(t);
  }, [raw]);

  const moviesQ = useMovies();
  const cinemasQ = useCinemas();
  const showtimesQ = useAllShowtimes();
  const roomsQ = useRooms();
  const citiesQ = useCities();

  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const showtimes = useMemo(() => showtimesQ.data ?? [], [showtimesQ.data]);
  const rooms = useMemo(() => roomsQ.data ?? [], [roomsQ.data]);
  const cities = useMemo(() => citiesQ.data ?? [], [citiesQ.data]);

  const qn = normalize(q);

  const cityName = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c.name])),
    [cities],
  );
  const roomById = useMemo(
    () => Object.fromEntries(rooms.map((r) => [r.id, r])),
    [rooms],
  );
  const cinemaById = useMemo(
    () => Object.fromEntries(cinemas.map((c) => [c.id, c])),
    [cinemas],
  );
  const movieById = useMemo(
    () => Object.fromEntries(movies.map((m) => [m.id, m])),
    [movies],
  );

  const movieHits = useMemo(() => {
    if (!qn) return [];
    return movies
      .filter((m) => matches(m.title, qn))
      .sort((a, b) => scoreMatch(b.title, qn) - scoreMatch(a.title, qn))
      .slice(0, 4);
  }, [movies, qn]);

  const cinemaHits = useMemo(() => {
    if (!qn) return [];
    return cinemas
      .filter((c) => matches(c.name, qn) || matches(c.address ?? "", qn))
      .sort((a, b) => scoreMatch(b.name, qn) - scoreMatch(a.name, qn))
      .slice(0, 3);
  }, [cinemas, qn]);

  const showHits = useMemo<ShowResult[]>(() => {
    if (!qn) return [];
    const now = new Date().toISOString();
    return showtimes
      .filter((s) => s.time >= now)
      .map((s) => {
        const room = roomById[s.roomId];
        const cinema = room ? cinemaById[room.cinemaId] : undefined;
        const movie = movieById[s.movieId];
        return { showtime: s, movie, cinema, roomType: room?.type };
      })
      .filter(
        (r) =>
          (r.movie && matches(r.movie.title, qn)) ||
          (r.cinema && matches(r.cinema.name, qn)),
      )
      .sort((a, b) => a.showtime.time.localeCompare(b.showtime.time))
      .slice(0, 4);
  }, [showtimes, roomById, cinemaById, movieById, qn]);

  // danh sách phẳng để điều hướng bàn phím: mỗi phần tử có href
  const flat = useMemo(() => {
    const items: { href: string; key: string }[] = [];
    movieHits.forEach((m) =>
      items.push({ href: `/movie/${m.id}`, key: `m${m.id}` }),
    );
    cinemaHits.forEach((c) =>
      items.push({ href: `/cinema/${c.id}`, key: `c${c.id}` }),
    );
    showHits.forEach((r) =>
      items.push({ href: `/seats/${r.showtime.id}`, key: `s${r.showtime.id}` }),
    );
    if (qn)
      items.push({ href: `/search?q=${encodeURIComponent(q)}`, key: "all" });
    return items;
  }, [movieHits, cinemaHits, showHits, qn, q]);

  const hasResults = movieHits.length + cinemaHits.length + showHits.length > 0;
  const loading = moviesQ.isLoading || cinemasQ.isLoading;
  const showDropdown = open && qn.length > 0 && !loading;

  // đóng khi click ngoài
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // reset con trỏ khi kết quả đổi
  useEffect(() => setActive(-1), [q]);

  const go = (href: string) => {
    setOpen(false);
    setRaw("");
    navigate(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      if (active >= 0 && flat[active]) go(flat[active].href);
      else if (qn) go(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div className="gsearch" ref={boxRef}>
      <div className="gsearch__box">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="gsearch-list"
          aria-label="Tìm phim, rạp, suất chiếu"
          placeholder="Tìm phim, rạp..."
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {showDropdown && (
        <div className="gsearch__drop" id="gsearch-list" role="listbox">
          {!hasResults ? (
            <div className="gsearch__empty">
              Không tìm thấy. Nhấn Enter để tìm nâng cao.
            </div>
          ) : (
            <>
              {movieHits.length > 0 && (
                <div className="gsearch__group">
                  <span className="gsearch__grouphd">PHIM</span>
                  {movieHits.map((m) => {
                    const idx = flat.findIndex((f) => f.key === `m${m.id}`);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={active === idx}
                        className={
                          "gsearch__item" + (active === idx ? " is-active" : "")
                        }
                        onClick={() => go(`/movie/${m.id}`)}
                      >
                        {m.poster ? (
                          <img
                            src={m.poster}
                            alt=""
                            className="gsearch__poster"
                          />
                        ) : (
                          <span className="gsearch__poster gsearch__poster--ph">
                            {m.title[0]}
                          </span>
                        )}
                        <span className="gsearch__meta">
                          <span className="gsearch__name">{m.title}</span>
                          <span className="gsearch__sub">{m.genre}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {cinemaHits.length > 0 && (
                <div className="gsearch__group">
                  <span className="gsearch__grouphd">RẠP</span>
                  {cinemaHits.map((c) => {
                    const idx = flat.findIndex((f) => f.key === `c${c.id}`);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={active === idx}
                        className={
                          "gsearch__item" + (active === idx ? " is-active" : "")
                        }
                        onClick={() => go(`/cinema/${c.id}`)}
                      >
                        <span className="gsearch__meta">
                          <span className="gsearch__name">{c.name}</span>
                          <span className="gsearch__sub">
                            {c.address ?? cityName[c.cityId] ?? ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {showHits.length > 0 && (
                <div className="gsearch__group">
                  <span className="gsearch__grouphd">SUẤT CHIẾU</span>
                  {showHits.map((r) => {
                    const idx = flat.findIndex(
                      (f) => f.key === `s${r.showtime.id}`,
                    );
                    return (
                      <button
                        key={r.showtime.id}
                        type="button"
                        role="option"
                        aria-selected={active === idx}
                        className={
                          "gsearch__item" + (active === idx ? " is-active" : "")
                        }
                        onClick={() => go(`/seats/${r.showtime.id}`)}
                      >
                        <span className="gsearch__meta">
                          <span className="gsearch__name">
                            {r.movie?.title ?? "Phim"}
                          </span>
                          <span className="gsearch__sub">
                            {fmtTime(r.showtime.time)} · {r.cinema?.name ?? ""}
                            {r.roomType ? ` · ${r.roomType}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                role="option"
                aria-selected={active === flat.length - 1}
                className={
                  "gsearch__all" +
                  (active === flat.length - 1 ? " is-active" : "")
                }
                onClick={() => go(`/search?q=${encodeURIComponent(q)}`)}
              >
                Xem tất cả kết quả cho “{q.trim()}” →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
