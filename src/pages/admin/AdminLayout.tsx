import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "components/Navbar";
import "./Admin.css";

const LINKS = [
  { to: "/admin", end: true, labelKey: "admin.navOverview" },
  { to: "/admin/movies", labelKey: "admin.navMovies" },
  { to: "/admin/rooms", labelKey: "admin.navRooms" },
  { to: "/admin/showtimes", labelKey: "admin.navShowtimes" },
  { to: "/admin/bookings", labelKey: "admin.navBookings" },
  { to: "/admin/reviews", labelKey: "admin.navReviews" },
];

export default function AdminLayout() {
  const { t } = useTranslation();
  return (
    <div className="page adm-k">
      <Navbar />
      <div className="adm-k__shell">
        <aside className="adm-k__side">
          <div className="adm-k__side-title">{t("admin.role")}</div>
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
                {t(l.labelKey)}
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
