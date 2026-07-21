import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { loginUser } from "services/auth";
import { useAuth } from "context/AuthContext";
import AuthLayout from "./AuthLayout";
import "./Auth.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // chặn tái nhập (double-submit khi mạng chậm)
    setError("");
    if (!email || !password) {
      setError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    setLoading(true);
    try {
      const user = await loginUser(email, password, remember);
      login(user);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      codeNo="01"
      statement={
        <>
          Xem phim
          <br />
          bắt đầu
          <br />
          từ đây
        </>
      }
      sub="Đăng nhập để tiếp tục giữ ghế, chọn suất và soát vé bằng mã QR."
    >
      <div className="authf-k">
        <Link to="/" className="auth-k__logo">
          CINEMA
        </Link>

        <p className="authf-k__eyebrow">Đăng nhập</p>
        <h1 className="authf-k__title">Chào mừng trở lại</h1>

        {error && (
          <div className="authf-k__error">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <form className="authf-k__form" onSubmit={handleSubmit}>
          <div className="field-k">
            <label className="field-k__label" htmlFor="login-email">
              Email
            </label>
            <div className="field-k__wrap">
              <input
                id="login-email"
                className="field-k__input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="field-k">
            <label className="field-k__label" htmlFor="login-password">
              Mật khẩu
            </label>
            <div className="field-k__wrap">
              <input
                id="login-password"
                className="field-k__input"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="field-k__eye"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPass ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <label className="authf-k__remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Ghi nhớ đăng nhập</span>
          </label>

          <button className="authf-k__submit" type="submit" disabled={loading}>
            {loading ? <span className="authf-k__spinner" /> : "Đăng nhập"}
          </button>
        </form>

        <div className="authf-k__divider">
          <span>hoặc</span>
        </div>

        <p className="authf-k__switch">
          Chưa có tài khoản?{" "}
          <Link
            to="/register"
            state={{
              from: (location.state as { from?: unknown } | null)?.from,
            }}
            className="authf-k__link"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
