import type { ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Tag({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx("ui-tag", className)}>{children}</span>;
}
