import { useMemo } from "react";
import {
  useMovies,
  useCinemas,
  useRooms,
  useAllShowtimes,
} from "queries/catalog";
import { useAllBookings } from "queries/admin";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Booking } from "types";

const RED = "#e63030"; // SVG fill không đọc CSS var ổn định -> hardcode khớp --red
const AXIS = "#9a978f";
const MONO = '"Space Mono", monospace';
const fmtVnd = (n?: number) => `${(n || 0).toLocaleString("vi-VN")}₫`;

// Doanh thu vé (ghế) của một đơn: ưu tiên seatTotal; đơn cũ chưa tách thì lấy totalPrice
const seatRev = (b: Booking) =>
  b.seatTotal != null ? b.seatTotal : b.totalPrice || 0;

export default function AdminOverview() {
  const moviesQ = useMovies();
  const cinemasQ = useCinemas();
  const bookingsQ = useAllBookings();
  const rooms = useRooms().data ?? [];
  const showtimes = useAllShowtimes().data ?? [];
  const movies = useMemo(() => moviesQ.data ?? [], [moviesQ.data]);
  const cinemas = useMemo(() => cinemasQ.data ?? [], [cinemasQ.data]);
  const bookings = useMemo(() => bookingsQ.data ?? [], [bookingsQ.data]);

  const movieMap = useMemo(
    () => Object.fromEntries(movies.map((m) => [m.id, m])),
    [movies],
  );
  const cinemaMap = useMemo(
    () => Object.fromEntries(cinemas.map((c) => [c.id, c])),
    [cinemas],
  );

  const totalRevenue = useMemo(
    () => bookings.reduce((s, b) => s + (b.totalPrice || 0), 0),
    [bookings],
  );
  const fnbRevenue = useMemo(
    () => bookings.reduce((s, b) => s + (b.fnbTotal || 0), 0),
    [bookings],
  );
  const totalTickets = useMemo(
    () => bookings.reduce((s, b) => s + (b.seats?.length || 0), 0),
    [bookings],
  );

  const revenueByMovie = useMemo(() => {
    const acc: Record<string, number> = {};
    bookings.forEach((b) => {
      acc[b.movieId] = (acc[b.movieId] || 0) + seatRev(b);
    });
    return Object.entries(acc)
      .map(([id, revenue]) => ({
        name: movieMap[id]?.title || `#${id}`,
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [bookings, movieMap]);

  const revenueByCinema = useMemo(() => {
    const acc: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.cinemaId == null) return;
      acc[b.cinemaId] = (acc[b.cinemaId] || 0) + seatRev(b);
    });
    return Object.entries(acc)
      .map(([id, revenue]) => ({
        name: cinemaMap[id]?.name || `#${id}`,
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [bookings, cinemaMap]);

  const tiles = [
    { n: movies.length, l: "Phim" },
    { n: cinemas.length, l: "Rạp" },
    { n: rooms.length, l: "Phòng" },
    { n: showtimes.length, l: "Suất chiếu" },
    { n: bookings.length, l: "Đơn đặt vé" },
  ];

  const tooltipStyle = {
    background: "#141416",
    border: "1px solid #2a2a2e",
    borderRadius: 0,
    fontFamily: MONO,
    fontSize: 12,
  };

  return (
    <div>
      <div className="adm-k__head">
        <span className="adm-k__eyebrow">Quản trị</span>
        <h1 className="adm-k__title">Tổng quan</h1>
      </div>

      <div className="adm-k__stats">
        {tiles.map((t) => (
          <div key={t.l} className="adm-k__stat">
            <div className="adm-k__stat-num">{t.n}</div>
            <div className="adm-k__stat-label">{t.l}</div>
          </div>
        ))}
      </div>

      <div className="adm-k__rev">
        <div className="adm-k__rev-card is-bone">
          <div className="adm-k__rev-label">Tổng doanh thu</div>
          <div className="adm-k__rev-num">{fmtVnd(totalRevenue)}</div>
        </div>
        <div className="adm-k__rev-card">
          <div className="adm-k__rev-label">Doanh thu bắp nước</div>
          <div className="adm-k__rev-num">{fmtVnd(fnbRevenue)}</div>
        </div>
        <div className="adm-k__rev-card">
          <div className="adm-k__rev-label">Tổng vé bán</div>
          <div className="adm-k__rev-num">{totalTickets}</div>
        </div>
      </div>

      <div className="adm-k__charts">
        <div className="adm-k__chartbox">
          <h2 className="adm-k__chart-title">Doanh thu vé theo phim (Top 6)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={revenueByMovie}
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <XAxis
                dataKey="name"
                tick={{ fill: AXIS, fontSize: 11, fontFamily: MONO }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: AXIS, fontSize: 11, fontFamily: MONO }}
                tickFormatter={(v) => `${(v / 1000).toLocaleString("vi-VN")}k`}
                width={48}
              />
              <Tooltip
                formatter={(v) => fmtVnd(Number(v))}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={tooltipStyle}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="revenue" fill={RED} radius={[0, 0, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="adm-k__chartbox">
          <h2 className="adm-k__chart-title">Doanh thu vé theo rạp</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={revenueByCinema}
              layout="vertical"
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <XAxis
                type="number"
                tick={{ fill: AXIS, fontSize: 11, fontFamily: MONO }}
                tickFormatter={(v) => `${(v / 1000).toLocaleString("vi-VN")}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: AXIS, fontSize: 11, fontFamily: MONO }}
                width={110}
              />
              <Tooltip
                formatter={(v) => fmtVnd(Number(v))}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={tooltipStyle}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="revenue" radius={[0, 0, 0, 0]}>
                {revenueByCinema.map((_, i) => (
                  <Cell
                    key={i}
                    fill={RED}
                    fillOpacity={Math.max(0.3, 1 - i * 0.12)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
