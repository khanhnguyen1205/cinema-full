import { useEffect, useMemo, useState } from "react";
import {
  getMovies,
  getCinemas,
  getRooms,
  getAllShowtimes,
  getBookings,
} from "services/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const RED = "#e63030"; // matches --red in src/Styles/global.css (SVG fills can't use CSS vars reliably)
const fmtVnd = (n) => `${(n || 0).toLocaleString("vi-VN")}₫`;

export default function AdminOverview() {
  const [movies, setMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    Promise.all([
      getMovies(),
      getCinemas(),
      getRooms(),
      getAllShowtimes(),
      getBookings(),
    ]).then(([m, c, r, st, b]) => {
      setMovies(m);
      setCinemas(c);
      setRooms(r);
      setShowtimes(st);
      setBookings(b);
    });
  }, []);

  const movieMap = useMemo(
    () => Object.fromEntries(movies.map((m) => [m.id, m])),
    [movies],
  );
  const cinemaMap = useMemo(
    () => Object.fromEntries(cinemas.map((c) => [c.id, c])),
    [cinemas],
  );

  // Doanh thu vé (ghế) của một đơn: ưu tiên seatTotal; đơn cũ chưa tách thì lấy totalPrice
  const seatRev = (b) =>
    b.seatTotal != null ? b.seatTotal : b.totalPrice || 0;

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
    const acc = {};
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
    const acc = {};
    bookings.forEach((b) => {
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

  return (
    <div>
      <div className="admin-head">
        <h1 className="admin-title">Tổng quan</h1>
      </div>

      <div className="admin-stats">
        {tiles.map((t) => (
          <div key={t.l} className="admin-stat">
            <div className="admin-stat-num">{t.n}</div>
            <div className="admin-stat-label">{t.l}</div>
          </div>
        ))}
      </div>

      <div className="admin-revenue-cards">
        <div className="admin-revenue-card">
          <div className="admin-revenue-label">Tổng doanh thu</div>
          <div className="admin-revenue-num">{fmtVnd(totalRevenue)}</div>
        </div>
        <div className="admin-revenue-card">
          <div className="admin-revenue-label">Doanh thu bắp nước</div>
          <div className="admin-revenue-num">{fmtVnd(fnbRevenue)}</div>
        </div>
        <div className="admin-revenue-card">
          <div className="admin-revenue-label">Tổng vé bán</div>
          <div className="admin-revenue-num">{totalTickets}</div>
        </div>
      </div>

      <div className="admin-charts">
        <div className="admin-chart-box">
          <h2 className="admin-chart-title">Doanh thu vé theo phim (Top 6)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={revenueByMovie}
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <XAxis
                dataKey="name"
                tick={{ fill: "#9aa0a6", fontSize: 11 }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: "#9aa0a6", fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toLocaleString("vi-VN")}k`}
                width={48}
              />
              <Tooltip
                formatter={(v) => fmtVnd(v)}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="revenue" fill={RED} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="admin-chart-box">
          <h2 className="admin-chart-title">Doanh thu vé theo rạp</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={revenueByCinema}
              layout="vertical"
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <XAxis
                type="number"
                tick={{ fill: "#9aa0a6", fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toLocaleString("vi-VN")}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#9aa0a6", fontSize: 11 }}
                width={110}
              />
              <Tooltip
                formatter={(v) => fmtVnd(v)}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
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
