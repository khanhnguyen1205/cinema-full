import type { ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("ui-container", className)}>{children}</div>;
}
