import type { ReactNode } from "react";
import { Marquee, TicketEdge } from "components/ui";
import "./Auth.css";

const MARQUEE = "ĐẶT VÉ · CHỌN GHẾ · BẮP NƯỚC · QUÉT MÃ · ";

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
            <span>{MARQUEE.repeat(4)}</span>
          </Marquee>
        </TicketEdge>
      </aside>

      <main className="auth-k__panel">{children}</main>
    </div>
  );
}
