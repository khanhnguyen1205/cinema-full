import type { ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ui-field", className)}>
      {label && (
        <label className="ui-field__label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}
