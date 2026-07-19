import type { ReactNode } from "react";
import { cx } from "lib/cx";
import Numbered from "./Numbered";
import Rule from "./Rule";
import "./ui.css";

export default function Section({
  label,
  index,
  children,
  className,
}: {
  label?: string;
  index?: number;
  children: ReactNode;
  className?: string;
}) {
  const hasHead = label !== undefined || index !== undefined;
  return (
    <section className={cx("ui-section", className)}>
      {hasHead && (
        <div className="ui-section__head">
          {index !== undefined && <Numbered n={index} />}
          {label !== undefined && (
            <span className="ui-section__label">{label}</span>
          )}
          <Rule />
        </div>
      )}
      {children}
    </section>
  );
}
