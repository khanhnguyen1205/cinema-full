import type { ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Badge({
  children,
  tone = "red",
  className,
}: {
  children: ReactNode;
  tone?: "red" | "muted";
  className?: string;
}) {
  return (
    <span className={cx("ui-badge", `ui-badge--${tone}`, className)}>
      {children}
    </span>
  );
}
