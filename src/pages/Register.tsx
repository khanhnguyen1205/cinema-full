import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { registerUser } from "services/auth";
import { useAuth } from "context/AuthContext";
import AuthLayout, { AuthError, PasswordField } from "./AuthLayout";
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
  const fromState = (location.state as { from?: { pathname?: string } } | null)
    ?.from;

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
      navigate(fromState?.pathname || "/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      codeNo="02"
      statement={t("auth.registerStatement")}
      sub={t("auth.registerSub")}
    >
      <div className="authf-k">
        <Link to="/" className="auth-k__logo">
          CINEMA
        </Link>

        <p className="authf-k__eyebrow">{t("auth.registerEyebrow")}</p>
        <h1 className="authf-k__title">{t("auth.registerTitle")}</h1>

        {error && <AuthError message={error} />}

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
            <PasswordField
              id="reg-password"
              label={t("auth.password")}
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
              visible={showPass}
              onToggle={() => setShowPass((v) => !v)}
            />
            <PasswordField
              id="reg-confirm"
              label={t("auth.confirmPassword")}
              value={form.confirm}
              onChange={set("confirm")}
              autoComplete="new-password"
              visible={showPass}
            />
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
            state={{ from: fromState }}
            className="authf-k__link"
          >
            {t("auth.loginNow")}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
