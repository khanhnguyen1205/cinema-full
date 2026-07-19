import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "context/AuthContext";
import { cx } from "lib/cx";
import "./Navbar.css";

const LINKS = [
  { to: "/", label: "Trang chủ", match: (p: string) => p === "/" },
  { to: "/movies", label: "Phim", match: (p: string) => p === "/movies" },
  {
    to: "/cinemas",
    label: "Rạp",
    match: (p: string) => p.startsWith("/cinema"),
  },
  { to: "/tickets", label: "Vé", match: (p: string) => p === "/tickets" },
];

export default function Navbar({ back }: { back?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
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
          <Link to={back} className="nav-k__back" aria-label="Quay lại">
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
            {l.label}
          </Link>
        ))}
      </div>

      <div className="nav-k__right">
        {user ? (
          <div className="nav-k__menu" ref={dropRef}>
            <button
              className="nav-k__avatar"
              onClick={() => setDropOpen((v) => !v)}
              title={user.fullName}
              aria-label="Tài khoản"
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
                  Vé của tôi
                </Link>
                {user.role === "admin" && (
                  <Link
                    to="/admin"
                    className="nav-k__item"
                    onClick={() => setDropOpen(false)}
                  >
                    Quản trị
                  </Link>
                )}
                <button className="nav-k__item" onClick={handleLogout}>
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="nav-k__login">
            Đăng nhập
          </Link>
        )}
        <button
          className="nav-k__hamburger"
          aria-label="Menu"
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
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
