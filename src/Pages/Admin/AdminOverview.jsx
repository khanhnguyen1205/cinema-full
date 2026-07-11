import { useEffect, useState } from "react";
import { getMovies, getCinemas, getRooms, getAllShowtimes, getBookings } from "../../Services/api";

export default function AdminOverview() {
  const [s, setS] = useState({ movies: 0, cinemas: 0, rooms: 0, showtimes: 0, bookings: 0 });
  useEffect(() => {
    Promise.all([getMovies(), getCinemas(), getRooms(), getAllShowtimes(), getBookings()])
      .then(([m, c, r, st, b]) => setS({ movies: m.length, cinemas: c.length, rooms: r.length, showtimes: st.length, bookings: b.length }));
  }, []);
  const tiles = [
    { n: s.movies, l: "Phim" }, { n: s.cinemas, l: "Rạp" }, { n: s.rooms, l: "Phòng" },
    { n: s.showtimes, l: "Suất chiếu" }, { n: s.bookings, l: "Đơn đặt vé" }
  ];
  return (
    <div>
      <div className="admin-head"><h1 className="admin-title">Tổng quan</h1></div>
      <div className="admin-stats">
        {tiles.map(t => <div key={t.l} className="admin-stat"><div className="admin-stat-num">{t.n}</div><div className="admin-stat-label">{t.l}</div></div>)}
      </div>
    </div>
  );
}
