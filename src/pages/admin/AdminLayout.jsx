import { NavLink, Outlet } from "react-router-dom";
import Navbar from "components/Navbar";
import "./Admin.css";

const LINKS = [
  { to: "/admin", end: true, label: "Tổng quan" },
  { to: "/admin/movies", label: "Phim" },
  { to: "/admin/rooms", label: "Phòng" },
  { to: "/admin/showtimes", label: "Suất chiếu" },
  { to: "/admin/bookings", label: "Đơn đặt vé" },
];

export default function AdminLayout() {
  return (
    <div className="page admin-page">
      <Navbar />
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-title">Quản trị</div>
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `admin-nav-link ${isActive ? "active" : ""}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </aside>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
