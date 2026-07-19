import type { CSSProperties, ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Marquee({
  children,
  speed = 30,
  className,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const style: CSSProperties & Record<string, string> = {
    "--marquee-dur": `${speed}s`,
  };
  return (
    <div className={cx("ui-marquee", className)}>
      <div className="ui-marquee__track" style={style}>
        <div className="ui-marquee__group">{children}</div>
        <div className="ui-marquee__group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
