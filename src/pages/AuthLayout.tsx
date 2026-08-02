import { Fragment, type ChangeEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Marquee, TicketEdge } from "components/ui";
import "./Auth.css";

export default function AuthLayout({
  codeNo,
  statement,
  sub,
  children,
}: {
  codeNo: string;
  statement: string;
  sub: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const marquee = t("auth.marquee");
  return (
    <div className="auth-k">
      <div className="auth-k__bg" aria-hidden="true">
        <div className="auth-k__glow" />
        <div className="auth-k__grid" />
      </div>

      <aside className="auth-k__side">
        <TicketEdge className="auth-k__ticket">
          <div className="auth-k__side-top">
            <span className="auth-k__code">N°{codeNo}</span>
            <span className="auth-k__brand">THE CINEMATIC EDITORIAL</span>
          </div>
          <h2 className="auth-k__statement">
            {statement.split("\n").map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </h2>
          <p className="auth-k__sub">{sub}</p>
          <Marquee className="auth-k__marquee" speed={42}>
            <span>{marquee.repeat(4)}</span>
          </Marquee>
        </TicketEdge>
      </aside>

      <main className="auth-k__panel">{children}</main>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
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
      {message}
    </div>
  );
}

// Ô mật khẩu dùng chung cho Đăng nhập / Đăng ký. Bỏ `onToggle` thì không có nút
// con mắt — ô "xác nhận mật khẩu" đi theo trạng thái hiện/ẩn của ô chính.
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  visible,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
  visible: boolean;
  onToggle?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="field-k">
      <label className="field-k__label" htmlFor={id}>
        {label}
      </label>
      <div className="field-k__wrap">
        <input
          id={id}
          className="field-k__input"
          type={visible ? "text" : "password"}
          placeholder="••••••••"
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
        />
        {onToggle && (
          <button
            type="button"
            className="field-k__eye"
            onClick={onToggle}
            aria-label={
              visible ? t("auth.hidePassword") : t("auth.showPassword")
            }
          >
            {visible ? (
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
        )}
      </div>
    </div>
  );
}
