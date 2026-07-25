import { Fragment, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { registerUser } from "services/auth";
import { useAuth } from "context/AuthContext";
import AuthLayout from "./AuthLayout";
import "./Auth.css";

export default function Register() {
  const { t } = useTranslation();
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
      setError(t("auth.fillAll"));
      return;
    }
    if (form.password.length < 6) {
      setError(t("auth.passMin"));
      return;
    }
    if (form.password !== form.confirm) {
      setError(t("auth.passMismatch"));
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
          {t("auth.registerStatement")
            .split("\n")
            .map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
        </>
      }
      sub={t("auth.registerSub")}
    >
      <div className="authf-k">
        <Link to="/" className="auth-k__logo">
          CINEMA
        </Link>

        <p className="authf-k__eyebrow">{t("auth.registerEyebrow")}</p>
        <h1 className="authf-k__title">{t("auth.registerTitle")}</h1>

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
              {t("auth.fullName")}
            </label>
            <div className="field-k__wrap">
              <input
                id="reg-name"
                className="field-k__input"
                type="text"
                placeholder={t("auth.fullNamePlaceholder")}
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
                {t("auth.password")}
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

            <div className="field-k">
              <label className="field-k__label" htmlFor="reg-confirm">
                {t("auth.confirmPassword")}
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
            {loading ? (
              <span className="authf-k__spinner" />
            ) : (
              t("auth.registerSubmit")
            )}
          </button>
        </form>

        <div className="authf-k__divider">
          <span>{t("auth.or")}</span>
        </div>

        <p className="authf-k__switch">
          {t("auth.haveAccount")}{" "}
          <Link
            to="/login"
            state={{
              from: (location.state as { from?: unknown } | null)?.from,
            }}
            className="authf-k__link"
          >
            {t("auth.loginNow")}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
