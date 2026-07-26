import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "context/AuthContext";
import { cx } from "lib/cx";
import GlobalSearch from "components/GlobalSearch";
import LanguageSwitcher from "components/LanguageSwitcher";
import InstallButton from "components/InstallButton";
import "./Navbar.css";

const LINKS = [
  { to: "/", key: "nav.home", match: (p: string) => p === "/" },
  { to: "/movies", key: "nav.movies", match: (p: string) => p === "/movies" },
  {
    to: "/cinemas",
    key: "nav.cinemas",
    match: (p: string) => p.startsWith("/cinema"),
  },
  {
    to: "/tickets",
    key: "nav.tickets",
    match: (p: string) => p === "/tickets",
  },
];

export default function Navbar({ back }: { back?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [dropOpen, setDropOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setDropOpen(false);
    navigate("/");
  };

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((w) => w[0])
        .slice(-2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <nav className="nav-k">
      <div className="nav-k__left">
        {back && (
          <Link to={back} className="nav-k__back" aria-label={t("nav.back")}>
            ←
          </Link>
        )}
        <Link to="/" className="nav-k__logo">
          CINE<b>MA</b>
        </Link>
      </div>

      <div className="nav-k__links">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={cx(
              "nav-k__link",
              l.match(location.pathname) && "is-active",
            )}
          >
            {t(l.key)}
          </Link>
        ))}
      </div>

      <div className="nav-k__right">
        <LanguageSwitcher />
        <InstallButton className="install-k--desktop" />
        <div className="nav-k__search-desktop">
          <GlobalSearch />
        </div>
        {user ? (
          <div className="nav-k__menu" ref={dropRef}>
            <button
              className="nav-k__avatar"
              onClick={() => setDropOpen((v) => !v)}
              title={user.fullName}
              aria-label={t("nav.account")}
            >
              {initials}
            </button>
            {dropOpen && (
              <div className="nav-k__dropdown">
                <Link
                  to="/tickets"
                  className="nav-k__item"
                  onClick={() => setDropOpen(false)}
                >
                  {t("nav.myTickets")}
                </Link>
                {user.role === "admin" && (
                  <Link
                    to="/admin"
                    className="nav-k__item"
                    onClick={() => setDropOpen(false)}
                  >
                    {t("nav.admin")}
                  </Link>
                )}
                <button className="nav-k__item" onClick={handleLogout}>
                  {t("nav.logout")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="nav-k__login">
            {t("nav.login")}
          </Link>
        )}
        <button
          className="nav-k__hamburger"
          aria-label={t("nav.menu")}
          aria-expanded={menuOpen}
          aria-controls="nav-mobile"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      <div
        id="nav-mobile"
        className={cx("nav-k__mobile", menuOpen && "is-open")}
      >
        <div className="nav-k__search-mobile">
          <GlobalSearch />
        </div>
        <div className="nav-k__lang-mobile">
          <LanguageSwitcher />
        </div>
        <div className="nav-k__install-mobile">
          <InstallButton />
        </div>
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={cx(
              "nav-k__link",
              l.match(location.pathname) && "is-active",
            )}
            onClick={() => setMenuOpen(false)}
          >
            {t(l.key)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
