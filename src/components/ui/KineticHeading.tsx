import type { CSSProperties } from "react";
import { Fragment } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function KineticHeading({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const words = text.split(" ");
  let idx = 0;
  return (
    <span className={cx("ui-kinetic", className)} aria-label={text}>
      {words.map((word, wi) => (
        <Fragment key={wi}>
          <span className="ui-kinetic__word">
            {Array.from(word).map((ch) => {
              const style: CSSProperties & Record<string, string> = {
                "--i": String(idx),
              };
              idx += 1;
              return (
                <span
                  key={idx}
                  aria-hidden="true"
                  className="ui-kinetic__ch"
                  style={style}
                >
                  {ch}
                </span>
              );
            })}
          </span>
          {wi < words.length - 1 && " "}
        </Fragment>
      ))}
    </span>
  );
}
