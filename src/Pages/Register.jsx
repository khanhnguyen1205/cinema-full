import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { registerUser } from "../Services/auth";
import { useAuth } from "../Context/AuthContext";
import "./Auth.css";

export default function Register() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.fullName || !form.email || !form.password || !form.confirm) {
      setError("Vui lòng nhập đầy đủ thông tin."); return;
    }
    if (form.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự."); return;
    }
    if (form.password !== form.confirm) {
      setError("Mật khẩu xác nhận không khớp."); return;
    }

    setLoading(true);
    try {
      const user = await registerUser({ fullName: form.fullName, email: form.email, password: form.password });
      login(user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-bg-glow" style={{ background: "radial-gradient(ellipse at 60% 40%, rgba(230,48,48,0.12) 0%, transparent 70%)" }} />
        <div className="auth-bg-grid" />
      </div>

      <div className="auth-card auth-card--wide">
        <Link to="/" className="auth-logo">CINEMA</Link>

        <div className="auth-header">
          <h1 className="auth-title">Tạo tài khoản</h1>
          <p className="auth-subtitle">Đăng ký để bắt đầu đặt vé xem phim</p>
        </div>

        {error && (
          <div className="auth-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label">Họ và tên</label>
            <div className="field-input-wrap">
              <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <input className="field-input" type="text" placeholder="Nguyễn Văn A" value={form.fullName} onChange={set("fullName")} autoComplete="name" />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Email</label>
            <div className="field-input-wrap">
              <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
              <input className="field-input" type="email" placeholder="your@email.com" value={form.email} onChange={set("email")} autoComplete="email" />
            </div>
          </div>

          <div className="auth-form-row">
            <div className="field-group">
              <label className="field-label">Mật khẩu</label>
              <div className="field-input-wrap">
                <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <input className="field-input" type={showPass ? "text" : "password"} placeholder="••••••••" value={form.password} onChange={set("password")} autoComplete="new-password" />
                <button type="button" className="field-eye" onClick={() => setShowPass(v => !v)}>
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Xác nhận mật khẩu</label>
              <div className="field-input-wrap">
                <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <input className="field-input" type={showPass ? "text" : "password"} placeholder="••••••••" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
              </div>
            </div>
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="auth-spinner" /> : "Tạo tài khoản"}
          </button>
        </form>

        <div className="auth-divider"><span>hoặc</span></div>

        <p className="auth-switch">
          Đã có tài khoản?{" "}
          <Link to="/login" state={{ from: location.state?.from }} className="auth-link">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
