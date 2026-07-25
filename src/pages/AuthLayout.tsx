import type { ReactNode } from "react";
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
  statement: ReactNode;
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
          <h2 className="auth-k__statement">{statement}</h2>
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
