import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../Context/AuthContext";

export default function Navbar({ back }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    setDropOpen(false);
    navigate("/");
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map(w => w[0]).slice(-2).join("").toUpperCase()
    : "?";

  return (
    <nav className="navbar">
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {back && (
          <Link to={back} style={{ display: "flex", alignItems: "center", marginRight: 8 }}>
            <svg className="navbar-icon-svg" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M5 12l7 7M5 12l7-7" />
            </svg>
          </Link>
        )}
        <Link to="/" className="navbar-logo">CINEMA</Link>
      </div>

      <div className="navbar-links">
        <Link to="/" className={location.pathname === "/" ? "active" : ""}>Trang chủ</Link>
        <Link to="/movies" className={location.pathname === "/movies" ? "active" : ""}>Phim</Link>
        <Link to="/cinemas" className={location.pathname.startsWith("/cinema") ? "active" : ""}>Rạp</Link>
        <Link to="/tickets" className={location.pathname === "/tickets" ? "active" : ""}>Vé</Link>
      </div>

      <div className="navbar-icons">
        <svg className="navbar-icon-svg" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>

        {user ? (
          <div className="user-menu" ref={dropRef}>
            <button className="user-avatar" onClick={() => setDropOpen(v => !v)} title={user.fullName}>
              {initials}
            </button>
            {dropOpen && (
              <div className="user-dropdown">
                <div className="user-dropdown-info">
                  <div className="user-dropdown-name">{user.fullName}</div>
                  <div className="user-dropdown-email">{user.email}</div>
                </div>
                <div className="user-dropdown-divider" />
                <Link to="/tickets" className="user-dropdown-item" onClick={() => setDropOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 9l3-3 3 3M2 15l3 3 3-3M13 12h8M13 6h8M13 18h8" />
                  </svg>
                  Vé của tôi
                </Link>
                <div className="user-dropdown-divider" />
                <button className="user-dropdown-item user-dropdown-logout" onClick={handleLogout}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="navbar-login-btn">Đăng nhập</Link>
        )}
      </div>
    </nav>
  );
}
