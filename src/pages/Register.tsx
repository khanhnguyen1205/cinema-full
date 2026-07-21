import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { registerUser } from "services/auth";
import { useAuth } from "context/AuthContext";
import AuthLayout from "./AuthLayout";
import "./Auth.css";

export default function Register() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname || "/";

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // chặn tái nhập (double-submit khi mạng chậm)
    setError("");

    if (!form.fullName || !form.email || !form.password || !form.confirm) {
      setError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    if (form.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      const user = await registerUser({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
      });
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
      codeNo="02"
      statement={
        <>
          Một tài khoản
          <br />
          mở mọi
          <br />
          suất chiếu
        </>
      }
      sub="Tạo tài khoản để đặt vé, lưu lịch sử và nhận vé điện tử có mã QR."
    >
      <div className="authf-k">
        <Link to="/" className="auth-k__logo">
          CINEMA
        </Link>

        <p className="authf-k__eyebrow">Đăng ký</p>
        <h1 className="authf-k__title">Tạo tài khoản</h1>

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
            <label className="field-k__label" htmlFor="reg-name">
              Họ và tên
            </label>
            <div className="field-k__wrap">
              <input
                id="reg-name"
                className="field-k__input"
                type="text"
                placeholder="Nguyễn Văn A"
                value={form.fullName}
                onChange={set("fullName")}
                autoComplete="name"
              />
            </div>
          </div>

          <div className="field-k">
            <label className="field-k__label" htmlFor="reg-email">
              Email
            </label>
            <div className="field-k__wrap">
              <input
                id="reg-email"
                className="field-k__input"
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={set("email")}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="authf-k__row">
            <div className="field-k">
              <label className="field-k__label" htmlFor="reg-password">
                Mật khẩu
              </label>
              <div className="field-k__wrap">
                <input
                  id="reg-password"
                  className="field-k__input"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="new-password"
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

            <div className="field-k">
              <label className="field-k__label" htmlFor="reg-confirm">
                Xác nhận mật khẩu
              </label>
              <div className="field-k__wrap">
                <input
                  id="reg-confirm"
                  className="field-k__input"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={set("confirm")}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <button className="authf-k__submit" type="submit" disabled={loading}>
            {loading ? <span className="authf-k__spinner" /> : "Tạo tài khoản"}
          </button>
        </form>

        <div className="authf-k__divider">
          <span>hoặc</span>
        </div>

        <p className="authf-k__switch">
          Đã có tài khoản?{" "}
          <Link
            to="/login"
            state={{
              from: (location.state as { from?: unknown } | null)?.from,
            }}
            className="authf-k__link"
          >
            Đăng nhập
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
