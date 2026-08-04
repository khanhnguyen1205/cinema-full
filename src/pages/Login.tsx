import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { loginUser } from "services/auth";
import { useAuth } from "context/AuthContext";
import AuthLayout, { AuthError, PasswordField } from "./AuthLayout";
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
  const fromState = (location.state as { from?: { pathname?: string } } | null)
    ?.from;

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
      navigate(fromState?.pathname || "/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout statement={t("auth.loginStatement")} sub={t("auth.loginSub")}>
      <div className="authf-k">
        <Link to="/" className="auth-k__logo">
          CINEMA
        </Link>

        <p className="authf-k__eyebrow">{t("auth.loginEyebrow")}</p>
        <h1 className="authf-k__title">{t("auth.loginTitle")}</h1>

        {error && <AuthError message={error} />}

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

          <PasswordField
            id="login-password"
            label={t("auth.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            visible={showPass}
            onToggle={() => setShowPass((v) => !v)}
          />

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
            state={{ from: fromState }}
            className="authf-k__link"
          >
            {t("auth.registerNow")}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
