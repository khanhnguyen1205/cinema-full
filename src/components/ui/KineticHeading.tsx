import type { CSSProperties } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function KineticHeading({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={cx("ui-kinetic", className)} aria-label={text}>
      {Array.from(text).map((ch, i) => {
        const style: CSSProperties & Record<string, string> = {
          "--i": String(i),
        };
        return (
          <span
            key={i}
            aria-hidden="true"
            className="ui-kinetic__ch"
            style={style}
          >
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </span>
  );
}
