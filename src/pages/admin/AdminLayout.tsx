import { NavLink, Outlet } from "react-router-dom";
import Navbar from "components/Navbar";
import "./Admin.css";

const LINKS = [
  { to: "/admin", end: true, label: "Tổng quan" },
  { to: "/admin/movies", label: "Phim" },
  { to: "/admin/rooms", label: "Phòng" },
  { to: "/admin/showtimes", label: "Suất chiếu" },
  { to: "/admin/bookings", label: "Đơn đặt vé" },
  { to: "/admin/reviews", label: "Đánh giá" },
];

export default function AdminLayout() {
  return (
    <div className="page adm-k">
      <Navbar />
      <div className="adm-k__shell">
        <aside className="adm-k__side">
          <div className="adm-k__side-title">Quản trị</div>
          <nav className="adm-k__nav">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `adm-k__navlink${isActive ? " is-active" : ""}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="adm-k__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
