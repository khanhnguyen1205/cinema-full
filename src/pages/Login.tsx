import { Fragment, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { loginUser } from "services/auth";
import { useAuth } from "context/AuthContext";
import AuthLayout from "./AuthLayout";
import "./Auth.css";

export default function Login() {
  const { t } = useTranslation();
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
      setError(t("auth.fillAll"));
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
          {t("auth.loginStatement")
            .split("\n")
            .map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
        </>
      }
      sub={t("auth.loginSub")}
    >
      <div className="authf-k">
        <Link to="/" className="auth-k__logo">
          CINEMA
        </Link>

        <p className="authf-k__eyebrow">{t("auth.loginEyebrow")}</p>
        <h1 className="authf-k__title">{t("auth.loginTitle")}</h1>

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
              {t("auth.password")}
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
                aria-label={
                  showPass ? t("auth.hidePassword") : t("auth.showPassword")
                }
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
            <span>{t("auth.remember")}</span>
          </label>

          <button className="authf-k__submit" type="submit" disabled={loading}>
            {loading ? (
              <span className="authf-k__spinner" />
            ) : (
              t("auth.loginSubmit")
            )}
          </button>
        </form>

        <div className="authf-k__divider">
          <span>{t("auth.or")}</span>
        </div>

        <p className="authf-k__switch">
          {t("auth.noAccount")}{" "}
          <Link
            to="/register"
            state={{
              from: (location.state as { from?: unknown } | null)?.from,
            }}
            className="authf-k__link"
          >
            {t("auth.registerNow")}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
